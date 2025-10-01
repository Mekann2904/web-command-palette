import { SiteEntry } from '@/types';
import { AppState, DOMElements } from '@/core/state';
import { EventListeners } from '@/utils/events';
import { debounce } from '@/utils/debounce';
import { extractTagFilter, filterAndScoreEntries, filterEntriesByTag } from '@/utils/search';

/**
 * パレットのイベント処理を担当するクラス
 * ユーザーインタラクションの処理、イベントリスナーの管理などを行う
 */
export class PaletteEventHandler {
  private state: AppState;
  private dom: DOMElements;
  private onExecuteEntry: (item: SiteEntry, shiftPressed: boolean) => void;
  private debouncedRenderList: () => void;
  private onVirtualScroll: (position: any) => void;
  private onEscape: () => void;
  private onOpenManager: () => void;
  private onOpenSettings: () => void;
  private onBingSearch: () => void = () => {};
  private onRenderList: (scored: SiteEntry[], hasQuery: boolean) => void = () => {};
  private onUpdateActive: (activeIndex: number) => void = () => {};

  constructor(
    state: AppState,
    dom: DOMElements,
    onExecuteEntry: (item: SiteEntry, shiftPressed: boolean) => void,
    onVirtualScroll: (position: any) => void,
    onEscape: () => void,
    onOpenManager: () => void,
    onOpenSettings: () => void,
    onBingSearch?: () => void
  ) {
    this.state = state;
    this.dom = dom;
    this.onExecuteEntry = onExecuteEntry;
    this.onVirtualScroll = onVirtualScroll;
    this.onEscape = onEscape;
    this.onOpenManager = onOpenManager;
    this.onOpenSettings = onOpenSettings;
    this.onBingSearch = onBingSearch || (() => {});
    
    // デバウンスされたレンダリング関数を作成（統一された遅延時間）
    this.debouncedRenderList = debounce(() => this.performRenderList(), 100);
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners(): void {
    this.setupInputEventListeners();
    this.setupListEventListeners();
    this.setupHintEventListeners();
    this.setupKeyboardEventListeners();
  }

  /**
   * 入力フィールドのイベントリスナーを設定
   */
  private setupInputEventListeners(): void {
    if (!this.dom.inputEl) return;

    // デバッグログ：入力要素の状態
    console.log('[Debug] Setting up input event listeners', {
      inputElement: this.dom.inputEl,
      inputType: this.dom.inputEl.type,
      inputId: this.dom.inputEl.id,
      inputClasses: this.dom.inputEl.className
    });

    // 入力イベント（統一されたデバウンス処理）
    this.dom.inputEl.addEventListener('input', (e) => {
      this.state.activeIndex = 0;
      this.renderList();
    });

    // キーダウンイベント
    EventListeners.addKeydown(this.dom.inputEl, (e) => {
      this.handleInputKeydown(e);
    });

    // 入力フィールドがフォーカスされたときの処理
    this.dom.inputEl.addEventListener('focus', (e) => {
      // フォーカス処理
    });

    // コンポジションイベント（日本語入力など）
    this.dom.inputEl.addEventListener('compositionstart', (e) => {
      // コンポジション開始時にフラグを設定
      (this.dom.inputEl as any).isComposing = true;
    });

    this.dom.inputEl.addEventListener('compositionupdate', (e) => {
      // コンポジション更新中は検索を実行しない
      (this.dom.inputEl as any).isComposing = true;
    });

    this.dom.inputEl.addEventListener('compositionend', (e) => {
      // コンポジション終了時にフラグを解除して検索を実行
      (this.dom.inputEl as any).isComposing = false;
      this.state.activeIndex = 0;
      this.renderList();
    });
  }

  /**
   * リストのイベントリスナーを設定
   */
  private setupListEventListeners(): void {
    if (!this.dom.listEl) return;

    // マウスイベント
    this.dom.listEl.addEventListener('mouseenter', (e) => {
      const item = (e.target as HTMLElement).closest('.item');
      if (item) {
        const index = parseInt((item as HTMLElement).dataset.index || '0', 10);
        if (!isNaN(index)) {
          this.state.activeIndex = index;
          this.updateActive();
        }
      }
    }, true);

    // クリックイベント
    this.dom.listEl.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest('.item');
      if (item) {
        const index = parseInt((item as HTMLElement).dataset.index || '0', 10);
        if (!isNaN(index) && this.state.currentItems) {
          const entry = this.state.currentItems[index];
          if (entry) {
            this.openItem(entry, e.shiftKey);
          }
        }
      }
    });

