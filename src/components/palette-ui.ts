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
    return overlay;
  }

  /**
   * パネル要素を作成
   */
  private createPanelElement(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'panel';

    // 入力要素を作成
    this.dom.inputEl = document.createElement('input');
    this.dom.inputEl.className = 'input';
    this.dom.inputEl.type = 'text';

    // リスト要素を作成
    this.dom.listEl = document.createElement('div');
    this.dom.listEl.className = 'list';

    // ヒント要素を作成
    this.dom.hintEl = document.createElement('div');
    this.dom.hintEl.className = 'hint';
    this.dom.hintLeftSpan = document.createElement('span');
    this.dom.hintLeftSpan.textContent = '↑↓: 移動 / Enter: 開く / Shift+Enter: 新規タブ / Tab: タグ選択 / Esc: 閉じる';
    const rightSpan = document.createElement('span');
    rightSpan.innerHTML = '<span class="link" id="vm-open-manager" tabindex="0">サイトマネージャを開く</span> · <span class="link" id="vm-open-settings" tabindex="0">設定</span> · ⌘P / Ctrl+P';
    
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

    // ファビコンを作成
    const favicon = createFaviconEl(entry);
    item.appendChild(favicon);

    // 名前とURLのコンテナを作成
    const info = document.createElement('div');
    info.className = 'info';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = entry.name;

    // コマンドバッジを追加
    if ((entry as any).type === 'command') {
      const badge = document.createElement('span');
      badge.className = 'command-badge';
      badge.textContent = 'CMD';
      name.appendChild(badge);
    }

    const url = document.createElement('div');
    url.className = 'url';
    url.textContent = entry.url;

    info.appendChild(name);
    info.appendChild(url);

    // タグバッジを追加
    if (entry.tags && entry.tags.length > 0) {
      const tagBadges = document.createElement('div');
      tagBadges.className = 'tag-badges';

      entry.tags.forEach(tag => {
        const tagEl = document.createElement('span');
        tagEl.className = 'tag';
        tagEl.textContent = tag;
        tagBadges.appendChild(tagEl);
      });

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
      } else {
        item.classList.remove('active');
      }
    });

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
  renderNormalList(scored: SiteEntry[], hasQuery: boolean): void {
    if (!this.dom.listEl) return;

    this.dom.listEl.innerHTML = '';
    
    if (!scored.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
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
    
    this.dom.overlayEl.style.display = 'block';
    
    // CSSベースの遷移を発火
    this.dom.overlayEl.classList.add('visible');
    
    setFocusTimeout(() => {
      if (this.dom.inputEl) {
        this.dom.inputEl.focus();
      }
    });
  }

  /**
   * パレットを非表示
   */
  hidePalette(): void {
    if (!this.dom.overlayEl) return;
    
    this.dom.overlayEl.classList.remove('visible');
    
    // CSSのtransition時間を踏まえて余裕を持って隠す
    setTimeout(() => {
      if (this.dom.overlayEl && !this.state.isOpen) {
        this.dom.overlayEl.style.display = 'none';
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