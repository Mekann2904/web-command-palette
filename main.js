// ==UserScript==
// @name         Command Palette (Sites Launcher) + Manager
// @namespace    mekann.toolbox
// @version      1.3.1
// @description  ⌘P / Ctrl+P でコマンドパレット。サイトは表形式で管理。設定はUIで編集（ホットキー、Enter動作、ブロックリスト）。アイコンは可能な限りファビコン自動取得。
// @author       you
// @match        *://*/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      *
// ==/UserScript==

(function() {
  'use strict';

  const STORAGE_KEY = 'vm_sites_palette__sites';
  const SETTINGS_KEY = 'vm_sites_palette__settings_v2';
  const FAVCACHE_KEY = 'vm_sites_palette__favcache_v1';
  const USAGE_KEY = 'vm_sites_palette__usage_v1';

  const defaultSites = [
    { id: 'site-github', type: 'site', name: 'GitHub', url: 'https://github.com/', tags: ['開発'] },
    { id: 'site-stackoverflow', type: 'site', name: 'Stack Overflow', url: 'https://stackoverflow.com/', tags: ['開発'] },
    { id: 'site-mdn', type: 'site', name: 'MDN Web Docs', url: 'https://developer.mozilla.org/', tags: ['開発'] },
    { id: 'site-bing', type: 'site', name: 'Bing検索', url: 'https://www.bing.com/search?q=%s', tags: ['検索'] },
    { id: 'site-youtube', type: 'site', name: 'YouTube', url: 'https://www.youtube.com/', tags: ['動画'] },
    { id: 'site-gcal', type: 'site', name: 'Google Calendar', url: 'https://calendar.google.com/', tags: ['仕事'] }
  ];

  const defaultSettings = {
    hotkeyPrimary: 'Meta+KeyP',
    hotkeySecondary: 'Control+KeyP',
    enterOpens: 'current', // 'current' | 'newtab'
    blocklist: '',        // one host pattern per line, supports * wildcard
    theme: 'dark',
    accentColor: '#2563eb',
    autoOpenUrls: []
  };

  const themes = {
    dark: {
      '--overlay-bg': 'rgba(0,0,0,0.35)',
      '--panel-bg': '#1f2937',
      '--panel-text': '#e5e7eb',
      '--panel-shadow': '0 10px 40px rgba(0,0,0,.45)',
      '--input-bg': '#111827',
      '--input-text': '#f3f4f6',
      '--input-placeholder': '#9ca3af',
      '--border-color': '#374151',
      '--muted': '#94a3b8',
      '--item-bg-alt': 'rgba(255,255,255,.02)',
      '--item-active': '#374151',
      '--hint-bg': '#111827',
      '--list-scroll-thumb': '#4b5563',
      '--list-scroll-track': 'rgba(255,255,255,0.08)',
      '--command-badge-bg': 'rgba(255,255,255,0.12)',
      '--tag-bg': 'rgba(79,70,229,0.2)',
      '--tag-text': '#c7d2fe',
      '--toast-bg': 'rgba(17,24,39,0.92)',
      '--toast-text': '#e5e7eb'
    },
    light: {
      '--overlay-bg': 'rgba(255,255,255,0.65)',
      '--panel-bg': '#f9fafb',
      '--panel-text': '#111827',
      '--panel-shadow': '0 10px 36px rgba(15,23,42,.18)',
      '--input-bg': '#ffffff',
      '--input-text': '#111827',
      '--input-placeholder': '#6b7280',
      '--border-color': '#d1d5db',
      '--muted': '#6b7280',
      '--item-bg-alt': 'rgba(17,24,39,0.03)',
      '--item-active': 'rgba(37,99,235,0.12)',
      '--hint-bg': '#edf2f7',
      '--list-scroll-thumb': '#94a3ff',
      '--list-scroll-track': 'rgba(37,99,235,0.08)',
      '--command-badge-bg': 'rgba(37,99,235,0.15)',
      '--tag-bg': 'rgba(37,99,235,0.12)',
      '--tag-text': '#1d4ed8',
      '--toast-bg': 'rgba(255,255,255,0.95)',
      '--toast-text': '#111827'
    }
  };

  /* ---------- Helpers ---------- */
  const escapeHtml = str => (str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);

  /* ---------- Storage ---------- */
  const getSettings = () => ({ ...defaultSettings, ...GM_getValue(SETTINGS_KEY, {}) });
  const setSettings = s => GM_setValue(SETTINGS_KEY, { ...getSettings(), ...s });

  let favCache = GM_getValue(FAVCACHE_KEY, {});
  const setFavCache = (origin, href) => { favCache[origin] = href; GM_setValue(FAVCACHE_KEY, favCache); };
  const clearFavCacheOrigin = origin => {
    if (!origin) return;
    if (favCache[origin]) {
      delete favCache[origin];
      GM_setValue(FAVCACHE_KEY, favCache);
    }
  };

  let usageCache = GM_getValue(USAGE_KEY, {});
  const setUsage = (id, count) => { usageCache[id] = count; GM_setValue(USAGE_KEY, usageCache); };

  function normalizeTags(input) {
    if (!input) return [];
    if (Array.isArray(input)) return input.filter(Boolean);
    if (typeof input === 'string') return input.split(/[,\s]+/).map(t => t.trim()).filter(Boolean);
    return [];
  }

  const incrementUsage = id => {
    if (!id) return;
    const next = (usageCache[id] || 0) + 1;
    setUsage(id, next);
  };

  const generateId = prefix => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

  function normalizeSite(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const next = { ...entry };
    if (!next.type) next.type = 'site';
    if (!next.id) next.id = generateId('site');
    if (!Array.isArray(next.tags)) {
      if (typeof next.tags === 'string' && next.tags.trim()) next.tags = next.tags.split(/[,\s]+/).filter(Boolean);
      else next.tags = [];
    }
    if (next.type !== 'site') next.type = 'site';
    next.name = next.name || '';
    next.url = next.url || '';
    return next;
  }

  function getSites() {
    const raw = GM_getValue(STORAGE_KEY, defaultSites);
    const normalized = [];
    let mutated = false;
    for (const item of raw) {
      const norm = normalizeSite(item);
      if (!norm) continue;
      if (item !== norm) mutated = true;
      normalized.push(norm);
    }
    if (!normalized.length) normalized.push(...defaultSites.map(normalizeSite));
    if (mutated) setSites(normalized, true);
    return normalized;
  }

  function setSites(sites, skipNormalize) {
    const list = skipNormalize ? sites : sites.map(normalizeSite).filter(Boolean);
    GM_setValue(STORAGE_KEY, list);
  }

  function pruneUsage(validIds) {
    const next = {};
    let changed = false;
    for (const id of Object.keys(usageCache)) {
      if (validIds.has(id)) next[id] = usageCache[id];
      else changed = true;
    }
    if (changed) {
      usageCache = next;
      GM_setValue(USAGE_KEY, usageCache);
    }
  }

  function getEntries() {
    const sites = getSites();
    return [...sites];
  }

  /* ---------- Root ---------- */
  let host, root;
  function ensureRoot() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'vm-cmd-palette-host';
    host.style.all = 'initial';
    document.documentElement.appendChild(host);
    root = host.attachShadow({ mode: 'open' });
  }

  /* ---------- Palette UI ---------- */
  const DEFAULT_PLACEHOLDER = 'サイト名やURLで検索… Enterで開く / Shift+Enterで新規タブ';
  let overlayEl, inputEl, listEl, hintEl, toastEl, hintLeftSpan;
  let isOpen = false, currentItems = [], activeIndex = 0;
  let cachedSettings = null;

  // オートコンプリート関連の変数
  let autocompleteEl, autocompleteItems = [], autocompleteIndex = -1;
  let isAutocompleteVisible = false;

  function ensurePalette() {
    ensureRoot();
    if (overlayEl) return;
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .overlay { position: fixed; inset: 0; background: var(--overlay-bg); display: none; z-index: 2147483647; backdrop-filter: blur(1px); opacity: 0; transition: opacity 160ms ease; }
      .overlay.visible { opacity: 1; }
      .panel { position: absolute; left: 50%; top: 16%; transform: translateX(-50%); width: min(720px, 92vw); background: var(--panel-bg); color: var(--panel-text); border-radius: 14px; box-shadow: var(--panel-shadow); overflow: hidden; font-family: ui-sans-serif, -apple-system, system-ui, Segoe UI, Roboto, 'Helvetica Neue', Arial, 'Apple Color Emoji','Segoe UI Emoji'; border: 1px solid var(--border-color); opacity: 0; transform: translate(-50%, calc(-8px)); transition: opacity 200ms ease, transform 200ms ease; }
      .overlay.visible .panel { opacity: 1; transform: translate(-50%, 0); }
      .input { width: 100%; box-sizing: border-box; padding: 14px 16px; font-size: 15px; background: var(--input-bg); color: var(--input-text); border: none; outline: none; }
      .input::placeholder { color: var(--input-placeholder); }
      .hint { padding: 6px 12px; font-size: 12px; color: var(--muted); border-top: 1px solid var(--border-color); background: var(--hint-bg); display: flex; align-items: center; justify-content: space-between; }
      .link { cursor: pointer; color: var(--accent-color); }
      .list { max-height: min(80vh, 1037px); overflow-y: auto; overflow-x: hidden; scrollbar-width: none; }
      .list::-webkit-scrollbar { width: 0; height: 0; }
      .item { display: grid; grid-template-columns: 28px 1fr auto; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer; transition: background 0.12s ease, transform 0.12s ease; }
      .item:nth-child(odd) { background: var(--item-bg-alt); }
      .item.active { background: var(--item-active); transform: translateX(2px); }
      .item .name { font-size: 14px; display: flex; align-items: center; gap: 6px; }
      .item .name .command-badge { margin-left: 0; }
      .item .url { font-size: 12px; color: var(--muted); }
      .item img.ico { width: 18px; height: 18px; border-radius: 4px; object-fit: contain; background: #fff; border: 1px solid var(--border-color); }
      .item .ico-letter { width: 18px; height: 18px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--hint-bg); color: var(--panel-text); font-size: 10px; font-weight: 600; display: flex; align-items: center; justify-content: center; text-transform: uppercase; }
      .item .tag-badges { display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; }
      .tag { display: inline-flex; align-items: center; padding: 2px 6px; background: var(--tag-bg); color: var(--tag-text); font-size: 10px; border-radius: 999px; }
      .tag::before { content: '#'; opacity: 0.7; margin-right: 2px; }
      .empty { padding: 18px 14px; color: var(--muted); font-size: 14px; }
      .kbd { display: inline-block; padding: 2px 6px; border-radius: 6px; background: var(--hint-bg); border: 1px solid var(--border-color); font-size: 12px; color: var(--input-text); }
      .command-badge { margin-left: 6px; padding: 2px 6px; border-radius: 6px; background: var(--command-badge-bg); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--panel-text); }
      .group-title { padding: 8px 16px 4px; font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }

      /* Manager / Settings */
      .mgr-overlay, .set-overlay { position: fixed; inset: 0; background: var(--overlay-bg); display: none; z-index: 2147483647; }
      .mgr, .set { position: absolute; left: 50%; top: 8%; transform: translateX(-50%); width: min(860px, 94vw); background: var(--panel-bg); color: var(--panel-text); border-radius: 14px; box-shadow: var(--panel-shadow); font-family: ui-sans-serif, -apple-system, system-ui, Segoe UI, Roboto, 'Helvetica Neue', Arial, 'Apple Color Emoji','Segoe UI Emoji'; border: 1px solid var(--border-color); }
      .mgr header, .set header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--border-color); }
      .mgr header h3, .set header h3 { margin: 0; font-size: 16px; }
      .mgr-tabs { display: flex; gap: 8px; margin-bottom: 10px; }
      .tab-btn { flex: none; }
      .tab-btn.active { box-shadow: inset 0 0 0 2px rgba(255,255,255,0.12); }
      .mgr-tab.hidden { display: none; }
      .mgr .tbl { width: 100%; border-collapse: collapse; font-size: 14px; }
      .mgr .tbl th, .mgr .tbl td { border-bottom: 1px solid var(--border-color); padding: 8px 10px; vertical-align: top; }
      .mgr .tbl th { text-align: left; color: var(--muted); font-weight: 600; }
      .mgr input[type=text], .mgr textarea, .set input[type=text], .set textarea, .set select, .set input[type=color] { width: 100%; box-sizing: border-box; padding: 6px 8px; font-size: 14px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--input-text); border-radius: 8px; }
      .mgr textarea { resize: vertical; min-height: 56px; }
      .mgr .row-btns button { margin-right: 6px; }
      .btn { padding: 6px 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--panel-text); cursor: pointer; transition: transform 0.12s ease, box-shadow 0.12s ease; }
      .btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,0,0,0.18); }
      .btn.primary { background: var(--accent-color); border-color: var(--accent-color); color: #fff; }
      .btn.danger { background: #7f1d1d; border-color: #7f1d1d; color: #fee2e2; }
      .mgr footer, .set footer { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; }
      .muted { color: var(--muted); font-size: 12px; }
      .drag { cursor: grab; }
      .form-row { display: grid; grid-template-columns: 200px 1fr; gap: 12px; align-items: center; padding: 10px 14px; }
      .inline { display: flex; gap: 12px; align-items: center; }
      .hotkey-box { text-align: center; font-size: 14px; padding: 8px 10px; border: 1px dashed var(--border-color); border-radius: 8px; user-select: none; background: var(--input-bg); color: var(--input-text); }
      .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 11px; background: var(--command-badge-bg); color: var(--panel-text); }
      .toast { position: fixed; inset: auto 0 24px 0; display: none; justify-content: center; pointer-events: none; }
      .toast-message { background: var(--toast-bg); color: var(--toast-text); padding: 10px 16px; border-radius: 999px; box-shadow: 0 10px 20px rgba(0,0,0,0.2); animation: fade-slide 2.4s ease forwards; }
      @keyframes fade-slide {
        0% { opacity: 0; transform: translateY(18px); }
        10% { opacity: 1; transform: translateY(0); }
        90% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(12px); }
      }

      /* タグオートコンプリート */
      .autocomplete-container { position: relative; }
      .autocomplete-list { position: absolute; top: 100%; left: 0; right: 0; background: var(--panel-bg); border: 1px solid var(--border-color); border-top: none; border-radius: 0 0 8px 8px; max-height: 200px; overflow-y: auto; z-index: 2147483647; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
      .autocomplete-item { padding: 8px 12px; cursor: pointer; font-size: 14px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 8px; }
      .autocomplete-item:last-child { border-bottom: none; }
      .autocomplete-item:hover, .autocomplete-item.active { background: var(--item-active); }
      .autocomplete-tag { background: var(--tag-bg); color: var(--tag-text); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
      .autocomplete-count { margin-left: auto; color: var(--muted); font-size: 12px; }
    `;

    overlayEl = document.createElement('div');
    overlayEl.className = 'overlay';

    const panel = document.createElement('div');
    panel.className = 'panel';

    inputEl = document.createElement('input');
    inputEl.className = 'input';
    inputEl.type = 'text';
    inputEl.placeholder = DEFAULT_PLACEHOLDER;

    listEl = document.createElement('div');
    listEl.className = 'list';

    hintEl = document.createElement('div');
    hintEl.className = 'hint';
    hintLeftSpan = document.createElement('span');
    hintLeftSpan.textContent = '↑↓: 移動 / Enter: 開く / Shift+Enter: 新規タブ / Tab: タグ選択 / Esc: 閉じる';
    const rightSpan = document.createElement('span');
    rightSpan.innerHTML = '<span class="link" id="vm-open-manager">サイトマネージャを開く</span> · <span class="link" id="vm-open-settings">設定</span> · ⌘P / Ctrl+P';
    hintEl.appendChild(hintLeftSpan); hintEl.appendChild(rightSpan);

    panel.appendChild(inputEl);
    panel.appendChild(listEl);
    panel.appendChild(hintEl);

    overlayEl.appendChild(panel);
    ensureToast();
    root.appendChild(style);
    root.appendChild(overlayEl);
    cachedSettings = getSettings();
    applyTheme();

    overlayEl.addEventListener('click', e => { if (e.target === overlayEl) hidePalette(); });
    inputEl.addEventListener('keydown', onInputKey);
    inputEl.addEventListener('input', renderList);

    hintEl.addEventListener('click', e => {
      const id = (e.target).id;
      if (id === 'vm-open-manager') openManager();
      if (id === 'vm-open-settings') openSettings();
    });

    buildManager();
    buildSettings();
    buildAutocomplete();
  }

  function buildAutocomplete() {
    const container = document.createElement('div');
    container.className = 'autocomplete-container';
    container.style.position = 'relative';
    
    autocompleteEl = document.createElement('div');
    autocompleteEl.className = 'autocomplete-list';
    autocompleteEl.style.display = 'none';
    
    // 元の入力欄をコンテナに移動（複製しない）
    inputEl.parentNode.replaceChild(container, inputEl);
    container.appendChild(inputEl);
    container.appendChild(autocompleteEl);

    // オートコンプリートのイベントリスナーを追加
    inputEl.addEventListener('input', handleAutocompleteInput);
    inputEl.addEventListener('keydown', handleAutocompleteKeydown);
    inputEl.addEventListener('blur', () => {
      setTimeout(() => hideAutocomplete(), 300);
    });

    // オートコンプリート要素自体のマウスイベントを追加
    autocompleteEl.addEventListener('mousedown', (e) => {
      e.preventDefault(); // クリック時のblurを防ぐ
    });
  }

  function handleAutocompleteInput() {
    const value = inputEl.value;
    
    // オートコンプリートの表示を少し遅らせて競合を防ぐ
    setTimeout(() => {
      // 空白が含まれている場合はタグフィルタリングモードではないので非表示
      if (value.includes(' ')) {
        hideAutocomplete();
        return;
      }
      
      // #が含まれている場合、オートコンプリートを表示
      if (value.includes('#')) {
        const afterHash = value.slice(value.indexOf('#') + 1);
        showAutocomplete(afterHash);
      } else {
        hideAutocomplete();
      }
    }, 10);
  }

  function handleAutocompleteKeydown(e) {
    if (!isAutocompleteVisible) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      autocompleteIndex = (autocompleteIndex + 1) % autocompleteItems.length;
      updateAutocompleteActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      autocompleteIndex = (autocompleteIndex - 1 + autocompleteItems.length) % autocompleteItems.length;
      updateAutocompleteActive();
    } else if (e.key === 'Enter' && autocompleteIndex >= 0) {
      e.preventDefault();
      selectAutocompleteItem(autocompleteItems[autocompleteIndex]);
    } else if (e.key === 'Escape') {
      hideAutocomplete();
    }
  }

  function showAutocomplete(query) {
    const allTags = getAllTags();
    const entries = getEntries();
    
    // 各タグの使用数を計算
    const tagCounts = {};
    entries.forEach(entry => {
      if (entry.tags) {
        entry.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });
    
    // 階層タグ用のフィルタリングロジック
    let filteredTags = [];
    
    if (query.includes('/')) {
      // スラッシュがある場合は階層検索
      const parts = query.split('/');
      const parentQuery = parts.slice(0, -1).join('/');
      const childQuery = parts[parts.length - 1];
      
      filteredTags = allTags.filter(tag => {
        // 親階層が一致し、かつ子階層がクエリに部分一致するタグを検索
        if (tag.startsWith(parentQuery + '/')) {
          const childPart = tag.slice(parentQuery.length + 1);
          return childPart.toLowerCase().includes(childQuery.toLowerCase());
        }
        return false;
      });
    } else {
      // スラッシュがない場合は通常の部分一致検索
      filteredTags = allTags.filter(tag => 
        tag.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    // 階層レベルに基づいてソート（浅い階層を優先）
    filteredTags.sort((a, b) => {
      const aDepth = (a.match(/\//g) || []).length;
      const bDepth = (b.match(/\//g) || []).length;
      if (aDepth !== bDepth) return aDepth - bDepth;
      return a.localeCompare(b);
    });
    
    const filteredTagObjects = filteredTags.map(tag => ({
      name: tag,
      count: tagCounts[tag] || 0
    }));
    
    // フィルタリング結果が空の場合でもオートコンプリートを表示する
    if (filteredTagObjects.length === 0) {
      autocompleteItems = [];
      autocompleteIndex = -1;
      isAutocompleteVisible = true;
      
      // オートコンプリートリストを更新
      autocompleteEl.innerHTML = '';
      const emptyItem = document.createElement('div');
      emptyItem.className = 'autocomplete-item';
      emptyItem.textContent = '該当するタグがありません';
      emptyItem.style.color = 'var(--muted)';
      emptyItem.style.cursor = 'default';
      emptyItem.addEventListener('click', (e) => e.preventDefault()); // クリックを無効化
      autocompleteEl.appendChild(emptyItem);
      
      autocompleteEl.style.display = 'block';
      updateAutocompleteActive();
      return;
    }
    
    autocompleteItems = filteredTagObjects;
    autocompleteIndex = 0;
    isAutocompleteVisible = true;
    
    // オートコンプリートリストを更新
    autocompleteEl.innerHTML = '';
    filteredTagObjects.forEach((tag, index) => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.dataset.index = index;
      
      // 階層表示用のインデントを計算
      const depth = (tag.name.match(/\//g) || []).length;
      const displayName = tag.name.split('/').pop(); // 最後の部分のみ表示
      const fullPath = tag.name;
      
      item.innerHTML = `
        <span class="autocomplete-tag" style="margin-left: ${depth * 8}px">${escapeHtml(displayName)}</span>
        <span class="autocomplete-count">${tag.count}件</span>
        <div style="font-size: 10px; color: var(--muted); margin-top: 2px;">${escapeHtml(fullPath)}</div>
      `;
      
      item.addEventListener('click', () => selectAutocompleteItem(tag));
      item.addEventListener('mouseenter', () => {
        autocompleteIndex = index;
        updateAutocompleteActive();
      });
      
      autocompleteEl.appendChild(item);
    });
    
    autocompleteEl.style.display = 'block';
    updateAutocompleteActive();
  }

  function hideAutocomplete() {
    isAutocompleteVisible = false;
    autocompleteIndex = -1;
    autocompleteEl.style.display = 'none';
  }

  function updateAutocompleteActive() {
    const items = autocompleteEl.querySelectorAll('.autocomplete-item');
    items.forEach((item, index) => {
      item.classList.toggle('active', index === autocompleteIndex);
    });
  }

  function selectAutocompleteItem(tag) {
    const currentValue = inputEl.value;
    const hashIndex = currentValue.indexOf('#');
    
    if (hashIndex >= 0) {
      const beforeHash = currentValue.slice(0, hashIndex);
      inputEl.value = beforeHash + '#' + tag.name + ' ';
    } else {
      inputEl.value = '#' + tag.name + ' ';
    }
    
    hideAutocomplete();
    inputEl.focus();
    
    // タグ選択後はどの項目もアクティブにしない
    activeIndex = -1;
    renderList();
    updateActive();
  }

  function openPalette() {
    ensurePalette();
    cachedSettings = getSettings();
    applyTheme();
    isOpen = true;
    overlayEl.style.display = 'block';
    requestAnimationFrame(() => overlayEl.classList.add('visible'));
    inputEl.value = '';
    inputEl.placeholder = DEFAULT_PLACEHOLDER;
    activeIndex = 0;
    renderList();
    cachedSettings = getSettings();
    setTimeout(() => inputEl.focus(), 0);
  }
  function hidePalette() {
    isOpen = false;
    if (!overlayEl) return;
    overlayEl.classList.remove('visible');
    setTimeout(() => { if (!isOpen) overlayEl.style.display = 'none'; }, 180);
  }

  function onInputKey(e) {
    if (e.isComposing || e.keyCode === 229) {
      return;
    }
    
    // オートコンプリート表示中のキーボード操作を優先
    if (isAutocompleteVisible) {
      if (e.key === 'Escape') {
        e.preventDefault();
        hideAutocomplete();
        return;
      }
      // オートコンプリートのキーボード操作は handleAutocompleteKeydown で処理される
      return;
    }
    
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      runBingSearchFromInput();
      return;
    }
    if (e.key === 'Escape') { hidePalette(); return; }
    
    // タグフィルタリングのショートカットキー
    if (e.key === 'Tab' && !e.shiftKey && inputEl.value.trim() === '') {
      e.preventDefault();
      const allTags = getAllTags();
      if (allTags.length > 0) {
        inputEl.value = '#' + allTags[0] + ' ';
        renderList();
        showAutocomplete(allTags[0]);
      }
      return;
    }
    
    if (!currentItems.length) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = (inputEl.value || '').trim();
        if (!q) {
          showToast('検索キーワードを入力してください');
          return;
        }
        openUrlWithPreference(`https://www.bing.com/search?q=${encodeURIComponent(q)}`);
      }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = (activeIndex + 1) % currentItems.length; updateActive(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = (activeIndex - 1 + currentItems.length) % currentItems.length; updateActive(); }
    else if (e.key === 'Enter') { e.preventDefault(); const item = currentItems[activeIndex]; openItem(item, e.shiftKey); }
  }

  const normalize = s => (s || '').toLowerCase();
  function extractTagFilter(query) {
    const trimmed = query.trim();
    if (!trimmed.startsWith('#')) return { tagFilter: null, textQuery: query };
    const parts = trimmed.split(/\s+/);
    const first = parts.shift();
    const tag = normalize(first.slice(1));
    return { tagFilter: tag || null, textQuery: parts.join(' ') };
  }

  // すべてのタグを取得する関数
  function getAllTags() {
    const entries = getEntries();
    const tagSet = new Set();
    entries.forEach(entry => {
      if (entry.tags && Array.isArray(entry.tags)) {
        entry.tags.forEach(tag => {
          if (tag && tag.trim()) {
            tagSet.add(tag.trim());
          }
        });
      }
    });
    return Array.from(tagSet).sort();
  }

  function getUsageBoost(entry) {
    if (!entry || !entry.id) return 0;
    const count = usageCache[entry.id] || 0;
    return Math.min(8, Math.log(count + 1) * 3);
  }

  function scoreEntries(entries, query) {
    const base = entries.map(e => ({ entry: e, score: 0 }));
    if (!query) {
      base.forEach(item => { item.score = 0.0001 + getUsageBoost(item.entry); });
    } else {
      const matcher = createFuzzyMatcher(query);
      base.forEach(item => {
        const entry = item.entry;
        const score = Math.max(
          matcher(entry.name || ''),
          matcher(entry.url || '') - 4,
          matcher((entry.tags || []).join(' ')) - 2
        );
        item.score = score === -Infinity ? -Infinity : score + getUsageBoost(entry);
      });
    }

    const filtered = base.filter(item => item.score > -Infinity);
    filtered.sort((a,b) => b.score - a.score);

    return filtered.map(item => item.entry);
  }

  function createFuzzyMatcher(query) {
    const q = normalize(query);
    const chars = q.split('');
    const regex = new RegExp(chars.map(c => escapeRegex(c)).join('.*?'), 'i');
    return text => {
      if (!text) return -Infinity;
      const lower = normalize(text);
      if (lower.includes(q)) {
        const index = lower.indexOf(q);
        return 40 - index * 1.5;
      }
      if (!regex.test(text)) return -Infinity;
      let score = 20;
      score -= lower.length * 0.02;
      if (lower.startsWith(chars[0])) score += 6;
      return score;
    };
  }

  function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function ensureToast() {
    if (toastEl) return;
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    root.appendChild(toastEl);
  }

  function showToast(message) {
    ensureToast();
    toastEl.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'toast-message';
    msg.textContent = message;
    toastEl.appendChild(msg);
    toastEl.style.display = 'flex';
    setTimeout(() => { if (toastEl.contains(msg)) toastEl.removeChild(msg); toastEl.style.display = 'none'; }, 2400);
  }

  function applyTheme() {
    if (!root) return;
    const settings = cachedSettings || getSettings();
    const theme = themes[settings.theme] || themes.dark;
    const vars = { ...theme, '--accent-color': settings.accentColor || defaultSettings.accentColor };
    const docStyle = root.host ? root.host.style : null;
    if (!docStyle) return;
    Object.entries(vars).forEach(([key, value]) => { docStyle.setProperty(key, value); });
  }

  function renderList() {
    const rawQuery = inputEl.value || '';
    const { tagFilter, textQuery } = extractTagFilter(rawQuery);
    const q = normalize(textQuery);
    const entries = getEntries();
    const filtered = tagFilter ? entries.filter(e => (e.tags || []).some(t => normalize(t) === tagFilter)) : entries;
    const scored = scoreEntries(filtered, q);
    if (scored.length) {
      if (activeIndex >= scored.length) activeIndex = scored.length - 1;
      if (activeIndex < 0) activeIndex = 0;
    } else {
      activeIndex = 0;
    }

    listEl.innerHTML = '';
    if (!scored.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = q || tagFilter ? '一致なし' : 'サイトが登録されていません。サイトマネージャで追加してください。';
      listEl.appendChild(empty); return;
    }

    scored.forEach((entry, idx) => {
      const item = document.createElement('div');
      item.className = 'item';
      item.dataset.index = idx;
      item.addEventListener('mouseenter', () => { activeIndex = idx; updateActive(); });
      item.addEventListener('mousedown', e => e.preventDefault());
      item.addEventListener('click', () => { openItem(entry, false); });

      const icon = createFaviconEl(entry);

      const left = document.createElement('div');
      left.className = 'left';
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = entry.name || '(no title)';
      left.appendChild(name);

      if (entry.url) {
        const url = document.createElement('div');
        url.className = 'url';
        url.textContent = entry.url;
        left.appendChild(url);
      }

      if (entry.tags && entry.tags.length) {
        const tags = document.createElement('div');
        tags.className = 'tag-badges';
        entry.tags.forEach(tag => {
          const span = document.createElement('span');
          span.className = 'tag';
          span.textContent = tag;
          tags.appendChild(span);
        });
        left.appendChild(tags);
      }

      const right = document.createElement('div'); right.innerHTML = '<span class="kbd">↵</span>';

      item.appendChild(icon); item.appendChild(left); item.appendChild(right);
      listEl.appendChild(item);
    });

    currentItems = scored;
    updateActive();
  }
  function updateActive() {
    const items = listEl.querySelectorAll('.item');
    items.forEach((el, idx) => {
      el.classList.toggle('active', idx === activeIndex);
    });
  }
  function openItem(item, shiftPressed) {
    executeEntry(item, shiftPressed);
  }

  function executeEntry(entry, shiftPressed, query) {
    if (!entry) return;
    const settings = getSettings();
    const preferNew = settings.enterOpens === 'newtab';
    const openNew = shiftPressed ? !preferNew : preferNew;

    let targetUrl = entry.url;
    if (entry.url && entry.url.includes('%s')) {
      const q = query !== undefined ? query : inputEl.value.trim();
      if (!q) {
        inputEl.value = '';
        inputEl.placeholder = `${entry.name} に検索キーワードを入力…`;
        showToast('検索キーワードを入力してください');
        inputEl.focus();
        return;
      }
      targetUrl = entry.url.replace(/%s/g, encodeURIComponent(q));
    }

    hidePalette();
    incrementUsage(entry.id);
    openUrlWithPreference(targetUrl, openNew ? 'newtab' : 'same');
  }

  function runAddCurrent() {
    const title = document.title || location.hostname;
    const url = location.href;
    const existing = getSites();
    const newSite = { id: generateId('site'), type: 'site', name: title, url, tags: [] };
    setSites([...existing, newSite]);
    pruneUsage(new Set([...existing.map(s => s.id), newSite.id]));
    showToast('現在のページを登録しました');
    renderList();
  }

  function copyUrl() {
    try {
      GM_setClipboard(location.href);
      showToast('URLをコピーしました');
    } catch {
      navigator.clipboard?.writeText(location.href);
      showToast('URLをコピーしました');
    }
  }

  function runBingSearch(shiftPressed, entry, query) {
    const keywords = (query || '').trim();
    if (!keywords) {
      showToast('検索キーワードを入力してください');
      return;
    }
    const mode = shiftPressed ? 'newtab' : 'auto';
    openUrlWithPreference(`https://www.bing.com/search?q=${encodeURIComponent(keywords)}`, mode);
  }

  function runBingSearchFromInput() {
    const q = (inputEl.value || '').trim();
    if (!q) {
      showToast('検索キーワードを入力してください');
      return;
    }
    openUrlWithPreference(`https://www.bing.com/search?q=${encodeURIComponent(q)}`);
  }

  function openUrlWithPreference(url, mode = 'auto') {
    hidePalette();
    const settings = getSettings();
    const openNew = mode === 'newtab' ? true : mode === 'same' ? false : mode === 'command' ? true : settings.enterOpens === 'newtab';
    if (openNew) {
      try { GM_openInTab(url, { active: true, insert: true }); }
      catch { window.open(url, '_blank'); }
    } else {
      try { location.assign(url); }
      catch { location.href = url; }
    }
  }

  // favicon helper
  function createFaviconEl(entry) {
    const wrap = document.createElement('div');
    wrap.style.width = '20px';
    wrap.style.height = '20px';
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';

    const img = document.createElement('img');
    img.className = 'ico';
    img.decoding = 'async';

    let origin;
    const url = entry.url;
    try { origin = new URL(url).origin; } catch { origin = null; }

    const cached = origin && favCache[origin];
    if (cached) {
      img.onload = () => wrap.appendChild(img);
      img.onerror = () => { clearFavCacheOrigin(origin); trySimple(); };
      img.src = cached;
      return wrap;
    }

    if (origin) {
      discoverFavicon(origin, href => {
        if (href) {
          img.onload = () => { setFavCache(origin, href); wrap.appendChild(img); };
          img.onerror = () => { clearFavCacheOrigin(origin); trySimple(); };
          img.src = href;
        } else {
          trySimple();
        }
      });
    } else {
      trySimple();
    }

    function trySimple() {
      const list = (() => {
        if (!origin) return [];
        const simple = [
          '/favicon.ico',
          '/favicon.svg',
          '/favicon.png',
          '/apple-touch-icon.png',
          '/apple-touch-icon-precomposed.png'
        ].map(p => origin + p);
        const external = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(origin)}&sz=64`;
        return [external, ...simple];
      })();
      let i = 0;
      function next() { if (i >= list.length) return fallback(); img.src = list[i++]; }
      img.onload = () => { if (origin) setFavCache(origin, img.src); wrap.appendChild(img); };
      img.onerror = () => { if (origin) clearFavCacheOrigin(origin); next(); };
      next();
    }

    function fallback() {
      const letter = document.createElement('div');
      letter.className = 'ico-letter';
      const text = (entry.name || '').trim();
      const first = text ? text[0] : (origin ? origin.replace(/^https?:\/\//,'')[0] : '?');
      letter.textContent = (first || '?').toUpperCase();
      wrap.appendChild(letter);
    }

    return wrap;
  }

  function discoverFavicon(origin, done) {
    const isDark = (() => {
      try { return (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) || document.documentElement.classList.contains('dark') || document.documentElement.dataset.colorMode === 'dark'; }
      catch { return false; }
    })();

    GM_xmlhttpRequest({
      method: 'GET', url: origin + '/',
      onload: res => {
        try {
          const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
          const links = [...doc.querySelectorAll('link[rel~="icon" i], link[rel="shortcut icon" i], link[rel~="mask-icon" i], link[rel~="apple-touch-icon" i]')];
          if (!links.length) return done(null);
          function mediaMatch(m) { try { return m ? matchMedia(m).matches : true; } catch { return true; } }
          function score(link) {
            const rel = (link.getAttribute('rel') || '').toLowerCase();
            const href = link.getAttribute('href') || '';
            const type = (link.getAttribute('type') || '').toLowerCase();
            const sizes = (link.getAttribute('sizes') || '').toLowerCase();
            const media = (link.getAttribute('media') || '').trim();
            let s = 0;
            if (rel.includes('icon')) s += 10;
            if (href.includes('favicon')) s += 6;
            if (type.includes('svg')) s += 5;
            if (sizes.includes('32x32')) s += 3;
            if (media) s += mediaMatch(media) ? 8 : -20;
            if (isDark) { if (/dark/i.test(href)) s += 5; if (/light/i.test(href)) s -= 2; }
            else { if (/light/i.test(href)) s += 3; if (/dark/i.test(href)) s -= 2; }
            return s;
          }
          const best = links.map(l => ({ l, s: score(l) })).sort((a,b) => b.s - a.s)[0];
          if (!best) return done(null);
          const abs = new URL(best.l.getAttribute('href'), origin).href;
          return done(abs);
        } catch {}
        done(null);
      },
      onerror: () => done(null)
    });
  }

  /* ---------- Manager ---------- */
  let mgrOverlay, mgrBox, siteBodyEl;
  function buildManager() {
    mgrOverlay = document.createElement('div');
    mgrOverlay.className = 'mgr-overlay';
    mgrOverlay.addEventListener('click', e => { if (e.target === mgrOverlay) closeManager(); });

    mgrBox = document.createElement('div');
    mgrBox.className = 'mgr';
    mgrBox.innerHTML = `
      <header>
        <h3>サイトマネージャ</h3>
        <div>
          <button class="btn" id="vm-export">エクスポート</button>
          <button class="btn" id="vm-import">インポート</button>
          <button class="btn primary" id="vm-save">保存</button>
          <button class="btn" id="vm-close">閉じる</button>
        </div>
      </header>
      <input type="file" id="vm-import-file" accept="application/json" style="display:none">
      <div style="padding:10px 14px">
        <table class="tbl">
          <thead>
            <tr><th style="width:36px"></th><th>名前</th><th>URL</th><th>タグ</th><th style="width:220px">操作</th></tr>
          </thead>
          <tbody id="vm-rows-sites"></tbody>
        </table>
        <div style="padding:12px 0"><button class="btn" id="vm-add-site">行を追加</button></div>
      </div>
      <footer>
        <span class="muted">上下ボタンで並べ替え。保存すると即時反映。</span>
        <span class="muted">Ctrl/⌘S で保存、Esc で閉じる</span>
      </footer>`;

    mgrOverlay.appendChild(mgrBox);
    root.appendChild(mgrOverlay);

    siteBodyEl = mgrBox.querySelector('#vm-rows-sites');

    mgrBox.querySelector('#vm-add-site').addEventListener('click', () => addSiteRow({ name:'', url:'', tags:[] }));
    mgrBox.querySelector('#vm-save').addEventListener('click', saveManager);
    mgrBox.querySelector('#vm-close').addEventListener('click', closeManager);
    mgrBox.querySelector('#vm-export').addEventListener('click', exportSites);
    const importInput = mgrBox.querySelector('#vm-import-file');
    mgrBox.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveManager(); }
      if (e.key === 'Escape') { e.preventDefault(); closeManager(); }
    });
    mgrBox.querySelector('#vm-import').addEventListener('click', () => {
      if (!importInput) return;
      importInput.value = '';
      importInput.click();
    });
    if (importInput) {
      importInput.addEventListener('change', () => {
        const file = importInput.files && importInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          importSitesFromJson(typeof reader.result === 'string' ? reader.result : '');
        };
        reader.onerror = () => {
          showToast('ファイルの読み込みに失敗しました');
        };
        try {
          reader.readAsText(file, 'utf-8');
        } catch (err) {
          console.error('[CommandPalette] import read error', err);
          showToast('ファイルの読み込みに失敗しました');
        }
      });
    }
  }

  function exportSites() {
    const sites = getSites();
    const json = JSON.stringify(sites, null, 2);
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `sites-backup-${stamp}.json`;
    if (downloadTextFile(filename, json)) {
      showToast('エクスポートファイルをダウンロードしました');
    } else {
      showToast('エクスポートに失敗しました');
    }
  }

  function downloadTextFile(filename, text) {
    try {
      const blob = new Blob([text], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return true;
    } catch (e) {
      console.error('[CommandPalette] export failed', e);
      return false;
    }
  }

  function importSitesFromJson(jsonText) {
    if (!jsonText) {
      showToast('無効なJSONです');
      return;
    }
    try {
      const arr = JSON.parse(jsonText);
      if (!Array.isArray(arr)) throw new Error('not array');
      setSites(arr);
      pruneUsage(new Set(getEntries().map(e => e.id)));
      renderManager();
      showToast('読み込みました');
    } catch (err) {
      console.error('[CommandPalette] import parse error', err);
      showToast('無効なJSONです');
    }
  }

  function openManager() { ensurePalette(); renderManager(); mgrOverlay.style.display = 'block'; setTimeout(function(){ var i = mgrBox.querySelector('input'); if (i) i.focus(); }, 0); }
  function closeManager() { mgrOverlay.style.display = 'none'; }
  function renderManager() {
    siteBodyEl.innerHTML = '';
    getSites().forEach(s => addSiteRow({ ...s }));
  }

  function addSiteRow(data) {
    const tr = document.createElement('tr');
    if (data.id) tr.dataset.entryId = data.id;
    tr.innerHTML = `
      <td class="drag">⋮⋮</td>
      <td><input type="text" data-field="name" value="${escapeHtml(data.name || '')}"/></td>
      <td><input type="text" data-field="url" placeholder="https://example.com/" value="${escapeHtml(data.url || '')}"/></td>
      <td><input type="text" data-field="tags" placeholder="カンマ区切り" value="${escapeHtml((data.tags || []).join(', '))}"/></td>
      <td class="row-btns">
        <button class="btn" data-up>↑</button>
        <button class="btn" data-down>↓</button>
        <button class="btn" data-test>テスト</button>
        <button class="btn danger" data-del>削除</button>
      </td>`;

    const urlI = tr.querySelector('input[data-field="url"]');
    tr.querySelector('[data-up]').addEventListener('click', ()=> moveRow(tr, -1, siteBodyEl));
    tr.querySelector('[data-down]').addEventListener('click', ()=> moveRow(tr, +1, siteBodyEl));
    tr.querySelector('[data-del]').addEventListener('click', ()=> { tr.remove(); });
    tr.querySelector('[data-test]').addEventListener('click', ()=> {
      const u = urlI.value.trim();
      if (u) window.open(u.includes('%s') ? u.replace(/%s/g, encodeURIComponent('test')) : u, '_blank');
    });

    siteBodyEl.appendChild(tr);
  }

  function moveRow(tr, delta, container) {
    const rows = [...container.children];
    const i = rows.indexOf(tr); if (i < 0) return;
    const ni = Math.min(rows.length - 1, Math.max(0, i + delta));
    if (ni === i) return;
    if (delta < 0) container.insertBefore(tr, rows[ni]); else container.insertBefore(tr, rows[ni].nextSibling);
  }
  function saveManager() {
    const previousSites = getSites();

    const sites = [...siteBodyEl.querySelectorAll('tr')].map((tr, index) => {
      const name = tr.querySelector('input[data-field="name"]').value.trim();
      const url = tr.querySelector('input[data-field="url"]').value.trim();
      const tags = tr.querySelector('input[data-field="tags"]').value.split(/[,\s]+/).map(t => t.trim()).filter(Boolean);
      if (!name || !url) return null;
      const existing = tr.dataset.entryId && previousSites.find(s => s.id === tr.dataset.entryId);
      const id = existing ? existing.id : (tr.dataset.entryId || generateId('site'));
      return { id, type: 'site', name, url, tags };
    }).filter(Boolean);

    setSites(sites);
    pruneUsage(new Set([...sites.map(s => s.id)]));
    showToast('保存しました');
    renderList();
  }

  /* ---------- Settings UI ---------- */
  let setOverlay, setBox;
  function buildSettings() {
    setOverlay = document.createElement('div');
    setOverlay.className = 'set-overlay';
    setOverlay.addEventListener('click', e => { if (e.target === setOverlay) closeSettings(); });

    setBox = document.createElement('div');
    setBox.className = 'set';
    setBox.innerHTML = `
      <header>
        <h3>設定</h3>
        <div>
          <button class="btn primary" id="vs-save">保存</button>
          <button class="btn" id="vs-close">閉じる</button>
        </div>
      </header>
      <div class="form-row">
        <div>ホットキー（メイン）</div>
        <div class="inline"><input id="vs-hotkey1" type="text" class="hotkey-box" placeholder="押して設定" readonly></div>
      </div>
      <div class="form-row">
        <div>ホットキー（サブ）</div>
        <div class="inline"><input id="vs-hotkey2" type="text" class="hotkey-box" placeholder="押して設定" readonly></div>
      </div>
      <div class="form-row">
        <div>Enter の動作</div>
        <div class="inline">
          <label><input type="radio" name="vs-enter" value="current"> 現在のタブで開く</label>
          <label><input type="radio" name="vs-enter" value="newtab"> 新規タブで開く</label>
          <span class="muted">Shift は逆の動作</span>
        </div>
      </div>
      <div class="form-row">
        <div>テーマ</div>
        <div class="inline">
          <label><input type="radio" name="vs-theme" value="dark"> ダーク</label>
          <label><input type="radio" name="vs-theme" value="light"> ライト</label>
        </div>
      </div>
      <div class="form-row">
        <div>アクセントカラー</div>
        <div class="inline">
          <input type="color" id="vs-accent" value="#2563eb" style="width:60px; height:34px; padding:0; border-radius:8px; border: none;">
          <input type="text" id="vs-accent-text" placeholder="#2563eb" style="width:120px;">
        </div>
      </div>
      <div class="form-row">
        <div>無効にするホスト</div>
        <div>
          <textarea id="vs-blocklist" rows="4" placeholder="例:\n*.example.com\nlocalhost"></textarea>
          <div class="muted">1行1パターン（* ワイルドカード可）。一致するページではパレットは開かない。</div>
        </div>
      </div>
      <div class="form-row">
        <div>自動で開くURL</div>
        <div>
          <textarea id="vs-auto-open" rows="4" placeholder="例:\nhttps://example.com/path\nhttps://*.example.org/"></textarea>
          <div class="muted">1行につき1URL。前方一致（*ワイルドカード可）で一致したページでパレットを自動表示。</div>
        </div>
      </div>
      <footer>
        <div class="inline">
          <button class="btn" id="vs-reset">既定値に戻す</button>
          <button class="btn" id="vs-clear-fav">faviconキャッシュをクリア</button>
        </div>
        <span class="muted">Ctrl/⌘S で保存、Esc で閉じる</span>
      </footer>`;

    setOverlay.appendChild(setBox);
    root.appendChild(setOverlay);

    setBox.querySelector('#vs-close').addEventListener('click', closeSettings);
    setBox.querySelector('#vs-save').addEventListener('click', saveSettingsFromUI);
    setBox.querySelector('#vs-reset').addEventListener('click', () => { applySettingsToUI(defaultSettings); });
    setBox.querySelector('#vs-clear-fav').addEventListener('click', () => {
      favCache = {};
      GM_setValue(FAVCACHE_KEY, favCache);
      showToast('faviconキャッシュを削除しました');
    });

    setBox.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveSettingsFromUI(); }
      if (e.key === 'Escape') { e.preventDefault(); closeSettings(); }
    });

    setupHotkeyCapture(setBox.querySelector('#vs-hotkey1'), 'hotkeyPrimary');
    setupHotkeyCapture(setBox.querySelector('#vs-hotkey2'), 'hotkeySecondary');
    setupAccentSync();
  }

  function openSettings() {
    ensurePalette();
    cachedSettings = getSettings();
    applyTheme();
    applySettingsToUI(cachedSettings);
    setOverlay.style.display = 'block';
  }
  function closeSettings() { setOverlay.style.display = 'none'; }

  function applySettingsToUI(s) {
    setBox.querySelector('#vs-hotkey1').value = labelHotkey(s.hotkeyPrimary);
    setBox.querySelector('#vs-hotkey1').dataset.sig = s.hotkeyPrimary;
    setBox.querySelector('#vs-hotkey2').value = labelHotkey(s.hotkeySecondary);
    setBox.querySelector('#vs-hotkey2').dataset.sig = s.hotkeySecondary;
    [...setBox.querySelectorAll('input[name="vs-enter"]')].forEach(r => r.checked = r.value === s.enterOpens);
    [...setBox.querySelectorAll('input[name="vs-theme"]')].forEach(r => r.checked = r.value === (s.theme || 'dark'));
    const accent = s.accentColor || defaultSettings.accentColor;
    const accentInput = setBox.querySelector('#vs-accent');
    const accentText = setBox.querySelector('#vs-accent-text');
    accentInput.value = normalizeColor(accent);
    accentText.value = normalizeColor(accent);
    setBox.querySelector('#vs-blocklist').value = s.blocklist || '';
    const auto = normalizeAutoOpen(s.autoOpenUrls);
    setBox.querySelector('#vs-auto-open').value = auto.join('\n');
  }

  function saveSettingsFromUI() {
    const s = {
      hotkeyPrimary: setBox.querySelector('#vs-hotkey1').dataset.sig || defaultSettings.hotkeyPrimary,
      hotkeySecondary: setBox.querySelector('#vs-hotkey2').dataset.sig || defaultSettings.hotkeySecondary,
      enterOpens: setBox.querySelector('input[name="vs-enter"]:checked')?.value || 'current',
      theme: setBox.querySelector('input[name="vs-theme"]:checked')?.value || defaultSettings.theme,
      accentColor: normalizeColor(setBox.querySelector('#vs-accent-text').value || setBox.querySelector('#vs-accent').value || defaultSettings.accentColor),
      blocklist: setBox.querySelector('#vs-blocklist').value || '',
      autoOpenUrls: normalizeAutoOpen(setBox.querySelector('#vs-auto-open').value)
    };
    setSettings(s);
    cachedSettings = s;
    applyTheme();
    showToast('設定を保存しました');
  }

  function normalizeColor(value) {
    let v = (value || '').trim();
    if (!v) return defaultSettings.accentColor;
    if (!v.startsWith('#')) v = '#' + v.replace(/^#+/, '');
    if (v.length === 4) v = '#' + v.slice(1).split('').map(ch => ch + ch).join('');
    if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
    return defaultSettings.accentColor;
  }

  function normalizeAutoOpen(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(v => (v || '').trim()).filter(Boolean);
    if (typeof value === 'string') return value.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
    return [];
  }

  function shouldAutoOpen() {
    const { autoOpenUrls = [] } = getSettings();
    if (!Array.isArray(autoOpenUrls) || !autoOpenUrls.length) return false;
    const current = location.href;
    return autoOpenUrls.some(pattern => matchAutoPattern(current, pattern));
  }

  function matchAutoPattern(url, pattern) {
    if (!pattern) return false;
    const parts = pattern.split('*').map(p => p.replace(/[.*+?^${}()|[\]\\]/g, r => '\\' + r));
    const regex = new RegExp('^' + parts.join('.*') + '');
    return regex.test(url);
  }

  function setupAccentSync() {
     const colorInput = setBox.querySelector('#vs-accent');
     const textInput = setBox.querySelector('#vs-accent-text');
     const hexFull = v => /^#?[0-9a-fA-F]{6}$/.test(v.replace(/^#/, ''));
     colorInput.addEventListener('input', () => {
       const val = colorInput.value;
       textInput.value = val;
     });
     textInput.addEventListener('input', () => {
       const raw = textInput.value.trim();
       if (hexFull(raw)) {
         const normalized = normalizeColor(raw);
         colorInput.value = normalized;
       }
     });
     textInput.addEventListener('blur', () => {
       const normalized = normalizeColor(textInput.value);
       textInput.value = normalized;
       colorInput.value = normalized;
     });
   }

  function setupHotkeyCapture(input, field) {
    input.addEventListener('focus', () => { input.value = '任意のキーを押す'; });
    input.addEventListener('blur', () => {
      const sig = input.dataset.sig || getSettings()[field];
      input.value = labelHotkey(sig);
    });
    input.addEventListener('keydown', e => {
      e.preventDefault();
      const mod = e.metaKey ? 'Meta' : e.ctrlKey ? 'Control' : null;
      if (!mod) { input.value = 'Meta/Ctrl を含めて押す'; return; }
      const sig = `${mod}+${e.code}`;
      input.dataset.sig = sig;
      input.value = labelHotkey(sig);
    });
  }

  function labelHotkey(sig) {
    if (!sig) return '';
    const [m, code] = sig.split('+');
    const keyName = code.replace(/^Key/, '').replace(/^Digit/, '');
    const isMac = /mac/i.test(navigator.platform);
    const mod = m === 'Meta' ? (isMac ? '⌘' : 'Win+') : 'Ctrl+';
    return mod + keyName;
  }

  function isBlocked() {
    const s = getSettings();
    const patterns = (s.blocklist || '').split(/\r?\n/).map(t => t.trim()).filter(Boolean);
    if (!patterns.length) return false;
    const host = location.hostname;
    return patterns.some(p => wildcard(host, p));
  }
  function wildcard(str, pattern) {
    const re = new RegExp('^' + pattern.split('*').map(x => x.replace(/[\.^$+?()|{}\[\]]/g, r => '\\' + r)).join('.*') + '$', 'i');
    return re.test(str);
  }

  /* ---------- Hotkey ---------- */
  function matchHotkey(e, sig) {
    if (!sig) return false;
    const [mod, code] = sig.split('+');
    return ((mod === 'Meta' && e.metaKey) || (mod === 'Control' && e.ctrlKey)) && e.code === code && !e.altKey && !e.shiftKey;
  }
  function onGlobalKeydown(e) {
    if (isBlocked()) return; // 無効サイト
    const tag = (e.target && e.target.tagName) || '';
    const editable = ['INPUT','TEXTAREA'].includes(tag) || (e.target && e.target.isContentEditable);
    if (editable) return;
    const s = getSettings();
    if (matchHotkey(e, s.hotkeyPrimary) || matchHotkey(e, s.hotkeySecondary)) { e.preventDefault(); e.stopPropagation(); openPalette(); }
  }
  window.addEventListener('keydown', onGlobalKeydown, true);

  /* ---------- Menu ---------- */
  GM_registerMenuCommand('サイトマネージャを開く', openManager);
  GM_registerMenuCommand('設定', openSettings);

  /* ---------- bootstrap ---------- */
  if (!GM_getValue(STORAGE_KEY)) setSites(defaultSites);
  if (!GM_getValue(SETTINGS_KEY)) setSettings(defaultSettings);

  if (shouldAutoOpen()) {
    setTimeout(() => openPalette(), 120);
  }
})();