    // マウスダウンイベント（フォーカス維持用）
    EventListeners.addMouseDown(this.dom.listEl, () => {
      if (this.dom.inputEl) {
        this.dom.inputEl.focus();
      }
    });
  }

  /**
   * ヒント領域のイベントリスナーを設定
   */
  private setupHintEventListeners(): void {
    if (!this.dom.hintEl) return;

    // マネージャリンク
    const managerLink = this.dom.hintEl.querySelector('#vm-open-manager');
    if (managerLink) {
      managerLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.onOpenManager();
      });
    }

    // 設定リンク
    const settingsLink = this.dom.hintEl.querySelector('#vm-open-settings');
    if (settingsLink) {
      settingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.onOpenSettings();
      });
    }
  }

  /**
   * キーボードイベントリスナーを設定
   */
  private setupKeyboardEventListeners(): void {
    if (!this.dom.overlayEl) return;

    EventListeners.addKeydown(this.dom.overlayEl, (e) => {
      this.handleOverlayKeydown(e);
    });
  }

  /**
   * 入力フィールドのキーダウンイベントを処理
   */
  private handleInputKeydown(e: KeyboardEvent): void {
    // 日本語入力中は一部のキーのみを処理
    const isComposing = (this.dom.inputEl as any).isComposing || e.isComposing;
    
    // Meta+EnterでBing検索（日本語入力中も有効）
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      this.handleBingSearch();
      return;
    }

    // 日本語入力中はEnterキーとEscキーのみを処理
    if (isComposing) {
      if (e.key === 'Enter') {
        // 日本語入力中のEnterは変換確定なので、デフォルト動作を許可
        return;
      }
      if (e.key === 'Escape') {
        // 日本語入力中のEscapeは変換キャンセル
        e.preventDefault();
        this.onEscape();
        return;
      }
      // その他のキーはデフォルト動作を許可
      return;
    }

    // 通常時のキー処理
    switch (e.key) {
      case 'ArrowDown':
        if (this.state.currentItems && this.state.currentItems.length > 0) {
          e.preventDefault();
          this.state.activeIndex = Math.min(this.state.activeIndex + 1, this.state.currentItems.length - 1);
          this.updateActive();
        }
        break;
      case 'ArrowUp':
        if (this.state.currentItems && this.state.currentItems.length > 0) {
          e.preventDefault();
          this.state.activeIndex = Math.max(this.state.activeIndex - 1, 0);
          this.updateActive();
        }
        break;
      case 'Enter':
        if (this.state.currentItems && this.state.currentItems.length > 0) {
          e.preventDefault();
          const item = this.state.currentItems[this.state.activeIndex];
          if (item) {
            this.openItem(item, e.shiftKey);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.onEscape();
        break;
      case 'Tab':
        e.preventDefault();
        // タグ選択機能はオートコンプリート機能に統合されたため、ここでは何もしない
        break;
      case 'Home':
        e.preventDefault();
        if (this.state.currentItems && this.state.currentItems.length > 0) {
          this.state.activeIndex = 0;
          this.updateActive();
        }
        break;
      case 'End':
        e.preventDefault();
        if (this.state.currentItems && this.state.currentItems.length > 0) {
          this.state.activeIndex = this.state.currentItems.length - 1;
          this.updateActive();
        }
        break;
      default:
        // 英数字やその他の文字入力はデフォルトの動作を許可
        break;
    }
  }

  /**
   * オーバーレイのキーダウンイベントを処理
   */
  private handleOverlayKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.onEscape();
    }
  }

  /**
   * リストをレンダリング（デバウンス対応）
   */
  renderList(): void {
    this.debouncedRenderList();
  }

  /**
   * 実際のリストレンダリング処理
   */
  private performRenderList(): void {
    if (!this.dom.inputEl) return;

    const rawQuery = this.dom.inputEl.value || '';
    const { tagFilter, textQuery } = extractTagFilter(rawQuery);
    const entries = this.getEntries();
    
    // タグフィルタを適用
    const filtered = tagFilter ? filterEntriesByTag(entries, tagFilter) : entries;
    const scored = filterAndScoreEntries(filtered, textQuery, this.getUsageCache());

    if (scored.length) {
      if (this.state.activeIndex >= scored.length) this.state.activeIndex = scored.length - 1;
      if (this.state.activeIndex < 0) this.state.activeIndex = 0;
    } else {
      this.state.activeIndex = 0;
    }

    const hasQuery = !!(textQuery || tagFilter);

    // UIクラスにレンダリングを委譲
    this.onRenderList(scored, hasQuery);

    this.state.currentItems = scored;
    this.updateActive();
  }

  /**
   * アクティブなアイテムを更新
   */
  updateActive(): void {
    // UIクラスに更新を委譲
    this.onUpdateActive(this.state.activeIndex);
  }

  /**
   * アイテムを開く
   */
  openItem(item: SiteEntry, shiftPressed: boolean): void {
    this.onExecuteEntry(item, shiftPressed);
  }

  /**
   * エントリーを取得
   */
  getEntries(): SiteEntry[] {
    // このメソッドは実際の実装では外部から提供される
    return [];
  }

  /**
   * 使用キャッシュを取得
   */
  getUsageCache(): Record<string, number> {
    // このメソッドは実際の実装では外部から提供される
    return {};
  }

  /**
   * 仮想スクロールイベントを処理
   */
  handleVirtualScroll(position: any): void {
    this.onVirtualScroll(position);
  }

  /**
   * レンダリングコールバックを設定
   */
  setRenderCallback(callback: (scored: SiteEntry[], hasQuery: boolean) => void): void {
    this.onRenderList = callback;
  }

  /**
   * アクティブ更新コールバックを設定
   */
  setUpdateActiveCallback(callback: (activeIndex: number) => void): void {
    this.onUpdateActive = callback;
  }

  /**
   * エントリー取得コールバックを設定
   */
  setGetEntriesCallback(callback: () => SiteEntry[]): void {
    this.getEntries = callback;
  }

  /**
   * 使用キャッシュ取得コールバックを設定
   */
  setGetUsageCacheCallback(callback: () => Record<string, number>): void {
    this.getUsageCache = callback;
  }

  /**
   * Bing検索コールバックを設定
   */
  setBingSearchCallback(callback: () => void): void {
    this.onBingSearch = callback;
  }

  /**
   * Bing検索を処理
   */
  private handleBingSearch(): void {
    this.onBingSearch();
  }

  /**
   * イベントリスナーをクリーンアップ
   */
  cleanup(): void {
    // 必要に応じてイベントリスナーのクリーンアップを実装
  }
}