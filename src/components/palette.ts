import { SiteEntry, Settings } from '@/types';
import { AppState, DOMElements } from '@/core/state';
import { getSettings, getSites } from '@/core/storage';
import { DEFAULT_PLACEHOLDER, themes } from '@/constants';
import { extractTagFilter, filterAndScoreEntries, filterEntriesByTag, shouldShowTagSuggestions } from '@/utils/search';
import { createFaviconEl } from '@/utils/dom';
import { escapeHtml, normalize } from '@/utils/string';
import { debounce } from '@/utils/debounce';
import { fadeIn, fadeOut, slideInFromTop, scaleIn } from '@/utils/animations';
import { VirtualScrollManager, VirtualScrollItem, createVirtualScrollContainer } from '@/utils/virtual-scroll';

/**
 * メインパレットUIを管理するクラス
 */
export class Palette {
  private state: AppState;
  private dom: DOMElements;
  private debouncedRenderList: () => void;
  private virtualScrollManager: VirtualScrollManager | null = null;
  private virtualScrollContainer: HTMLElement | null = null;
  private virtualScrollContent: HTMLElement | null = null;
  private readonly VIRTUAL_SCROLL_THRESHOLD = 50; // 50アイテム以上で仮想スクロールを有効化

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
  async openPalette(): Promise<void> {
    this.ensureRoot();
    this.state.cachedSettings = getSettings();
    this.applyTheme();
    this.state.isOpen = true;
    
    if (!this.dom.overlayEl) {
      this.createPaletteUI();
    }
    
    this.dom.overlayEl!.style.display = 'block';
    
    // CSSベースの遷移を発火
    this.dom.overlayEl!.classList.add('visible');
    
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
    // CSSのtransition時間を踏まえて余裕を持って隠す
    setTimeout(() => {
      if (!this.state.isOpen && this.dom.overlayEl) {
        this.dom.overlayEl.style.display = 'none';
      }
    }, 220);
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
    try {
      // Rootが確保されているか確認
      if (!this.dom.root) {
        console.error('[CommandPalette] Shadow root not available');
        return;
      }

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
      
      // nullチェックを追加
      if (this.dom.hintEl && this.dom.hintLeftSpan && rightSpan) {
        this.dom.hintEl.appendChild(this.dom.hintLeftSpan);
        this.dom.hintEl.appendChild(rightSpan);
      }

      if (panel && this.dom.inputEl && this.dom.listEl && this.dom.hintEl) {
        panel.appendChild(this.dom.inputEl);
        panel.appendChild(this.dom.listEl);
        panel.appendChild(this.dom.hintEl);
      }

      if (this.dom.overlayEl && panel) {
        this.dom.overlayEl.appendChild(panel);
      }
      
      // トースト要素を作成
      this.dom.toastEl = document.createElement('div');
      this.dom.toastEl.className = 'toast';
      
      // nullチェックを追加してからappendChild
      if (this.dom.root) {
        this.dom.root.appendChild(style);
        if (this.dom.overlayEl) {
          this.dom.root.appendChild(this.dom.overlayEl);
        }
        if (this.dom.toastEl) {
          this.dom.root.appendChild(this.dom.toastEl);
        }
      }

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

        /* タグ候補 */
        .tag-suggestion {
          display: grid;
          grid-template-columns: 28px 1fr auto;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          cursor: pointer;
          transition: background 0.12s ease, transform 0.12s ease;
          background: var(--tag-suggestion-bg);
          border-bottom: 1px solid var(--border-color);
          border-radius: 0;
        }
        .tag-suggestion:first-child { border-radius: 8px 8px 0 0; }
        .tag-suggestion:last-child { border-radius: 0 0 8px 8px; border-bottom: none; }
        .tag-suggestion:hover, .tag-suggestion.active {
          background: var(--item-active);
          transform: translateX(2px);
        }
        .tag-suggestion .tag-icon {
          width: 18px;
          height: 18px;
          border-radius: 4px;
          background: var(--accent-color);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
        }
        .tag-suggestion .tag-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .tag-suggestion .tag-name {
          font-size: 14px;
          font-weight: 500;
          color: var(--panel-text);
        }
        .tag-suggestion .tag-path {
          font-size: 11px;
          color: var(--muted);
        }
        .tag-suggestion .tag-count {
          font-size: 12px;
          color: var(--muted);
        }
        .tag-suggestion .kbd {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 6px;
          background: var(--hint-bg);
          border: 1px solid var(--border-color);
          font-size: 12px;
          color: var(--input-text);
        }
      `;
      
      if (this.dom.root) {
        this.dom.root.appendChild(managerStyle);
      }

      // グローバルアクセス用
      if (this.dom.toastEl) {
        (window as any).toastEl = this.dom.toastEl;
      }
    } catch (error) {
      console.error('[CommandPalette] Error creating palette UI:', error);
    }
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
    
    // タグフィルタを適用
    const filtered = tagFilter ? filterEntriesByTag(entries, tagFilter) : entries;
    const scored = filterAndScoreEntries(filtered, textQuery, this.getUsageCache());
    
    // タグ候補を表示するか判定
    const showTagSuggestions = shouldShowTagSuggestions(rawQuery);
    
    if (scored.length) {
      if (this.state.activeIndex >= scored.length) this.state.activeIndex = scored.length - 1;
      if (this.state.activeIndex < 0) this.state.activeIndex = 0;
    } else {
      this.state.activeIndex = 0;
    }

    // 仮想スクロールを使用するかどうかを判定
    const useVirtualScroll = scored.length >= this.VIRTUAL_SCROLL_THRESHOLD;
    const hasQuery = !!(textQuery || tagFilter);

    if (useVirtualScroll) {
      this.renderVirtualList(scored, hasQuery, showTagSuggestions);
    } else {
      this.renderNormalList(scored, hasQuery, showTagSuggestions);
    }

    this.state.currentItems = scored;
    this.updateActive();
  }

  /**
   * 仮想スクロールを使用してリストをレンダリング
   */
  private renderVirtualList(scored: SiteEntry[], hasQuery: boolean, showTagSuggestions: boolean = false): void {
    if (!this.dom.listEl) return;

    // 仮想スクロールコンテナを初期化
    if (!this.virtualScrollManager) {
      this.setupVirtualScroll();
    }

    // 仮想スクロール用のアイテムデータに変換
    // タグ候補はオートコンプリート機能に任せるため、ここでは考慮しない
    const virtualItems: VirtualScrollItem[] = scored.map((entry, index) => ({
      id: entry.id,
      data: { entry, index }
    }));

    this.virtualScrollManager!.setItems(virtualItems);

    // 現在のスクロール位置で表示すべきアイテムを取得
    const scrollTop = this.virtualScrollContainer?.scrollTop || 0;
    const visibleItems = this.virtualScrollManager!.getVisibleItems(scrollTop);

    // コンテンツの高さを設定
    if (this.virtualScrollContent) {
      this.virtualScrollContent.style.height = `${this.virtualScrollManager!.getTotalHeight()}px`;
      this.virtualScrollContent.innerHTML = '';

      // 表示アイテムをレンダリング
      visibleItems.forEach(({ item, index, style }) => {
        const { entry } = item.data;
        const itemEl = this.createListItem(entry, index);
        itemEl.setAttribute('style', Object.entries(style).map(([k, v]) => `${k}: ${v}`).join('; '));
        this.virtualScrollContent!.appendChild(itemEl);
      });
    }
  }

  /**
   * 通常のリストをレンダリング
   */
  private renderNormalList(scored: SiteEntry[], hasQuery: boolean, showTagSuggestions: boolean = false): void {
    if (!this.dom.listEl) return;

    this.dom.listEl.innerHTML = '';
    
    // タグ候補はオートコンプリート機能に任せるため、ここでは表示しない
    // showTagSuggestions パラメータは互換性のために残す
    
    if (!scored.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = hasQuery ? '一致なし' : 'サイトが登録されていません。サイトマネージャで追加してください。';
      this.dom.listEl.appendChild(empty);
      return;
    }

    // アイテムをアニメーション付きで追加
    scored.forEach((entry, idx) => {
      const item = this.createListItem(entry, idx);
      item.style.opacity = '0';
      item.style.transform = 'translateY(10px)';
      
      // アニメーションを適用
      setTimeout(() => {
        scaleIn(item, 120);
      }, idx * 30);
      
      this.dom.listEl!.appendChild(item);
    });
  }

  /**
   * タグ候補を作成（オートコンプリート機能に統一したため使用しない）
   */
  /*
  private createTagSuggestions(): HTMLElement[] {
    const rawQuery = this.dom.inputEl?.value || '';
    const { tagFilter, textQuery } = extractTagFilter(rawQuery);
    
    if (!rawQuery.includes('#') || rawQuery.includes(' ')) {
      return [];
    }

    const entries = this.getEntries();
    const allTags = this.getAllTags(entries);
    
    const tagCounts: Record<string, number> = {};
    entries.forEach(entry => {
      if (entry.tags) {
        entry.tags.forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    const afterHash = rawQuery.slice(rawQuery.indexOf('#') + 1);
    let filteredTags = [];

    if (afterHash.includes('/')) {
      const parts = afterHash.split('/');
      const parentQuery = parts.slice(0, -1).join('/');
      const childQuery = parts[parts.length - 1];
      
      filteredTags = allTags.filter(tag => {
        if (tag.startsWith(parentQuery + '/')) {
          const childPart = tag.slice(parentQuery.length + 1);
          return childPart.toLowerCase().includes(childQuery.toLowerCase());
        }
        return false;
      });
    } else {
      filteredTags = allTags.filter(tag => {
        const tagLower = tag.toLowerCase();
        const queryLower = afterHash.toLowerCase();
        
        if (tagLower === queryLower) return true;
        if (tagLower.includes(queryLower)) return true;
        
        const parts = tag.split('/');
        if (parts.some(part => part.toLowerCase().includes(queryLower))) return true;
        
        return false;
      });
    }

    filteredTags.sort((a, b) => {
      const aDepth = (a.match(/\//g) || []).length;
      const bDepth = (b.match(/\//g) || []).length;
      if (aDepth !== bDepth) return aDepth - bDepth;
      return a.localeCompare(b);
    });

    return filteredTags.slice(0, 5).map((tag, index) => {
      const suggestion = document.createElement('div');
      suggestion.className = 'tag-suggestion';
      suggestion.dataset.index = index.toString();
      suggestion.dataset.tag = tag;
      
      const tagIcon = document.createElement('div');
      tagIcon.className = 'tag-icon';
      tagIcon.textContent = '#';
      
      const tagInfo = document.createElement('div');
      tagInfo.className = 'tag-info';
      
      const tagName = document.createElement('div');
      tagName.className = 'tag-name';
      const displayName = tag.split('/').pop();
      tagName.textContent = displayName || tag;
      
      const tagPath = document.createElement('div');
      tagPath.className = 'tag-path';
      tagPath.textContent = tag;
      
      tagInfo.appendChild(tagName);
      tagInfo.appendChild(tagPath);
      
      const tagCount = document.createElement('div');
      tagCount.className = 'tag-count';
      tagCount.textContent = `${tagCounts[tag] || 0}件`;
      
      const kbd = document.createElement('span');
      kbd.className = 'kbd';
      kbd.textContent = '↵';
      
      suggestion.appendChild(tagIcon);
      suggestion.appendChild(tagInfo);
      suggestion.appendChild(tagCount);
      suggestion.appendChild(kbd);
      
      suggestion.addEventListener('mouseenter', () => {
        this.state.activeIndex = index;
        this.updateActive();
      });
      
      suggestion.addEventListener('mousedown', e => e.preventDefault());
      suggestion.addEventListener('click', () => {
        this.selectTag(tag);
      });

      return suggestion;
    });
  }
  */

  /**
   * タグ候補数を取得（オートコンプリート機能に統一したため使用しない）
   */
  /*
  private getTagSuggestionsCount(): number {
    const rawQuery = this.dom.inputEl?.value || '';
    if (!rawQuery.includes('#') || rawQuery.includes(' ')) {
      return 0;
    }
    
    const entries = this.getEntries();
    const allTags = this.getAllTags(entries);
    const afterHash = rawQuery.slice(rawQuery.indexOf('#') + 1);
    
    let filteredTags = [];
    if (afterHash.includes('/')) {
      const parts = afterHash.split('/');
      const parentQuery = parts.slice(0, -1).join('/');
      const childQuery = parts[parts.length - 1];
      
      filteredTags = allTags.filter(tag => {
        if (tag.startsWith(parentQuery + '/')) {
          const childPart = tag.slice(parentQuery.length + 1);
          return childPart.toLowerCase().includes(childQuery.toLowerCase());
        }
        return false;
      });
    } else {
      filteredTags = allTags.filter(tag => {
        const tagLower = tag.toLowerCase();
        const queryLower = afterHash.toLowerCase();
        
        if (tagLower === queryLower) return true;
        if (tagLower.includes(queryLower)) return true;
        
        const parts = tag.split('/');
        if (parts.some(part => part.toLowerCase().includes(queryLower))) return true;
        
        return false;
      });
    }
    
    return Math.min(filteredTags.length, 5);
  }
  */

  /**
   * すべてのタグを取得
   */
  private getAllTags(entries: SiteEntry[]): string[] {
    const tagSet = new Set<string>();
    entries.forEach(item => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach(tag => {
          if (tag && typeof tag === 'string' && tag.trim()) {
            tagSet.add(tag.trim());
          }
        });
      }
    });
    return Array.from(tagSet).sort();
  }

  /**
   * タグを選択（オートコンプリート機能に統一したため使用しない）
   */
  /*
  private selectTag(tag: string): void {
    const currentValue = this.dom.inputEl!.value;
    const hashIndex = currentValue.indexOf('#');
    
    if (hashIndex >= 0) {
      const beforeHash = currentValue.slice(0, hashIndex);
      this.dom.inputEl!.value = beforeHash + '#' + tag;
    } else {
      this.dom.inputEl!.value = '#' + tag;
    }
    
    this.dom.inputEl!.focus();
    // 入力後にスペースを追加して検索できるようにする
    setTimeout(() => {
      this.dom.inputEl!.value += ' ';
      this.renderList();
    }, 0);
  }
  */

  /**
   * 仮想スクロールをセットアップ
   */
  private setupVirtualScroll(): void {
    if (!this.dom.listEl) return;

    const containerHeight = Math.min(window.innerHeight * 0.6, 600);
    
    const { container, content, manager } = createVirtualScrollContainer({
      containerHeight,
      itemHeight: 60, // 推定アイテム高さ
      onScroll: (position) => {
        // スクロール時に再レンダリング
        this.performRenderList();
      }
    });

    // 既存のリスト要素を仮想スクロールコンテナに置き換え
    this.virtualScrollContainer = container;
    this.virtualScrollContent = content;
    this.virtualScrollManager = manager;

    // スタイルを調整
    container.style.width = '100%';
    container.style.maxHeight = 'min(80vh, 1037px)';
    container.style.overflowY = 'auto';
    container.style.overflowX = 'hidden';
    container.style.scrollbarWidth = 'none';
    
    // Webkitスクロールバーを非表示
    const style = document.createElement('style');
    style.textContent = `
      .virtual-scroll-container::-webkit-scrollbar { 
        width: 0; 
        height: 0; 
      }
    `;
    container.appendChild(style);

    // 既存のリスト要素を置き換え
    if (this.dom.listEl.parentNode) {
      this.dom.listEl.parentNode.replaceChild(container, this.dom.listEl);
    }
    this.dom.listEl = container as HTMLDivElement;
  }

  /**
   * リストアイテム要素を作成
   */
  private createListItem(entry: SiteEntry, index: number): HTMLElement {
    const item = document.createElement('div');
    item.className = 'item';
    item.dataset.index = index.toString();
    
    item.addEventListener('mouseenter', () => { 
      this.state.activeIndex = index; 
      this.updateActive(); 
    });
    
    item.addEventListener('mousedown', e => e.preventDefault());
    item.addEventListener('click', () => { 
      this.openItem(entry, false); 
    });

    const icon = createFaviconEl(entry);

    const left = document.createElement('div');
    left.className = 'left';
    left.style.alignSelf = 'center';
    
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

    return item;
  }

  /**
   * アクティブなアイテムを更新する
   */
  updateActive(): void {
    const items = this.dom.listEl?.querySelectorAll('.item, .tag-suggestion') || [];
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
