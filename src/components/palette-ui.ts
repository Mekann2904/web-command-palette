import { SiteEntry, Settings } from '@/types';
import { AppState, DOMElements } from '@/core/state';
import { themes } from '@/constants';
import { createFaviconEl } from '@/utils/dom';
import { escapeHtml } from '@/utils/string';
import { fadeIn, fadeOut, slideInFromTop, scaleIn } from '@/utils/animations';
import { VirtualScrollManager, VirtualScrollItem, createVirtualScrollContainer } from '@/utils/virtual-scroll';
import { createFocusTrap, FocusTrap } from '@/utils/events';
import { setFocusTimeout } from '@/utils/timing';

/**
 * パレットUIの生成と管理を担当するクラス
 * UIの生成、スタイルの適用、DOM要素の作成などを行う
 */
export class PaletteUI {
  private state: AppState;
  private dom: DOMElements;
  private virtualScrollManager: VirtualScrollManager | null = null;
  private virtualScrollContainer: HTMLElement | null = null;
  private virtualScrollContent: HTMLElement | null = null;
  private readonly VIRTUAL_SCROLL_THRESHOLD = 50; // 50アイテム以上で仮想スクロールを有効化
  private focusTrap: FocusTrap | null = null;

  constructor(state: AppState, dom: DOMElements) {
    this.state = state;
    this.dom = dom;
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
   * テーマを適用する
   */
  applyTheme(settings?: Settings): void {
    if (!this.dom.root) return;
    const currentSettings = settings || this.state.cachedSettings;
    if (!currentSettings) return;
    
    const theme = currentSettings.theme === 'light' ? themes.light : themes.dark;
    const vars = { ...theme, '--accent-color': currentSettings.accentColor || '#2563eb' };
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

      const style = this.createPaletteStyles();
      this.dom.root.appendChild(style);

      // オーバーレイ要素を作成
      this.dom.overlayEl = this.createOverlayElement() as HTMLDivElement;
      
      // パネル要素を作成
      const panel = this.createPanelElement();
      if (this.dom.overlayEl) {
        this.dom.overlayEl.appendChild(panel);
      }
      
      // トースト要素を作成
      this.dom.toastEl = this.createToastElement() as HTMLDivElement;
      
      // マネージャと設定のCSSを追加
      const managerStyle = this.createManagerStyles();
      this.dom.root.appendChild(managerStyle);

      // nullチェックを追加してからappendChild
      if (this.dom.root) {
        if (this.dom.overlayEl) {
          this.dom.root.appendChild(this.dom.overlayEl);
        }
        if (this.dom.toastEl) {
          this.dom.root.appendChild(this.dom.toastEl);
        }
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
   * パレットのスタイルを作成
   */
  private createPaletteStyles(): HTMLStyleElement {
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .overlay { position: fixed; inset: 0; background: var(--overlay-bg); display: none; z-index: 2147483647; backdrop-filter: blur(1px); opacity: 0; transition: opacity 160ms ease; }
      .overlay.visible { opacity: 1; }
      .panel { position: absolute; left: 50%; top: 16%; transform: translateX(-50%); width: min(720px, 92vw); max-height: 75vh; background: var(--panel-bg); color: var(--panel-text); border-radius: 14px; box-shadow: var(--panel-shadow); overflow: hidden; font-family: ui-sans-serif, -apple-system, system-ui, Segoe UI, Roboto, 'Helvetica Neue', Arial, 'Apple Color Emoji','Segoe UI Emoji'; border: 1px solid var(--border-color); opacity: 0; transition: opacity 200ms ease; display: flex; flex-direction: column; }
      .overlay.visible .panel { opacity: 1; }
      .input { width: 100%; box-sizing: border-box; padding: 0.875rem 1rem; font-size: 0.9375rem; background: var(--input-bg); color: var(--input-text); border: none; outline: none; }
      .input::placeholder { color: var(--input-placeholder); }
      .hint { padding: 0.375rem 0.75rem; font-size: 0.75rem; color: var(--muted); border-top: 1px solid var(--border-color); background: var(--hint-bg); display: flex; align-items: center; justify-content: space-between; }
      .link { cursor: pointer; color: var(--accent-color); }
      .list { max-height: min(60vh, 800px); overflow-y: auto; overflow-x: hidden; scrollbar-width: none; }
      .list::-webkit-scrollbar { width: 0; height: 0; }
      .item { display: grid; grid-template-columns: 1.75rem 1fr auto; align-items: center; gap: 0.625rem; padding: 0.625rem 0.875rem; cursor: pointer; transition: background 0.12s ease, transform 0.12s ease; }
      .item:nth-child(odd) { background: var(--item-bg-alt); }
      .item.active { background: var(--item-active); transform: translateX(0.125rem); }
      .item .name { font-size: 0.875rem; display: flex; align-items: center; gap: 0.375rem; }
      .item .name .command-badge { margin-left: 0; }
      .item .url { font-size: 0.75rem; color: var(--muted); }
      .item img.ico { width: 1.125rem; height: 1.125rem; border-radius: 0.25rem; object-fit: contain; background: #fff; border: 1px solid var(--border-color); }
      .item .ico-letter { width: 1.125rem; height: 1.125rem; border-radius: 0.25rem; border: 1px solid var(--border-color); background: var(--hint-bg); color: var(--panel-text); font-size: 0.625rem; font-weight: 600; display: flex; align-items: center; justify-content: center; text-transform: uppercase; }
      .item .tag-badges { display: flex; gap: 0.25rem; margin-top: 0.25rem; flex-wrap: wrap; }
      .tag { display: inline-flex; align-items: center; padding: 0.125rem 0.375rem; background: var(--tag-bg); color: var(--tag-text); font-size: 0.625rem; border-radius: 999px; }
      .tag::before { content: '#'; opacity: 0.7; margin-right: 0.125rem; }
      .tag-more { background: var(--muted); color: var(--panel-text); font-weight: 600; cursor: help; }
      .empty { padding: 1.125rem 0.875rem; color: var(--muted); font-size: 0.875rem; }
      .kbd { display: inline-block; padding: 0.125rem 0.375rem; border-radius: 0.375rem; background: var(--hint-bg); border: 1px solid var(--border-color); font-size: 0.75rem; color: var(--input-text); }
      .command-badge { margin-left: 0.375rem; padding: 0.125rem 0.375rem; border-radius: 0.375rem; background: var(--command-badge-bg); font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--panel-text); }
      .group-title { padding: 0.5rem 1rem 0.25rem; font-size: 0.6875rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
    `;
    return style;
  }

  /**
   * マネージャと設定のスタイルを作成
   */
  private createManagerStyles(): HTMLStyleElement {
    const style = document.createElement('style');
    style.textContent = `
      /* Manager / Settings */
      .mgr-overlay, .set-overlay { position: fixed; inset: 0; background: var(--overlay-bg); display: none; z-index: 2147483647; }
      .mgr, .set { position: absolute; left: 50%; top: 8%; transform: translateX(-50%); width: min(53.75rem, 94vw); max-height: 85vh; overflow-y: auto; background: var(--panel-bg); color: var(--panel-text); border-radius: 0.875rem; box-shadow: var(--panel-shadow); font-family: ui-sans-serif, -apple-system, system-ui, Segoe UI, Roboto, 'Helvetica Neue', Arial, 'Apple Color Emoji','Segoe UI Emoji'; border: 1px solid var(--border-color); }
      .mgr header, .set header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0.875rem; border-bottom: 1px solid var(--border-color); position: sticky; top: 0; background: var(--panel-bg); z-index: 1; }
      .mgr header h3, .set header h3 { margin: 0; font-size: 1rem; }
      .mgr-tabs { display: flex; gap: 0.5rem; margin-bottom: 0.625rem; }
      .tab-btn { flex: none; }
      .tab-btn.active { box-shadow: inset 0 0 0 2px rgba(255,255,255,0.12); }
      .mgr-tab.hidden { display: none; }
      .mgr .tbl { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
      .mgr .tbl th, .mgr .tbl td { border-bottom: 1px solid var(--border-color); padding: 0.5rem 0.625rem; vertical-align: top; }
      .mgr .tbl th { text-align: left; color: var(--muted); font-weight: 600; }
      .mgr input[type=text], .mgr textarea, .set input[type=text], .set textarea, .set select, .set input[type=color] { width: 100%; box-sizing: border-box; padding: 0.375rem 0.5rem; font-size: 0.875rem; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--input-text); border-radius: 0.5rem; }
      .mgr textarea { resize: vertical; min-height: 3.5rem; }
      .mgr .row-btns button { margin-right: 0.375rem; }
      .btn { padding: 0.375rem 0.625rem; border-radius: 0.5rem; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--panel-text); cursor: pointer; transition: transform 0.12s ease, box-shadow 0.12s ease; }
      .btn:hover { transform: translateY(-0.0625rem); box-shadow: 0 0.375rem 1rem rgba(0,0,0,0.18); }
      .btn.primary { background: var(--accent-color); border-color: var(--accent-color); color: #fff; }
      .btn.danger { background: #7f1d1d; border-color: #7f1d1d; color: #fee2e2; }
      .mgr footer, .set footer { display: flex; align-items: center; justify-content: space-between; padding: 0.625rem 0.875rem; position: sticky; bottom: 0; background: var(--panel-bg); }
      .muted { color: var(--muted); font-size: 0.75rem; }
      .drag { cursor: grab; }
      .form-row { display: grid; grid-template-columns: 12.5rem 1fr; gap: 0.75rem; align-items: center; padding: 0.625rem 0.875rem; }
      .inline { display: flex; gap: 0.75rem; align-items: center; }
      .hotkey-box { text-align: center; font-size: 0.875rem; padding: 0.5rem 0.625rem; border: 1px dashed var(--border-color); border-radius: 0.5rem; user-select: none; background: var(--input-bg); color: var(--input-text); }
      .badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.125rem 0.5rem; border-radius: 999px; font-size: 0.6875rem; background: var(--command-badge-bg); color: var(--panel-text); }
      .toast { position: fixed; inset: auto 0 1.5rem 0; display: none; justify-content: center; pointer-events: none; }
      .toast-message { background: var(--toast-bg); color: var(--toast-text); padding: 0.625rem 1rem; border-radius: 999px; box-shadow: 0 0.625rem 1.25rem rgba(0,0,0,0.2); animation: fade-slide 2.4s ease forwards; }
      @keyframes fade-slide {
        0% { opacity: 0; transform: translateY(1.125rem); }
        10% { opacity: 1; transform: translateY(0); }
        90% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(0.75rem); }
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
    return style;
  }
  /**
   * 仮想スクロールイベントを処理（イベントハンドラから呼び出される）
   */
  handleVirtualScroll(position: any): void {
    // このメソッドは外部から設定されるコールバックを呼び出す
    // 実際の処理はPaletteクラスで実装される
  }

  /**
   * 仮想スクロールイベントハンドラを設定
   */
  setVirtualScrollHandler(handler: (position: any) => void): void {
    this.handleVirtualScroll = handler;
  }

  /**
   * オーバーレイ要素を作成
   */
  private createOverlayElement(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'コマンドパレット');
    overlay.setAttribute('tabindex', '-1');
    return overlay;
  }

  /**
   * パネル要素を作成
   */
  private createPanelElement(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.setAttribute('role', 'search');
    panel.setAttribute('aria-label', 'サイト検索');

    // 入力要素を作成
    this.dom.inputEl = document.createElement('input');
    this.dom.inputEl.className = 'input';
    this.dom.inputEl.type = 'text';
    this.dom.inputEl.setAttribute('role', 'combobox');
    this.dom.inputEl.setAttribute('aria-expanded', 'false');
    this.dom.inputEl.setAttribute('aria-autocomplete', 'list');
    this.dom.inputEl.setAttribute('aria-label', 'サイト名、URL、またはタグで検索');
    this.dom.inputEl.setAttribute('placeholder', 'サイト名、URL、またはタグで検索...');
    this.dom.inputEl.setAttribute('autocomplete', 'off');
    this.dom.inputEl.setAttribute('autocorrect', 'off');
    this.dom.inputEl.setAttribute('autocapitalize', 'off');
    this.dom.inputEl.setAttribute('spellcheck', 'false');

    // リスト要素を作成
    this.dom.listEl = document.createElement('div');
    this.dom.listEl.className = 'list';
    this.dom.listEl.setAttribute('role', 'listbox');
    this.dom.listEl.setAttribute('aria-label', '検索結果');

    // ヒント要素を作成
    this.dom.hintEl = document.createElement('div');
    this.dom.hintEl.className = 'hint';
    this.dom.hintEl.setAttribute('role', 'status');
    this.dom.hintEl.setAttribute('aria-live', 'polite');
    this.dom.hintLeftSpan = document.createElement('span');
    this.dom.hintLeftSpan.textContent = '↑↓: 移動 / Enter: 開く / Shift+Enter: 新規タブ / Tab: タグ選択 / Esc: 閉じる';
    this.dom.hintLeftSpan.setAttribute('aria-hidden', 'true');
    const rightSpan = document.createElement('span');
    rightSpan.innerHTML = '<span class="link" id="vm-open-manager" tabindex="0" role="button" aria-label="サイトマネージャを開く">サイトマネージャを開く</span> · <span class="link" id="vm-open-settings" tabindex="0" role="button" aria-label="設定を開く">設定</span> · ⌘P / Ctrl+P';
    rightSpan.setAttribute('aria-hidden', 'true');
    
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

    return panel;
  }

  /**
   * トースト要素を作成
   */
  private createToastElement(): HTMLElement {
    const toast = document.createElement('div');
    toast.className = 'toast';
    return toast;
  }

  /**
   * 仮想スクロールをセットアップ
   */
  setupVirtualScroll(): void {
    if (!this.dom.listEl) return;

    // 既存の仮想スクロールコンテナをクリア
    if (this.virtualScrollContainer) {
      this.dom.listEl.removeChild(this.virtualScrollContainer);
      this.virtualScrollContainer = null;
      this.virtualScrollContent = null;
      this.virtualScrollManager = null;
    }

    // 仮想スクロールコンテナを作成
    const { container, content, manager } = createVirtualScrollContainer({
      containerHeight: 600, // 固定高さ
      itemHeight: 50, // 推定アイテム高さ
      onScroll: (position) => {
        // スクロールイベントはイベントハンドラで処理
        this.handleVirtualScroll(position);
      }
    });

    this.virtualScrollContainer = container;
    this.virtualScrollContent = content;
    this.virtualScrollManager = manager;

    // コンテナをリストに追加
    this.dom.listEl.appendChild(container);
  }

  /**
   * リストアイテム要素を作成
   */
  createListItem(entry: SiteEntry, index: number): HTMLElement {
    const item = document.createElement('div');
    item.className = 'item';
    item.dataset.index = index.toString();
    item.dataset.id = entry.id;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', 'false');
    item.setAttribute('tabindex', '-1');
    
    // アクセシビリティ用のラベル
    const ariaLabel = `${entry.name} - ${entry.url}${entry.tags.length > 0 ? `。タグ: ${entry.tags.join(', ')}` : ''}`;
    item.setAttribute('aria-label', ariaLabel);

    // ファビコンを作成
    const favicon = createFaviconEl(entry);
    favicon.setAttribute('aria-hidden', 'true');
    item.appendChild(favicon);

    // 名前とURLのコンテナを作成
    const info = document.createElement('div');
    info.className = 'info';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = entry.name;
    name.setAttribute('aria-hidden', 'true');

    // コマンドバッジを追加
    if ((entry as any).type === 'command') {
      const badge = document.createElement('span');
      badge.className = 'command-badge';
      badge.textContent = 'CMD';
      badge.setAttribute('aria-label', 'コマンド');
      name.appendChild(badge);
    }

    const url = document.createElement('div');
    url.className = 'url';
    url.textContent = entry.url;
    url.setAttribute('aria-hidden', 'true');

    info.appendChild(name);
    info.appendChild(url);

    // タグバッジを追加（表示数制限付き）
    if (entry.tags && entry.tags.length > 0) {
      const tagBadges = document.createElement('div');
      tagBadges.className = 'tag-badges';
      tagBadges.setAttribute('aria-hidden', 'true');

      const maxTags = 3;
      const visibleTags = entry.tags.slice(0, maxTags);
      const remainingCount = entry.tags.length - maxTags;

      // 表示するタグ
      visibleTags.forEach(tag => {
        const tagEl = document.createElement('span');
        tagEl.className = 'tag';
        tagEl.textContent = tag;
        tagEl.setAttribute('aria-label', `タグ: ${tag}`);
        tagBadges.appendChild(tagEl);
      });

      // 残りのタグ数を表示
      if (remainingCount > 0) {
        const moreTagsEl = document.createElement('span');
        moreTagsEl.className = 'tag tag-more';
        moreTagsEl.textContent = `+${remainingCount}`;
        moreTagsEl.setAttribute('aria-label', `さらに${remainingCount}個のタグ`);
        moreTagsEl.title = `残りのタグ: ${entry.tags.slice(maxTags).join(', ')}`;
        tagBadges.appendChild(moreTagsEl);
      }

      info.appendChild(tagBadges);
    }

    item.appendChild(info);

    return item;
  }

  /**
   * アクティブなアイテムを更新
   */
  updateActive(activeIndex: number): void {
    if (!this.dom.listEl) return;

    const items = this.dom.listEl.querySelectorAll('.item');
    items.forEach((item, index) => {
      if (index === activeIndex) {
        item.classList.add('active');
        item.setAttribute('aria-selected', 'true');
        item.setAttribute('tabindex', '0');
      } else {
        item.classList.remove('active');
        item.setAttribute('aria-selected', 'false');
        item.setAttribute('tabindex', '-1');
      }
    });

    // 入力フィールドのaria-expandedを更新
    if (this.dom.inputEl) {
      this.dom.inputEl.setAttribute('aria-expanded', items.length > 0 ? 'true' : 'false');
    }

    // 仮想スクロールの場合はアクティブアイテムまでスクロール
    if (this.virtualScrollManager && this.virtualScrollContainer) {
      const activeItem = items[activeIndex] as HTMLElement;
      if (activeItem) {
        const itemId = activeItem.dataset.id;
        if (itemId) {
          this.virtualScrollManager.scrollToItem(itemId, this.virtualScrollContainer, 'center');
        }
      }
    }
  }

  /**
   * 仮想スクロールを使用してリストをレンダリング
   */
  renderVirtualList(scored: SiteEntry[], hasQuery: boolean): void {
    if (!this.dom.listEl) return;

    // 仮想スクロールコンテナを初期化
    if (!this.virtualScrollManager) {
      this.setupVirtualScroll();
    }

    // 仮想スクロール用のアイテムデータに変換
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

      // 表示アイテムをシンプルにレンダリング（アニメーションなし）
      visibleItems.forEach(({ item, index, style }) => {
        const { entry } = item.data as { entry: SiteEntry; index: number };
        const itemEl = this.createListItem(entry, index);
        itemEl.setAttribute('style', Object.entries(style).map(([k, v]) => `${k}: ${v}`).join('; '));
        this.virtualScrollContent!.appendChild(itemEl);
      });
    }
  }

  /**
   * 通常のリストをレンダリング
   */
  renderNormalList(scored: SiteEntry[], hasQuery: boolean): void {
    if (!this.dom.listEl) return;

    this.dom.listEl.innerHTML = '';
    
    if (!scored.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.setAttribute('role', 'status');
      empty.setAttribute('aria-live', 'polite');
      empty.textContent = hasQuery ? '一致なし' : 'サイトが登録されていません。サイトマネージャで追加してください。';
      this.dom.listEl.appendChild(empty);
      return;
    }

    // アイテムをシンプルに追加（アニメーションなし）
    scored.forEach((entry, idx) => {
      const item = this.createListItem(entry, idx);
      this.dom.listEl!.appendChild(item);
    });
  }

  /**
   * フォーカストラップを有効化
   */
  activateFocusTrap(): void {
    if (!this.dom.overlayEl) return;
    
    this.focusTrap = createFocusTrap(this.dom.overlayEl);
    
    this.focusTrap.activate();
  }

  /**
   * フォーカストラップを無効化
   */
  deactivateFocusTrap(): void {
    if (this.focusTrap) {
      this.focusTrap.deactivate();
      this.focusTrap = null;
    }
  }

  /**
   * パレットを表示
   */
  showPalette(): void {
    if (!this.dom.overlayEl) return;
    
    // デバッグログ：パネル表示前の状態
    console.log('[Debug] showPalette called', {
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      scrollTop: window.scrollY,
      scrollLeft: window.scrollX
    });
    
    this.dom.overlayEl.style.display = 'block';
    
    // パネルの位置とサイズを動的に調整
    this.adjustPanelPosition();
    
    // CSSベースの遷移を発火
    this.dom.overlayEl.classList.add('visible');
    
    // パネルの位置とサイズをデバッグ
    setTimeout(() => {
      if (this.dom.overlayEl && this.dom.overlayEl.querySelector('.panel')) {
        const panel = this.dom.overlayEl.querySelector('.panel') as HTMLElement;
        if (panel) {
          const rect = panel.getBoundingClientRect();
          console.log('[Debug] Panel dimensions and position after adjustment', {
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
            bottom: rect.bottom,
            right: rect.right,
            windowHeight: window.innerHeight,
            windowWidth: window.innerWidth
          });
        }
      }
    }, 100);
    
    setFocusTimeout(() => {
      if (this.dom.inputEl) {
        this.dom.inputEl.focus();
      }
    });
  }

  /**
   * パネルの位置とサイズを動的に調整
   */
  private adjustPanelPosition(): void {
    if (!this.dom.overlayEl || !this.dom.overlayEl.querySelector('.panel'))
      return;
      
    const panel = this.dom.overlayEl.querySelector('.panel') as HTMLElement;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const scrollTop = window.scrollY;
    const scrollLeft = window.scrollX;
    
    // パネルの最大サイズを計算
    const maxWidth = Math.min(720, windowWidth * 0.92);
    const maxHeight = windowHeight * 0.8;
    
    // パネルの位置を計算（中央配置）
    let top = scrollTop + (windowHeight * 0.1); // 画面の10%の位置から開始
    let left = scrollLeft + (windowWidth - maxWidth) / 2;
    
    // パネルが画面外にはみ出す場合の調整
    if (top < scrollTop) {
      top = scrollTop + 10; // 上端から10pxの位置
    }
    if (left < scrollLeft) {
      left = scrollLeft + 10; // 左端から10pxの位置
    }
    
    // パネルのスタイルを更新
    panel.style.width = `${maxWidth}px`;
    panel.style.maxHeight = `${maxHeight}px`;
    panel.style.position = 'absolute';
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.transform = 'none'; // transformをリセット
    
    console.log('[Debug] Adjusted panel position', {
      maxWidth,
      maxHeight,
      top,
      left,
      windowWidth,
      windowHeight,
      scrollTop,
      scrollLeft
    });
  }

  /**
   * パレットを非表示
   */
  hidePalette(): void {
    if (!this.dom.overlayEl) return;
    
    console.log('[Debug] Hiding palette');
    
    this.dom.overlayEl.classList.remove('visible');
    
    // CSSのtransition時間を踏まえて余裕を持って隠す
    setTimeout(() => {
      if (this.dom.overlayEl && !this.state.isOpen) {
        this.dom.overlayEl.style.display = 'none';
        console.log('[Debug] Palette hidden, display set to none');
      }
    }, 220);
  }

  /**
   * 入力フィールドをクリア
   */
  clearInput(): void {
    if (this.dom.inputEl) {
      this.dom.inputEl.value = '';
    }
  }

  /**
   * 入力フィールドにプレースホルダーを設定
   */
  setInputPlaceholder(placeholder: string): void {
    if (this.dom.inputEl) {
      this.dom.inputEl.placeholder = placeholder;
    }
  }

  /**
   * 入力フィールドの値を取得
   */
  getInputValue(): string {
    return this.dom.inputEl?.value || '';
  }

  /**
   * 仮想スクロールマネージャーを取得
   */
  getVirtualScrollManager(): VirtualScrollManager | null {
    return this.virtualScrollManager;
  }

  /**
   * 仮想スクロールコンテナを取得
   */
  getVirtualScrollContainer(): HTMLElement | null {
    return this.virtualScrollContainer;
  }

  /**
   * 仮想スクロールコンテンツを取得
   */
  getVirtualScrollContent(): HTMLElement | null {
    return this.virtualScrollContent;
  }

  /**
   * 仮想スクロールしきい値を取得
   */
  getVirtualScrollThreshold(): number {
    return this.VIRTUAL_SCROLL_THRESHOLD;
  }
}