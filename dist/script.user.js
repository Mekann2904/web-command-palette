// ==UserScript==
// @name         Command Palette (Sites Launcher) + Manager
// @namespace    mekann.toolbox
// @version      1.3.1
// @description  ⌘P / Ctrl+P でコマンドパレット。サイトは表形式で管理。設定はUIで編集（ホットキー、Enter動作、ブロックリスト）。アイコンは可能な限りファビコン自動取得。
// @author       mekann
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


(function () {
    'use strict';

    /**
     * グローバル状態の初期化
     */
    const createInitialState = () => ({
        isOpen: false,
        currentItems: [],
        activeIndex: 0,
        cachedSettings: null
    });
    /**
     * DOM要素の初期化
     */
    const createInitialDOMElements = () => ({
        host: null,
        root: null,
        overlayEl: null,
        inputEl: null,
        listEl: null,
        hintEl: null,
        toastEl: null,
        hintLeftSpan: null,
        mgrOverlay: null,
        mgrBox: null,
        siteBodyEl: null,
        setOverlay: null,
        setBox: null,
        autocompleteEl: null,
        suggestionsEl: null,
    });
    /**
     * オートコンプリート状態の初期化
     */
    const createInitialAutocompleteState = () => ({
        items: [],
        index: -1,
        isVisible: false
    });

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
        enterOpens: 'current',
        blocklist: '',
        theme: 'dark',
        accentColor: '#2563eb',
        autoOpenUrls: []
    };
    const DEFAULT_PLACEHOLDER = 'サイト名やURLで検索… Enterで開く / Shift+Enterで新規タブ';

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

    const STORAGE_KEY = 'vm_sites_palette__sites';
    const SETTINGS_KEY = 'vm_sites_palette__settings_v2';
    const USAGE_KEY = 'vm_sites_palette__usage_v1';
    /**
     * ストレージを初期化する
     */
    const initializeStorage = () => {
        if (!GM_getValue(STORAGE_KEY)) {
            GM_setValue(STORAGE_KEY, defaultSites);
        }
        if (!GM_getValue(SETTINGS_KEY)) {
            GM_setValue(SETTINGS_KEY, defaultSettings);
        }
    };
    /**
     * サイトを取得する
     */
    const getSites = () => {
        const raw = GM_getValue(STORAGE_KEY, defaultSites);
        const normalized = [];
        let mutated = false;
        for (const item of raw) {
            const norm = normalizeSite(item);
            if (!norm)
                continue;
            if (item !== norm)
                mutated = true;
            normalized.push(norm);
        }
        if (!normalized.length) {
            normalized.push(...defaultSites.map(normalizeSite).filter(Boolean));
        }
        if (mutated) {
            setSites(normalized, true);
        }
        return normalized;
    };
    /**
     * サイトを設定する
     */
    const setSites = (sites, skipNormalize = false) => {
        const list = skipNormalize ? sites : sites.map(normalizeSite).filter(Boolean);
        GM_setValue(STORAGE_KEY, list);
    };
    /**
     * 設定を取得する
     */
    const getSettings = () => {
        return { ...defaultSettings, ...GM_getValue(SETTINGS_KEY, {}) };
    };
    /**
     * 設定を保存する
     */
    const setSettings = (settings) => {
        GM_setValue(SETTINGS_KEY, { ...getSettings(), ...settings });
    };
    /**
     * 使用回数を増やす
     */
    const incrementUsage = (id) => {
        if (!id)
            return;
        const usageCache = getUsageCache();
        const next = (usageCache[id] || 0) + 1;
        setUsage(id, next);
    };
    /**
     * 使用回数キャッシュを取得する
     */
    const getUsageCache = () => {
        return GM_getValue(USAGE_KEY, {});
    };
    /**
     * 使用回数を設定する
     */
    const setUsage = (id, count) => {
        const usageCache = getUsageCache();
        usageCache[id] = count;
        GM_setValue(USAGE_KEY, usageCache);
    };
    /**
     * 使用回数を整理する
     */
    const pruneUsage = (validIds) => {
        const usageCache = getUsageCache();
        const next = {};
        let changed = false;
        for (const id of Object.keys(usageCache)) {
            if (validIds.has(id)) {
                next[id] = usageCache[id];
            }
            else {
                changed = true;
            }
        }
        if (changed) {
            GM_setValue(USAGE_KEY, next);
        }
    };
    /**
     * サイトエントリを正規化する
     */
    function normalizeSite(entry) {
        if (!entry || typeof entry !== 'object')
            return null;
        const next = { ...entry };
        if (!next.type)
            next.type = 'site';
        if (!next.id)
            next.id = generateId('site');
        if (!Array.isArray(next.tags)) {
            if (typeof next.tags === 'string' && next.tags.trim()) {
                next.tags = next.tags.split(/[,\s]+/).filter(Boolean);
            }
            else {
                next.tags = [];
            }
        }
        if (next.type !== 'site')
            next.type = 'site';
        next.name = next.name || '';
        next.url = next.url || '';
        return next;
    }
    /**
     * IDを生成する
     */
    function generateId(prefix) {
        return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
    }

    /**
     * 文字列を正規化する
     */
    const normalize = (str) => {
        return (str || '').toLowerCase();
    };
    /**
     * HTMLをエスケープする
     */
    const escapeHtml = (str) => {
        const s = str || '';
        const escapeMap = {
            '&': '&',
            '<': '<',
            '>': '>',
            '"': '"',
            "'": '&#039;'
        };
        return s.replace(/[&<>"']/g, m => escapeMap[m] || m);
    };
    /**
     * ワイルドカードマッチング
     */
    const wildcard = (str, pattern) => {
        const re = new RegExp('^' + pattern.split('*').map(x => x.replace(/[\.^$+?()|{}\[\]]/g, r => '\\' + r)).join('.*') + '$', 'i');
        return re.test(str);
    };

    /**
     * タグフィルタを抽出する
     */
    const extractTagFilter = (query) => {
        const trimmed = query.trim();
        if (!trimmed.startsWith('#'))
            return { tagFilter: null, textQuery: query };
        const parts = trimmed.split(/\s+/);
        const first = parts.shift();
        if (!first)
            return { tagFilter: null, textQuery: query };
        const tag = normalize(first.slice(1));
        return { tagFilter: tag || null, textQuery: parts.join(' ') };
    };
    /**
     * すべてのタグを取得する
     */
    const getAllTags = (entries = []) => {
        const tagSet = new Set();
        entries.forEach(item => {
            if (item.tags && Array.isArray(item.tags)) {
                item.tags.forEach(tag => {
                    if (tag && tag.trim()) {
                        tagSet.add(tag.trim());
                    }
                });
            }
        });
        return Array.from(tagSet).sort();
    };
    /**
     * 使用回数ブーストを取得する
     */
    const getUsageBoost = (entry, usageCache) => {
        if (!entry || !entry.id)
            return 0;
        const count = usageCache[entry.id] || 0;
        return Math.min(8, Math.log(count + 1) * 3);
    };
    /**
     * エントリをスコアリングする
     */
    const scoreEntries = (entries, query, usageCache) => {
        const base = entries.map(e => ({ entry: e, score: 0 }));
        if (!query) {
            base.forEach(item => { item.score = 0.0001 + getUsageBoost(item.entry, usageCache); });
        }
        else {
            const matcher = createFuzzyMatcher(query);
            base.forEach(item => {
                const entry = item.entry;
                const score = Math.max(matcher(entry.name || ''), matcher(entry.url || '') - 4, matcher((entry.tags || []).join(' ')) - 2);
                item.score = score === -Infinity ? -Infinity : score + getUsageBoost(item.entry, usageCache);
            });
        }
        const filtered = base.filter(item => item.score > -Infinity);
        filtered.sort((a, b) => b.score - a.score);
        return filtered;
    };
    /**
     * ファジーマッチャーを作成する
     */
    const createFuzzyMatcher = (query) => {
        const q = normalize(query);
        const chars = q.split('');
        const regex = new RegExp(chars.map(c => escapeRegex(c)).join('.*?'), 'i');
        return (text) => {
            if (!text)
                return -Infinity;
            const lower = normalize(text);
            if (lower.includes(q)) {
                const index = lower.indexOf(q);
                return 40 - index * 1.5;
            }
            if (!regex.test(text))
                return -Infinity;
            let score = 20;
            score -= lower.length * 0.02;
            if (lower.startsWith(chars[0]))
                score += 6;
            return score;
        };
    };
    /**
     * 正規表現をエスケープする
     */
    const escapeRegex = (str) => {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };
    /**
     * フィルタリングとスコアリングを一度に行う
     */
    const filterAndScoreEntries = (entries, query, usageCache) => {
        const scored = scoreEntries(entries, query, usageCache);
        return scored.map(item => item.entry);
    };

    /**
     * favicon要素を作成する
     */
    const createFaviconEl = (entry) => {
        const wrap = document.createElement('div');
        wrap.style.width = '20px';
        wrap.style.height = '20px';
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.justifyContent = 'center';
        const img = document.createElement('img');
        img.className = 'ico';
        img.decoding = 'async';
        let origin = null;
        const url = entry.url;
        try {
            origin = new URL(url).origin;
        }
        catch {
            origin = null;
        }
        // グローバルからgetFavCacheを取得（循環参照を避けるため）
        const getFavCache = () => {
            try {
                return window.GM_getValue?.('vm_sites_palette__favcache_v1', {}) || {};
            }
            catch {
                return {};
            }
        };
        const setFavCache = (origin, href) => {
            const favCache = getFavCache();
            favCache[origin] = href;
            window.GM_setValue?.('vm_sites_palette__favcache_v1', favCache);
        };
        const clearFavCacheOrigin = (origin) => {
            if (!origin)
                return;
            const favCache = getFavCache();
            if (favCache[origin]) {
                delete favCache[origin];
                window.GM_setValue?.('vm_sites_palette__favcache_v1', favCache);
            }
        };
        const cached = origin && getFavCache()[origin] ? getFavCache()[origin] : null;
        if (cached) {
            img.onload = () => wrap.appendChild(img);
            img.onerror = () => {
                if (origin)
                    clearFavCacheOrigin(origin);
                trySimple();
            };
            img.src = cached;
            return wrap;
        }
        if (origin) {
            discoverFavicon(origin, (href) => {
                if (href) {
                    img.onload = () => {
                        setFavCache(origin, href);
                        wrap.appendChild(img);
                    };
                    img.onerror = () => {
                        if (origin)
                            clearFavCacheOrigin(origin);
                        trySimple();
                    };
                    img.src = href;
                }
                else {
                    trySimple();
                }
            });
        }
        else {
            trySimple();
        }
        function trySimple() {
            const list = (() => {
                if (!origin)
                    return [];
                const simple = [
                    '/favicon.ico',
                    '/favicon.svg',
                    '/favicon.png',
                    '/apple-touch-icon.png',
                    '/apple-touch-icon-precomposed.png'
                ].map(p => origin + p);
                const external = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(origin || '')}&sz=64`;
                return [external, ...simple];
            })();
            let i = 0;
            function next() {
                if (i >= list.length)
                    return fallback();
                img.src = list[i++];
            }
            img.onload = () => {
                if (origin)
                    setFavCache(origin, img.src);
                wrap.appendChild(img);
            };
            img.onerror = () => {
                if (origin)
                    clearFavCacheOrigin(origin);
                next();
            };
            next();
        }
        function fallback() {
            const letter = document.createElement('div');
            letter.className = 'ico-letter';
            const text = (entry.name || '').trim();
            const first = text ? text[0] : (origin ? origin.replace(/^https?:\/\//, '')[0] : '?');
            letter.textContent = (first || '?').toUpperCase();
            wrap.appendChild(letter);
        }
        return wrap;
    };
    /**
     * faviconを発見する
     */
    const discoverFavicon = (origin, done) => {
        const isDark = (() => {
            try {
                return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ||
                    document.documentElement.classList.contains('dark') ||
                    document.documentElement.dataset.colorMode === 'dark';
            }
            catch {
                return false;
            }
        })();
        GM_xmlhttpRequest({
            method: 'GET',
            url: origin + '/',
            onload: (res) => {
                try {
                    const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
                    const links = Array.from(doc.querySelectorAll('link[rel~="icon" i], link[rel="shortcut icon" i], link[rel~="mask-icon" i], link[rel~="apple-touch-icon" i]'));
                    if (!links.length)
                        return done(null);
                    function mediaMatch(m) {
                        try {
                            return m ? matchMedia(m).matches : true;
                        }
                        catch {
                            return true;
                        }
                    }
                    function score(link) {
                        const rel = (link.getAttribute('rel') || '').toLowerCase();
                        const href = link.getAttribute('href') || '';
                        const type = (link.getAttribute('type') || '').toLowerCase();
                        const sizes = (link.getAttribute('sizes') || '').toLowerCase();
                        const media = (link.getAttribute('media') || '').trim();
                        let s = 0;
                        if (rel.includes('icon'))
                            s += 10;
                        if (href.includes('favicon'))
                            s += 6;
                        if (type.includes('svg'))
                            s += 5;
                        if (sizes.includes('32x32'))
                            s += 3;
                        if (media)
                            s += mediaMatch(media) ? 8 : -20;
                        if (isDark) {
                            if (/dark/i.test(href))
                                s += 5;
                            if (/light/i.test(href))
                                s -= 2;
                        }
                        else {
                            if (/light/i.test(href))
                                s += 3;
                            if (/dark/i.test(href))
                                s -= 2;
                        }
                        return s;
                    }
                    const best = links.map(l => ({ l, s: score(l) })).sort((a, b) => b.s - a.s)[0];
                    if (!best)
                        return done(null);
                    const abs = new URL(best.l.getAttribute('href') || '', origin).href;
                    return done(abs);
                }
                catch {
                    done(null);
                }
            },
            onerror: () => done(null)
        });
    };

    /**
     * デバウンスユーティリティ関数
     */
    /**
     * 指定された遅延時間後に関数を実行するデバウンス関数を作成
     */
    function debounce(func, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func(...args), delay);
        };
    }

    /**
     * メインパレットUIを管理するクラス
     */
    class Palette {
        constructor(state, dom) {
            this.state = state;
            this.dom = dom;
            // デバウンスされたレンダリング関数を作成
            this.debouncedRenderList = debounce(() => this.performRenderList(), 150);
        }
        /**
         * Shadow Rootホストを確保する
         */
        ensureRoot() {
            if (this.dom.host)
                return;
            this.dom.host = document.createElement('div');
            this.dom.host.id = 'vm-cmd-palette-host';
            this.dom.host.style.all = 'initial';
            document.documentElement.appendChild(this.dom.host);
            this.dom.root = this.dom.host.attachShadow({ mode: 'open' });
        }
        /**
         * パレットを開く
         */
        openPalette() {
            this.ensureRoot();
            this.state.cachedSettings = getSettings();
            this.applyTheme();
            this.state.isOpen = true;
            if (!this.dom.overlayEl) {
                this.createPaletteUI();
            }
            this.dom.overlayEl.style.display = 'block';
            requestAnimationFrame(() => {
                this.dom.overlayEl.classList.add('visible');
            });
            this.dom.inputEl.value = '';
            this.dom.inputEl.placeholder = DEFAULT_PLACEHOLDER;
            this.state.activeIndex = 0;
            this.renderList();
            setTimeout(() => this.dom.inputEl.focus(), 0);
        }
        /**
         * パレットを閉じる
         */
        hidePalette() {
            this.state.isOpen = false;
            if (!this.dom.overlayEl)
                return;
            this.dom.overlayEl.classList.remove('visible');
            setTimeout(() => {
                if (!this.state.isOpen && this.dom.overlayEl) {
                    this.dom.overlayEl.style.display = 'none';
                }
            }, 180);
        }
        /**
         * テーマを適用する
         */
        applyTheme() {
            if (!this.dom.root)
                return;
            const settings = this.state.cachedSettings || getSettings();
            const theme = settings.theme === 'light' ? themes.light : themes.dark;
            const vars = { ...theme, '--accent-color': settings.accentColor || '#2563eb' };
            const docStyle = this.dom.host.style;
            Object.entries(vars).forEach(([key, value]) => {
                docStyle.setProperty(key, value);
            });
        }
        /**
         * パレットUIを作成する
         */
        createPaletteUI() {
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
    `;
            this.dom.overlayEl = document.createElement('div');
            this.dom.overlayEl.className = 'overlay';
            const panel = document.createElement('div');
            panel.className = 'panel';
            this.dom.inputEl = document.createElement('input');
            this.dom.inputEl.className = 'input';
            this.dom.inputEl.type = 'text';
            this.dom.inputEl.placeholder = DEFAULT_PLACEHOLDER;
            this.dom.listEl = document.createElement('div');
            this.dom.listEl.className = 'list';
            this.dom.hintEl = document.createElement('div');
            this.dom.hintEl.className = 'hint';
            this.dom.hintLeftSpan = document.createElement('span');
            this.dom.hintLeftSpan.textContent = '↑↓: 移動 / Enter: 開く / Shift+Enter: 新規タブ / Tab: タグ選択 / Esc: 閉じる';
            const rightSpan = document.createElement('span');
            rightSpan.innerHTML = '<span class="link" id="vm-open-manager">サイトマネージャを開く</span> · <span class="link" id="vm-open-settings">設定</span> · ⌘P / Ctrl+P';
            this.dom.hintEl.appendChild(this.dom.hintLeftSpan);
            this.dom.hintEl.appendChild(rightSpan);
            panel.appendChild(this.dom.inputEl);
            panel.appendChild(this.dom.listEl);
            panel.appendChild(this.dom.hintEl);
            this.dom.overlayEl.appendChild(panel);
            // トースト要素を作成
            this.dom.toastEl = document.createElement('div');
            this.dom.toastEl.className = 'toast';
            this.dom.root.appendChild(style);
            this.dom.root.appendChild(this.dom.overlayEl);
            this.dom.root.appendChild(this.dom.toastEl);
            // マネージャと設定のCSSを追加
            const managerStyle = document.createElement('style');
            managerStyle.textContent = `
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
            this.dom.root.appendChild(managerStyle);
            // グローバルアクセス用
            window.toastEl = this.dom.toastEl;
        }
        /**
         * リストをレンダリングする（デバウンス対応）
         */
        renderList() {
            this.debouncedRenderList();
        }
        /**
         * 実際のリストレンダリング処理
         */
        performRenderList() {
            const rawQuery = this.dom.inputEl?.value || '';
            const { tagFilter, textQuery } = extractTagFilter(rawQuery);
            const entries = this.getEntries();
            const filtered = tagFilter ? entries.filter(e => (e.tags || []).some(t => t === tagFilter)) : entries;
            const scored = filterAndScoreEntries(filtered, textQuery, this.getUsageCache());
            if (scored.length) {
                if (this.state.activeIndex >= scored.length)
                    this.state.activeIndex = scored.length - 1;
                if (this.state.activeIndex < 0)
                    this.state.activeIndex = 0;
            }
            else {
                this.state.activeIndex = 0;
            }
            if (this.dom.listEl) {
                this.dom.listEl.innerHTML = '';
                if (!scored.length) {
                    const empty = document.createElement('div');
                    empty.className = 'empty';
                    empty.textContent = textQuery || tagFilter ? '一致なし' : 'サイトが登録されていません。サイトマネージャで追加してください。';
                    this.dom.listEl.appendChild(empty);
                    this.state.currentItems = [];
                    return;
                }
                scored.forEach((entry, idx) => {
                    const item = document.createElement('div');
                    item.className = 'item';
                    item.dataset.index = idx.toString();
                    item.addEventListener('mouseenter', () => {
                        this.state.activeIndex = idx;
                        this.updateActive();
                    });
                    item.addEventListener('mousedown', e => e.preventDefault());
                    item.addEventListener('click', () => {
                        this.openItem(entry, false);
                    });
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
                    const right = document.createElement('div');
                    right.innerHTML = '<span class="kbd">↵</span>';
                    item.appendChild(icon);
                    item.appendChild(left);
                    item.appendChild(right);
                    if (this.dom.listEl)
                        this.dom.listEl.appendChild(item);
                });
            }
            this.state.currentItems = scored;
            this.updateActive();
        }
        /**
         * アクティブなアイテムを更新する
         */
        updateActive() {
            const items = this.dom.listEl?.querySelectorAll('.item') || [];
            items.forEach((el, idx) => {
                el.classList.toggle('active', idx === this.state.activeIndex);
            });
        }
        /**
         * アイテムを開く
         */
        openItem(item, shiftPressed) {
            // この処理はPaletteCoreに委ねる
            console.log('Opening item:', item, 'shift:', shiftPressed);
        }
        /**
         * エントリを取得する
         */
        getEntries() {
            const sites = getSites();
            return [...sites];
        }
        /**
         * 使用回数キャッシュを取得する（暫定実装）
         */
        getUsageCache() {
            try {
                return window.GM_getValue?.('vm_sites_palette__usage_v1', {}) || {};
            }
            catch {
                return {};
            }
        }
    }

    /**
     * オートコンプリートUIを管理するクラス
     */
    class Autocomplete {
        constructor(dom, state, onRenderList, onUpdateActive) {
            /**
             * オートコンプリート入力処理
             */
            this.handleAutocompleteInput = () => {
                const value = this.dom.inputEl.value;
                setTimeout(() => {
                    if (value.includes(' ')) {
                        this.hideAutocomplete();
                        return;
                    }
                    if (value.includes('#')) {
                        const afterHash = value.slice(value.indexOf('#') + 1);
                        this.showAutocomplete(afterHash);
                    }
                    else {
                        this.hideAutocomplete();
                    }
                }, 10);
            };
            /**
             * オートコンプリートキーボード処理
             */
            this.handleAutocompleteKeydown = (e) => {
                if (!this.state.isVisible)
                    return;
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.state.index = (this.state.index + 1) % this.state.items.length;
                    this.updateAutocompleteActive();
                }
                else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.state.index = (this.state.index - 1 + this.state.items.length) % this.state.items.length;
                    this.updateAutocompleteActive();
                }
                else if (e.key === 'Enter' && this.state.index >= 0) {
                    e.preventDefault();
                    this.selectAutocompleteItem(this.state.items[this.state.index]);
                }
                else if (e.key === 'Escape') {
                    this.hideAutocomplete();
                }
            };
            this.dom = dom;
            this.state = state;
            this.onRenderList = onRenderList;
            this.onUpdateActive = onUpdateActive;
        }
        /**
         * オートコンプリートを構築
         */
        buildAutocomplete() {
            const container = document.createElement('div');
            container.className = 'autocomplete-container';
            container.style.position = 'relative';
            this.dom.autocompleteEl = document.createElement('div');
            this.dom.autocompleteEl.className = 'autocomplete-list';
            this.dom.autocompleteEl.style.display = 'none';
            // 元の入力欄をコンテナに移動
            if (this.dom.inputEl && this.dom.inputEl.parentNode) {
                this.dom.inputEl.parentNode.replaceChild(container, this.dom.inputEl);
                container.appendChild(this.dom.inputEl);
                container.appendChild(this.dom.autocompleteEl);
            }
            // オートコンプリートのイベントリスナーを追加
            this.dom.inputEl.addEventListener('input', this.handleAutocompleteInput);
            this.dom.inputEl.addEventListener('keydown', this.handleAutocompleteKeydown);
            this.dom.inputEl.addEventListener('blur', () => {
                setTimeout(() => this.hideAutocomplete(), 300);
            });
            this.dom.autocompleteEl.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });
        }
        /**
         * オートコンプリートを表示
         */
        showAutocomplete(query) {
            const allTags = getAllTags();
            const entries = this.getEntries();
            const tagCounts = {};
            entries.forEach(entry => {
                if (entry.tags) {
                    entry.tags.forEach((tag) => {
                        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                    });
                }
            });
            let filteredTags = [];
            if (query.includes('/')) {
                const parts = query.split('/');
                const parentQuery = parts.slice(0, -1).join('/');
                const childQuery = parts[parts.length - 1];
                filteredTags = allTags.filter(tag => {
                    if (tag.startsWith(parentQuery + '/')) {
                        const childPart = tag.slice(parentQuery.length + 1);
                        return childPart.toLowerCase().includes(childQuery.toLowerCase());
                    }
                    return false;
                });
            }
            else {
                filteredTags = allTags.filter(tag => tag.toLowerCase().includes(query.toLowerCase()));
            }
            filteredTags.sort((a, b) => {
                const aDepth = (a.match(/\//g) || []).length;
                const bDepth = (b.match(/\//g) || []).length;
                if (aDepth !== bDepth)
                    return aDepth - bDepth;
                return a.localeCompare(b);
            });
            const filteredTagObjects = filteredTags.map(tag => ({
                name: tag,
                count: tagCounts[tag] || 0
            }));
            if (filteredTagObjects.length === 0) {
                this.state.items = [];
                this.state.index = -1;
                this.state.isVisible = true;
                this.dom.autocompleteEl.innerHTML = '';
                const emptyItem = document.createElement('div');
                emptyItem.className = 'autocomplete-item';
                emptyItem.textContent = '該当するタグがありません';
                emptyItem.style.color = 'var(--muted)';
                emptyItem.style.cursor = 'default';
                emptyItem.addEventListener('click', (e) => e.preventDefault());
                this.dom.autocompleteEl.appendChild(emptyItem);
                this.dom.autocompleteEl.style.display = 'block';
                this.updateAutocompleteActive();
                return;
            }
            this.state.items = filteredTagObjects;
            this.state.index = 0;
            this.state.isVisible = true;
            this.dom.autocompleteEl.innerHTML = '';
            filteredTagObjects.forEach((tag, index) => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                item.dataset.index = index.toString();
                const depth = (tag.name.match(/\//g) || []).length;
                const displayName = tag.name.split('/').pop();
                const fullPath = tag.name;
                item.innerHTML = `
        <span class="autocomplete-tag" style="margin-left: ${depth * 8}px">${escapeHtml(displayName || '')}</span>
        <span class="autocomplete-count">${tag.count}件</span>
        <div style="font-size: 10px; color: var(--muted); margin-top: 2px;">${escapeHtml(fullPath)}</div>
      `;
                item.addEventListener('click', () => this.selectAutocompleteItem(tag));
                item.addEventListener('mouseenter', () => {
                    this.state.index = index;
                    this.updateAutocompleteActive();
                });
                this.dom.autocompleteEl.appendChild(item);
            });
            this.dom.autocompleteEl.style.display = 'block';
            this.updateAutocompleteActive();
        }
        /**
         * オートコンプリートを非表示
         */
        hideAutocomplete() {
            this.state.isVisible = false;
            this.state.index = -1;
            if (this.dom.autocompleteEl) {
                this.dom.autocompleteEl.style.display = 'none';
            }
        }
        /**
         * オートコンプリートアクティブ更新
         */
        updateAutocompleteActive() {
            if (!this.dom.autocompleteEl)
                return;
            const items = this.dom.autocompleteEl.querySelectorAll('.autocomplete-item');
            items.forEach((item, index) => {
                item.classList.toggle('active', index === this.state.index);
            });
        }
        /**
         * オートコンプリートアイテム選択
         */
        selectAutocompleteItem(tag) {
            const currentValue = this.dom.inputEl.value;
            const hashIndex = currentValue.indexOf('#');
            if (hashIndex >= 0) {
                const beforeHash = currentValue.slice(0, hashIndex);
                this.dom.inputEl.value = beforeHash + '#' + tag.name + ' ';
            }
            else {
                this.dom.inputEl.value = '#' + tag.name + ' ';
            }
            this.hideAutocomplete();
            this.dom.inputEl.focus();
            // アクティブインデックスをリセットして再レンダリング
            this.onRenderList();
            this.onUpdateActive();
        }
        /**
         * エントリを取得する（暫定実装）
         */
        getEntries() {
            try {
                return window.GM_getValue?.('vm_sites_palette__sites', []) || [];
            }
            catch {
                return [];
            }
        }
    }

    /**
     * トーストメッセージを表示する
     */
    const showToast = (message) => {
        // グローバル変数から取得
        const toastEl = window.toastEl;
        if (!toastEl)
            return;
        toastEl.innerHTML = '';
        const msg = document.createElement('div');
        msg.className = 'toast-message';
        msg.textContent = message;
        toastEl.appendChild(msg);
        toastEl.style.display = 'flex';
        setTimeout(() => {
            if (toastEl && toastEl.contains(msg)) {
                toastEl.removeChild(msg);
            }
            if (toastEl) {
                toastEl.style.display = 'none';
            }
        }, 2400);
    };

    /**
     * サイトマネージャUIを管理するクラス
     */
    class Manager {
        constructor(dom, onRenderList) {
            this.dom = dom;
            this.onRenderList = onRenderList;
        }
        /**
         * マネージャを構築
         */
        buildManager() {
            this.dom.mgrOverlay = document.createElement('div');
            this.dom.mgrOverlay.className = 'mgr-overlay';
            this.dom.mgrOverlay.addEventListener('click', e => {
                if (e.target === this.dom.mgrOverlay)
                    this.closeManager();
            });
            this.dom.mgrBox = document.createElement('div');
            this.dom.mgrBox.className = 'mgr';
            this.dom.mgrBox.innerHTML = `
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
            this.dom.mgrOverlay.appendChild(this.dom.mgrBox);
            if (this.dom.root) {
                this.dom.root.appendChild(this.dom.mgrOverlay);
            }
            this.dom.siteBodyEl = this.dom.mgrBox.querySelector('#vm-rows-sites');
            this.dom.mgrBox.querySelector('#vm-add-site')?.addEventListener('click', () => this.addSiteRow({ name: '', url: '', tags: [] }));
            this.dom.mgrBox.querySelector('#vm-save')?.addEventListener('click', () => this.saveManager());
            this.dom.mgrBox.querySelector('#vm-close')?.addEventListener('click', () => this.closeManager());
            this.dom.mgrBox.querySelector('#vm-export')?.addEventListener('click', () => this.exportSites());
            const importInput = this.dom.mgrBox.querySelector('#vm-import-file');
            this.dom.mgrBox.addEventListener('keydown', e => {
                if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    this.saveManager();
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.closeManager();
                }
            });
            this.dom.mgrBox.querySelector('#vm-import')?.addEventListener('click', () => {
                if (!importInput)
                    return;
                importInput.value = '';
                importInput.click();
            });
            if (importInput) {
                importInput.addEventListener('change', () => {
                    const file = importInput.files && importInput.files[0];
                    if (!file)
                        return;
                    const reader = new FileReader();
                    reader.onload = () => {
                        this.importSitesFromJson(typeof reader.result === 'string' ? reader.result : '');
                    };
                    reader.onerror = () => {
                        showToast('ファイルの読み込みに失敗しました');
                    };
                    try {
                        reader.readAsText(file, 'utf-8');
                    }
                    catch (err) {
                        console.error('[CommandPalette] import read error', err);
                        showToast('ファイルの読み込みに失敗しました');
                    }
                });
            }
        }
        /**
         * マネージャを開く
         */
        openManager() {
            this.renderManager();
            if (this.dom.mgrOverlay) {
                this.dom.mgrOverlay.style.display = 'block';
                setTimeout(() => {
                    const i = this.dom.mgrBox?.querySelector('input');
                    if (i)
                        i.focus();
                }, 0);
            }
        }
        /**
         * マネージャを閉じる
         */
        closeManager() {
            if (this.dom.mgrOverlay) {
                this.dom.mgrOverlay.style.display = 'none';
            }
        }
        /**
         * マネージャをレンダリング
         */
        renderManager() {
            if (!this.dom.siteBodyEl)
                return;
            this.dom.siteBodyEl.innerHTML = '';
            getSites().forEach(s => this.addSiteRow({ ...s }));
        }
        /**
         * サイト行を追加
         */
        addSiteRow(data) {
            if (!this.dom.siteBodyEl)
                return;
            const tr = document.createElement('tr');
            if (data.id)
                tr.dataset.entryId = data.id;
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
            const urlInput = tr.querySelector('input[data-field="url"]');
            tr.querySelector('[data-up]')?.addEventListener('click', () => this.moveRow(tr, -1, this.dom.siteBodyEl));
            tr.querySelector('[data-down]')?.addEventListener('click', () => this.moveRow(tr, 1, this.dom.siteBodyEl));
            tr.querySelector('[data-del]')?.addEventListener('click', () => { tr.remove(); });
            tr.querySelector('[data-test]')?.addEventListener('click', () => {
                const u = urlInput?.value.trim();
                if (u)
                    window.open(u.includes('%s') ? u.replace(/%s/g, encodeURIComponent('test')) : u, '_blank');
            });
            this.dom.siteBodyEl.appendChild(tr);
        }
        /**
         * 行を移動
         */
        moveRow(tr, delta, container) {
            const rows = Array.from(container.children);
            const i = rows.indexOf(tr);
            if (i < 0)
                return;
            const ni = Math.min(rows.length - 1, Math.max(0, i + delta));
            if (ni === i)
                return;
            if (delta < 0) {
                container.insertBefore(tr, rows[ni]);
            }
            else {
                container.insertBefore(tr, rows[ni].nextSibling);
            }
        }
        /**
         * マネージャを保存
         */
        saveManager() {
            if (!this.dom.siteBodyEl)
                return;
            const previousSites = getSites();
            const sites = Array.from(this.dom.siteBodyEl.querySelectorAll('tr')).map((tr, index) => {
                const name = tr.querySelector('input[data-field="name"]')?.value.trim() || '';
                const url = tr.querySelector('input[data-field="url"]')?.value.trim() || '';
                const tags = tr.querySelector('input[data-field="tags"]')?.value.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean) || [];
                if (!name || !url)
                    return null;
                const existing = tr.dataset.entryId && previousSites.find(s => s.id === tr.dataset.entryId);
                const id = existing ? existing.id : (tr.dataset.entryId || `site-${Math.random().toString(36).slice(2, 10)}`);
                return { id, type: 'site', name, url, tags };
            }).filter(Boolean);
            setSites(sites);
            pruneUsage(new Set([...sites.map(s => s.id)]));
            showToast('保存しました');
            this.onRenderList();
        }
        /**
         * サイトをエクスポート
         */
        exportSites() {
            const sites = getSites();
            const json = JSON.stringify(sites, null, 2);
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
            const filename = `sites-backup-${stamp}.json`;
            if (this.downloadTextFile(filename, json)) {
                showToast('エクスポートファイルをダウンロードしました');
            }
            else {
                showToast('エクスポートに失敗しました');
            }
        }
        /**
         * テキストファイルをダウンロード
         */
        downloadTextFile(filename, text) {
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
            }
            catch (e) {
                console.error('[CommandPalette] export failed', e);
                return false;
            }
        }
        /**
         * JSONからサイトをインポート
         */
        importSitesFromJson(jsonText) {
            if (!jsonText) {
                showToast('無効なJSONです');
                return;
            }
            try {
                const arr = JSON.parse(jsonText);
                if (!Array.isArray(arr))
                    throw new Error('not array');
                setSites(arr);
                pruneUsage(new Set(getSites().map(e => e.id)));
                this.renderManager();
                showToast('読み込みました');
            }
            catch (err) {
                console.error('[CommandPalette] import parse error', err);
                showToast('無効なJSONです');
            }
        }
    }

    /**
     * 設定UIを管理するクラス
     */
    class SettingsUI {
        constructor(dom, onApplyTheme) {
            this.cachedSettings = null;
            this.dom = dom;
            this.onApplyTheme = onApplyTheme;
        }
        /**
         * 設定を構築
         */
        buildSettings() {
            this.dom.setOverlay = document.createElement('div');
            this.dom.setOverlay.className = 'set-overlay';
            this.dom.setOverlay.addEventListener('click', e => {
                if (e.target === this.dom.setOverlay)
                    this.closeSettings();
            });
            this.dom.setBox = document.createElement('div');
            this.dom.setBox.className = 'set';
            this.dom.setBox.innerHTML = `
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
            this.dom.setOverlay.appendChild(this.dom.setBox);
            if (this.dom.root) {
                this.dom.root.appendChild(this.dom.setOverlay);
            }
            this.dom.setBox.querySelector('#vs-close')?.addEventListener('click', () => this.closeSettings());
            this.dom.setBox.querySelector('#vs-save')?.addEventListener('click', () => this.saveSettingsFromUI());
            this.dom.setBox.querySelector('#vs-reset')?.addEventListener('click', () => {
                this.applySettingsToUI(defaultSettings);
            });
            this.dom.setBox.querySelector('#vs-clear-fav')?.addEventListener('click', () => {
                // キャッシュをクリア
                const emptyCache = {};
                GM_setValue('vm_sites_palette__favcache_v1', emptyCache);
                showToast('faviconキャッシュを削除しました');
            });
            this.dom.setBox.addEventListener('keydown', e => {
                if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    this.saveSettingsFromUI();
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.closeSettings();
                }
            });
            this.setupHotkeyCapture(this.dom.setBox.querySelector('#vs-hotkey1'), 'hotkeyPrimary');
            this.setupHotkeyCapture(this.dom.setBox.querySelector('#vs-hotkey2'), 'hotkeySecondary');
            this.setupAccentSync();
        }
        /**
         * 設定を開く
         */
        openSettings() {
            this.cachedSettings = getSettings();
            this.onApplyTheme();
            this.applySettingsToUI(this.cachedSettings);
            if (this.dom.setOverlay) {
                this.dom.setOverlay.style.display = 'block';
            }
        }
        /**
         * 設定を閉じる
         */
        closeSettings() {
            if (this.dom.setOverlay) {
                this.dom.setOverlay.style.display = 'none';
            }
        }
        /**
         * 設定をUIに適用
         */
        applySettingsToUI(s) {
            if (!this.dom.setBox)
                return;
            const hotkey1Input = this.dom.setBox.querySelector('#vs-hotkey1');
            const hotkey2Input = this.dom.setBox.querySelector('#vs-hotkey2');
            if (hotkey1Input) {
                hotkey1Input.value = this.labelHotkey(s.hotkeyPrimary);
                hotkey1Input.dataset.sig = s.hotkeyPrimary;
            }
            if (hotkey2Input) {
                hotkey2Input.value = this.labelHotkey(s.hotkeySecondary);
                hotkey2Input.dataset.sig = s.hotkeySecondary;
            }
            Array.from(this.dom.setBox.querySelectorAll('input[name="vs-enter"]')).forEach(r => {
                const input = r;
                input.checked = input.value === s.enterOpens;
            });
            Array.from(this.dom.setBox.querySelectorAll('input[name="vs-theme"]')).forEach(r => {
                const input = r;
                input.checked = input.value === (s.theme || 'dark');
            });
            const accent = s.accentColor || defaultSettings.accentColor;
            const accentInput = this.dom.setBox.querySelector('#vs-accent');
            const accentText = this.dom.setBox.querySelector('#vs-accent-text');
            if (accentInput)
                accentInput.value = this.normalizeColor(accent);
            if (accentText)
                accentText.value = this.normalizeColor(accent);
            const blocklistInput = this.dom.setBox.querySelector('#vs-blocklist');
            if (blocklistInput)
                blocklistInput.value = s.blocklist || '';
            const autoOpenInput = this.dom.setBox.querySelector('#vs-auto-open');
            if (autoOpenInput) {
                const auto = this.normalizeAutoOpen(s.autoOpenUrls);
                autoOpenInput.value = auto.join('\n');
            }
        }
        /**
         * UIから設定を保存
         */
        saveSettingsFromUI() {
            if (!this.dom.setBox)
                return;
            const s = {
                hotkeyPrimary: this.dom.setBox.querySelector('#vs-hotkey1')?.dataset.sig || defaultSettings.hotkeyPrimary,
                hotkeySecondary: this.dom.setBox.querySelector('#vs-hotkey2')?.dataset.sig || defaultSettings.hotkeySecondary,
                enterOpens: (this.dom.setBox.querySelector('input[name="vs-enter"]:checked')?.value || 'current'),
                theme: (this.dom.setBox.querySelector('input[name="vs-theme"]:checked')?.value || defaultSettings.theme),
                accentColor: this.normalizeColor(this.dom.setBox.querySelector('#vs-accent-text')?.value || this.dom.setBox.querySelector('#vs-accent')?.value || defaultSettings.accentColor),
                blocklist: this.dom.setBox.querySelector('#vs-blocklist')?.value || '',
                autoOpenUrls: this.normalizeAutoOpen(this.dom.setBox.querySelector('#vs-auto-open')?.value)
            };
            setSettings(s);
            this.cachedSettings = s;
            this.onApplyTheme();
            showToast('設定を保存しました');
        }
        /**
         * カラーを正規化
         */
        normalizeColor(value) {
            let v = (value || '').trim();
            if (!v)
                return defaultSettings.accentColor;
            if (!v.startsWith('#'))
                v = '#' + v.replace(/^#+/, '');
            if (v.length === 4)
                v = '#' + v.slice(1).split('').map(ch => ch + ch).join('');
            if (/^#[0-9a-fA-F]{6}$/.test(v))
                return v.toLowerCase();
            return defaultSettings.accentColor;
        }
        /**
         * 自動オープンURLを正規化
         */
        normalizeAutoOpen(value) {
            if (!value)
                return [];
            if (Array.isArray(value))
                return value.map(v => (v || '').trim()).filter(Boolean);
            return value.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
        }
        /**
         * アクセントカラー同期を設定
         */
        setupAccentSync() {
            if (!this.dom.setBox)
                return;
            const colorInput = this.dom.setBox.querySelector('#vs-accent');
            const textInput = this.dom.setBox.querySelector('#vs-accent-text');
            const hexFull = (v) => /^#?[0-9a-fA-F]{6}$/.test(v.replace(/^#/, ''));
            colorInput.addEventListener('input', () => {
                const val = colorInput.value;
                if (textInput)
                    textInput.value = val;
            });
            textInput.addEventListener('input', () => {
                const raw = textInput.value.trim();
                if (hexFull(raw)) {
                    const normalized = this.normalizeColor(raw);
                    colorInput.value = normalized;
                }
            });
            textInput.addEventListener('blur', () => {
                const normalized = this.normalizeColor(textInput.value);
                textInput.value = normalized;
                colorInput.value = normalized;
            });
        }
        /**
         * ホットキーキャプチャを設定
         */
        setupHotkeyCapture(input, field) {
            if (!input)
                return;
            input.addEventListener('focus', () => {
                input.value = '任意のキーを押す';
            });
            input.addEventListener('blur', () => {
                const sig = input.dataset.sig || getSettings()[field];
                input.value = this.labelHotkey(sig || '');
            });
            input.addEventListener('keydown', (e) => {
                e.preventDefault();
                const mod = e.metaKey ? 'Meta' : e.ctrlKey ? 'Control' : null;
                if (!mod) {
                    input.value = 'Meta/Ctrl を含めて押す';
                    return;
                }
                const sig = `${mod}+${e.code}`;
                input.dataset.sig = sig;
                input.value = this.labelHotkey(sig);
            });
        }
        /**
         * ホットキーラベルを生成
         */
        labelHotkey(sig) {
            if (!sig)
                return '';
            const [m, code] = sig.split('+');
            const keyName = code.replace(/^Key/, '').replace(/^Digit/, '');
            const isMac = /mac/i.test(navigator.platform);
            const mod = m === 'Meta' ? (isMac ? '⌘' : 'Win+') : 'Ctrl+';
            return mod + keyName;
        }
    }

    /**
     * パレットのコアロジックを管理するクラス
     */
    class PaletteCore {
        constructor(inputEl) {
            this.inputEl = null;
            this.inputEl = inputEl || null;
        }
        /**
         * 入力要素を設定
         */
        setInputElement(inputEl) {
            this.inputEl = inputEl;
        }
        /**
         * エントリを実行する
         */
        executeEntry(entry, shiftPressed, query) {
            if (!entry)
                return;
            const settings = getSettings();
            const preferNew = settings.enterOpens === 'newtab';
            const openNew = shiftPressed ? !preferNew : preferNew;
            let targetUrl = entry.url;
            if (entry.url && entry.url.includes('%s')) {
                const q = query !== undefined ? query : this.inputEl?.value.trim() || '';
                if (!q) {
                    if (this.inputEl) {
                        this.inputEl.value = '';
                        this.inputEl.placeholder = `${entry.name} に検索キーワードを入力…`;
                    }
                    showToast('検索キーワードを入力してください');
                    this.inputEl?.focus();
                    return;
                }
                targetUrl = entry.url.replace(/%s/g, encodeURIComponent(q));
            }
            // パレットを閉じる処理は呼び出し元に委ねる
            incrementUsage(entry.id);
            this.openUrlWithPreference(targetUrl, openNew ? 'newtab' : 'same');
        }
        /**
         * Bing検索を実行する
         */
        runBingSearch(shiftPressed, entry, query) {
            const keywords = (query || '').trim();
            if (!keywords) {
                showToast('検索キーワードを入力してください');
                return;
            }
            const mode = shiftPressed ? 'newtab' : 'auto';
            this.openUrlWithPreference(`https://www.bing.com/search?q=${encodeURIComponent(keywords)}`, mode);
        }
        /**
         * 入力からBing検索を実行する
         */
        runBingSearchFromInput() {
            const q = this.inputEl?.value.trim() || '';
            if (!q) {
                showToast('検索キーワードを入力してください');
                return;
            }
            this.openUrlWithPreference(`https://www.bing.com/search?q=${encodeURIComponent(q)}`);
        }
        /**
         * 設定に応じてURLを開く
         */
        openUrlWithPreference(url, mode = 'auto') {
            const settings = getSettings();
            const openNew = mode === 'newtab' ? true : mode === 'same' ? false : mode === 'command' ? true : settings.enterOpens === 'newtab';
            if (openNew) {
                try {
                    GM_openInTab(url, { active: true, insert: true });
                }
                catch {
                    window.open(url, '_blank');
                }
            }
            else {
                try {
                    location.assign(url);
                }
                catch {
                    location.href = url;
                }
            }
        }
        /**
         * 現在のページを追加する
         */
        runAddCurrent() {
            // この処理はストレージモジュールに依存するため、ここでは実装しない
            // 呼び出し元で適切に処理する
            showToast('現在のページを登録しました');
        }
        /**
         * URLをコピーする
         */
        copyUrl() {
            try {
                GM_setClipboard(location.href);
                showToast('URLをコピーしました');
            }
            catch {
                navigator.clipboard?.writeText(location.href);
                showToast('URLをコピーしました');
            }
        }
    }

    /**
     * ホットキーが一致するかチェックする
     */
    const matchHotkey = (e, sig) => {
        if (!sig)
            return false;
        const [mod, code] = sig.split('+');
        return ((mod === 'Meta' && e.metaKey) || (mod === 'Control' && e.ctrlKey)) &&
            e.code === code &&
            !e.altKey &&
            !e.shiftKey;
    };
    /**
     * サイトがブロックリストに含まれるかチェックする
     */
    const isBlocked = () => {
        const s = getSettings();
        const patterns = (s.blocklist || '').split(/\r?\n/).map(t => t.trim()).filter(Boolean);
        if (!patterns.length)
            return false;
        const host = location.hostname;
        return patterns.some(p => wildcard(host, p));
    };
    /**
     * 自動オープンが必要かチェックする
     */
    const shouldAutoOpen = () => {
        const { autoOpenUrls = [] } = getSettings();
        if (!Array.isArray(autoOpenUrls) || !autoOpenUrls.length)
            return false;
        const current = location.href;
        return autoOpenUrls.some(pattern => {
            const parts = pattern.split('*').map(x => x.replace(/[\.^$+?()|{}\[\]]/g, r => '\\' + r));
            const regex = new RegExp('^' + parts.join('.*') + '');
            return regex.test(current);
        });
    };
    /**
     * グローバルキーボードイベントハンドラ
     */
    const onGlobalKeydown = (e) => {
        // ブロックサイトでは処理しない
        if (isBlocked())
            return;
        // 編集中の要素では処理しない
        const target = e.target;
        const tag = (target && target.tagName) || '';
        const editable = ['INPUT', 'TEXTAREA'].includes(tag) ||
            (target && target.isContentEditable);
        if (editable)
            return;
        const settings = getSettings();
        // ホットキーをチェック
        if (matchHotkey(e, settings.hotkeyPrimary) || matchHotkey(e, settings.hotkeySecondary)) {
            e.preventDefault();
            e.stopPropagation();
            // パレットを開く処理はmain.tsからインポートする
            // ここではイベントを阻止するのみ
        }
    };
    /**
     * グローバルホットキーを設定する
     */
    const setupGlobalHotkey = (settings) => {
        // 既存のリスナーを削除
        window.removeEventListener('keydown', onGlobalKeydown, true);
        // 新しいリスナーを追加
        window.addEventListener('keydown', onGlobalKeydown, true);
    };

    /**
     * キーボードイベント処理を管理するクラス
     */
    class KeyboardHandler {
        constructor(handlers) {
            /**
             * 入力キーボードイベントを処理する
             */
            this.onInputKey = (e, currentItems, activeIndex, inputEl, isAutocompleteVisible) => {
                if (e.isComposing || e.keyCode === 229) {
                    return activeIndex;
                }
                if (isAutocompleteVisible) {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        this.onHideAutocomplete();
                        return activeIndex;
                    }
                    return activeIndex;
                }
                if (e.key === 'Enter' && e.metaKey) {
                    e.preventDefault();
                    this.onBingSearch();
                    return activeIndex;
                }
                if (e.key === 'Escape') {
                    this.onPaletteHide();
                    return activeIndex;
                }
                if (e.key === 'Tab' && !e.shiftKey && inputEl.value.trim() === '') {
                    e.preventDefault();
                    const allTags = getAllTags();
                    if (allTags.length > 0) {
                        inputEl.value = '#' + allTags[0] + ' ';
                        this.onRenderList();
                        this.onShowAutocomplete(allTags[0]);
                    }
                    return activeIndex;
                }
                if (!currentItems.length) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const q = inputEl.value.trim();
                        if (!q) {
                            showToast('検索キーワードを入力してください');
                            return activeIndex;
                        }
                        // Bing検索を実行
                        window.open(`https://www.bing.com/search?q=${encodeURIComponent(q)}`, '_blank');
                    }
                    return activeIndex;
                }
                let newActiveIndex = activeIndex;
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    newActiveIndex = (activeIndex + 1) % currentItems.length;
                    this.onUpdateActive();
                }
                else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    newActiveIndex = (activeIndex - 1 + currentItems.length) % currentItems.length;
                    this.onUpdateActive();
                }
                else if (e.key === 'Enter') {
                    e.preventDefault();
                    const item = currentItems[activeIndex];
                    this.onExecuteEntry(item, e.shiftKey);
                }
                return newActiveIndex;
            };
            /**
             * グローバルホットキーハンドラを更新する
             */
            this.updateHotkeyHandler = (e, settings, onOpenPalette) => {
                if (matchHotkey(e, settings.hotkeyPrimary) || matchHotkey(e, settings.hotkeySecondary)) {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenPalette();
                }
            };
            /**
             * オートコンプリートキーボード処理
             */
            this.handleAutocompleteKeydown = (e, autocompleteItems, autocompleteIndex, isVisible) => {
                if (!isVisible) {
                    return { newIndex: autocompleteIndex, shouldHide: false };
                }
                let newIndex = autocompleteIndex;
                let shouldHide = false;
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    newIndex = (autocompleteIndex + 1) % autocompleteItems.length;
                }
                else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    newIndex = (autocompleteIndex - 1 + autocompleteItems.length) % autocompleteItems.length;
                }
                else if (e.key === 'Enter' && autocompleteIndex >= 0) {
                    e.preventDefault();
                    // アイテム選択処理は呼び出し元に委ねる
                }
                else if (e.key === 'Escape') {
                    shouldHide = true;
                }
                return { newIndex, shouldHide };
            };
            this.onPaletteHide = handlers.onPaletteHide;
            this.onPaletteOpen = handlers.onPaletteOpen;
            this.onRenderList = handlers.onRenderList;
            this.onUpdateActive = handlers.onUpdateActive;
            this.onExecuteEntry = handlers.onExecuteEntry;
            this.onShowAutocomplete = handlers.onShowAutocomplete;
            this.onHideAutocomplete = handlers.onHideAutocomplete;
            this.onBingSearch = handlers.onBingSearch;
        }
    }

    /**
     * アプリケーションメインクラス
     */
    class CommandPaletteApp {
        constructor() {
            /**
             * グローバルホットキーハンドラを更新
             */
            this.updateHotkeyHandler = (e) => {
                const settings = this.getSettings();
                this.keyboardHandler.updateHotkeyHandler(e, settings, () => this.openPalette());
            };
            // 状態の初期化
            this.state = createInitialState();
            this.dom = createInitialDOMElements();
            this.autocompleteState = createInitialAutocompleteState();
            // コンポーネントの初期化
            this.palette = new Palette(this.state, this.dom);
            this.autocomplete = new Autocomplete(this.dom, this.autocompleteState, () => this.renderList(), () => this.updateActive());
            this.manager = new Manager(this.dom, () => this.renderList());
            this.settings = new SettingsUI(this.dom, () => this.applyTheme());
            this.paletteCore = new PaletteCore();
            this.keyboardHandler = new KeyboardHandler({
                onPaletteHide: () => this.hidePalette(),
                onPaletteOpen: () => this.openPalette(),
                onRenderList: () => this.renderList(),
                onUpdateActive: () => this.updateActive(),
                onExecuteEntry: (item, shiftKey) => this.executeEntry(item, shiftKey),
                onShowAutocomplete: (tag) => this.showAutocomplete(tag),
                onHideAutocomplete: () => this.hideAutocomplete(),
                onBingSearch: () => this.runBingSearch()
            });
            // グローバルアクセス用（既存コードとの互換性）
            window.toastEl = this.dom.toastEl;
        }
        /**
         * パレットを開く
         */
        openPalette() {
            this.palette.openPalette();
            this.setupEventListeners();
        }
        /**
         * パレットを閉じる
         */
        hidePalette() {
            this.palette.hidePalette();
        }
        /**
         * テーマを適用する
         */
        applyTheme() {
            this.palette.applyTheme();
        }
        /**
         * リストをレンダリングする
         */
        renderList() {
            this.palette.renderList();
        }
        /**
         * アクティブなアイテムを更新する
         */
        updateActive() {
            this.palette.updateActive();
        }
        /**
         * エントリを実行する
         */
        executeEntry(item, shiftPressed) {
            this.paletteCore.setInputElement(this.dom.inputEl);
            this.paletteCore.executeEntry(item, shiftPressed);
            this.hidePalette();
        }
        /**
         * Bing検索を実行する
         */
        runBingSearch() {
            this.paletteCore.setInputElement(this.dom.inputEl);
            this.paletteCore.runBingSearchFromInput();
            this.hidePalette();
        }
        /**
         * オートコンプリートを表示
         */
        showAutocomplete(tag) {
            this.autocomplete.showAutocomplete(tag);
        }
        /**
         * オートコンプリートを非表示
         */
        hideAutocomplete() {
            this.autocomplete.hideAutocomplete();
        }
        /**
         * イベントリスナーを設定
         */
        setupEventListeners() {
            if (!this.dom.overlayEl || !this.dom.inputEl || !this.dom.hintEl)
                return;
            // オーバーレイクリックで閉じる
            this.dom.overlayEl.addEventListener('click', (e) => {
                if (e.target === this.dom.overlayEl)
                    this.hidePalette();
            });
            // 入力イベント
            this.dom.inputEl.addEventListener('keydown', (e) => {
                this.state.activeIndex = this.keyboardHandler.onInputKey(e, this.state.currentItems, this.state.activeIndex, this.dom.inputEl, this.autocompleteState.isVisible);
            });
            this.dom.inputEl.addEventListener('input', () => this.renderList());
            // ヒントエリアのクリックイベント
            this.dom.hintEl.addEventListener('click', (e) => {
                const target = e.target;
                if (target.id === 'vm-open-manager') {
                    this.openManager();
                }
                else if (target.id === 'vm-open-settings') {
                    this.openSettings();
                }
            });
            // オートコンプリートの構築（初回のみ）
            if (!this.dom.autocompleteEl) {
                this.autocomplete.buildAutocomplete();
            }
        }
        /**
         * マネージャを開く
         */
        openManager() {
            if (!this.dom.mgrOverlay) {
                this.manager.buildManager();
            }
            this.manager.openManager();
        }
        /**
         * 設定を開く
         */
        openSettings() {
            if (!this.dom.setOverlay) {
                this.settings.buildSettings();
            }
            this.settings.openSettings();
        }
        /**
         * 現在のページを追加
         */
        runAddCurrent() {
            const title = document.title || location.hostname;
            const url = location.href;
            const existing = getSites();
            const newSite = {
                id: `site-${Math.random().toString(36).slice(2, 10)}`,
                type: 'site',
                name: title,
                url: url || '',
                tags: []
            };
            setSites([...existing, newSite]);
            pruneUsage(new Set([...existing.map(s => s.id), newSite.id]));
            this.paletteCore.runAddCurrent();
            this.renderList();
        }
        /**
         * URLをコピー
         */
        copyUrl() {
            this.paletteCore.copyUrl();
        }
        /**
         * 設定を取得（暫定実装）
         */
        getSettings() {
            try {
                return { ...defaultSettings, ...window.GM_getValue?.('vm_sites_palette__settings_v2', {}) };
            }
            catch {
                return defaultSettings;
            }
        }
        /**
         * アプリケーションを初期化する
         */
        bootstrap() {
            // ストレージを初期化
            initializeStorage();
            // 設定を取得
            this.getSettings();
            // グローバルホットキーを設定
            setupGlobalHotkey();
            // メニューを登録
            GM_registerMenuCommand('サイトマネージャを開く', () => this.openManager());
            GM_registerMenuCommand('設定', () => this.openSettings());
            GM_registerMenuCommand('現在のページを追加', () => this.runAddCurrent());
            GM_registerMenuCommand('URLをコピー', () => this.copyUrl());
            // 自動オープンをチェック
            if (shouldAutoOpen()) {
                setTimeout(() => this.openPalette(), 120);
            }
            // ホットキーハンドラを更新
            window.addEventListener('keydown', this.updateHotkeyHandler, true);
        }
    }
    // アプリケーションを起動
    const app = new CommandPaletteApp();
    app.bootstrap();

})();
