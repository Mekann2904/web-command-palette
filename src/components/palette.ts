import { SiteEntry, Settings } from '@/types';
import { AppState, DOMElements } from '@/core/state';
import { getSettings, getSites } from '@/core/storage';
import { DEFAULT_PLACEHOLDER, themes } from '@/constants';
import { extractTagFilter, filterAndScoreEntries } from '@/utils/search';
import { createFaviconEl } from '@/utils/dom';
import { escapeHtml } from '@/utils/string';
import { debounce } from '@/utils/debounce';

/**
 * メインパレットUIを管理するクラス
 */
export class Palette {
  private state: AppState;
  private dom: DOMElements;
  private debouncedRenderList: () => void;

  constructor(state: AppState, dom: DOMElements) {
    this.state = state;
    this.dom = dom;
    
    // デバウンスされたレンダリング関数を作成
    this.debouncedRenderList = debounce(() => this.performRenderList(), 150);
  }

  /**
   * Shadow Rootホストを確保する
   */
  ensureRoot(): void {
    if (this.dom.host) return;
    
    this.dom.host = document.createElement('div');
    this.dom.host.id = 'vm-cmd-palette-host';
    this.dom.host.style.all = 'initial';
    document.documentElement.appendChild(this.dom.host);
    this.dom.root = this.dom.host.attachShadow({ mode: 'open' });
  }

  /**
   * パレットを開く
   */
  openPalette(): void {
    this.ensureRoot();
    this.state.cachedSettings = getSettings();
    this.applyTheme();
    this.state.isOpen = true;
    
    if (!this.dom.overlayEl) {
      this.createPaletteUI();
    }
    
    this.dom.overlayEl!.style.display = 'block';
    requestAnimationFrame(() => {
      this.dom.overlayEl!.classList.add('visible');
    });
    
    this.dom.inputEl!.value = '';
    this.dom.inputEl!.placeholder = DEFAULT_PLACEHOLDER;
    this.state.activeIndex = 0;
    this.renderList();
    
    setTimeout(() => this.dom.inputEl!.focus(), 0);
  }

  /**
   * パレットを閉じる
   */
  hidePalette(): void {
    this.state.isOpen = false;
    if (!this.dom.overlayEl) return;
    
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
  applyTheme(): void {
    if (!this.dom.root) return;
    const settings = this.state.cachedSettings || getSettings();
    const theme = settings.theme === 'light' ? themes.light : themes.dark;
    const vars = { ...theme, '--accent-color': settings.accentColor || '#2563eb' };
    const docStyle = this.dom.host!.style;
    
    Object.entries(vars).forEach(([key, value]) => {
      docStyle.setProperty(key, value);
    });
  }

  /**
   * パレットUIを作成する
   */
  createPaletteUI(): void {
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
    
    this.dom.root!.appendChild(style);
    this.dom.root!.appendChild(this.dom.overlayEl);
    this.dom.root!.appendChild(this.dom.toastEl);

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
    this.dom.root!.appendChild(managerStyle);

    // グローバルアクセス用
    (window as any).toastEl = this.dom.toastEl;
  }

  /**
   * リストをレンダリングする（デバウンス対応）
   */
  renderList(): void {
    this.debouncedRenderList();
  }

  /**
   * 実際のリストレンダリング処理
   */
  private performRenderList(): void {
    const rawQuery = this.dom.inputEl?.value || '';
    const { tagFilter, textQuery } = extractTagFilter(rawQuery);
    const entries = this.getEntries();
    const filtered = tagFilter ? entries.filter(e => (e.tags || []).some(t => t === tagFilter)) : entries;
    const scored = filterAndScoreEntries(filtered, textQuery, this.getUsageCache());
    
    if (scored.length) {
      if (this.state.activeIndex >= scored.length) this.state.activeIndex = scored.length - 1;
      if (this.state.activeIndex < 0) this.state.activeIndex = 0;
    } else {
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
        if (this.dom.listEl) this.dom.listEl.appendChild(item);
      });
    }

    this.state.currentItems = scored;
    this.updateActive();
  }

  /**
   * アクティブなアイテムを更新する
   */
  updateActive(): void {
    const items = this.dom.listEl?.querySelectorAll('.item') || [];
    items.forEach((el, idx) => {
      el.classList.toggle('active', idx === this.state.activeIndex);
    });
  }

  /**
   * アイテムを開く
   */
  openItem(item: SiteEntry, shiftPressed: boolean): void {
    // この処理はPaletteCoreに委ねる
    console.log('Opening item:', item, 'shift:', shiftPressed);
  }

  /**
   * エントリを取得する
   */
  getEntries(): SiteEntry[] {
    const sites = getSites();
    return [...sites];
  }

  /**
   * 使用回数キャッシュを取得する（暫定実装）
   */
  private getUsageCache(): Record<string, number> {
    try {
      return (window as any).GM_getValue?.('vm_sites_palette__usage_v1', {}) || {};
    } catch {
      return {};
    }
  }
}
