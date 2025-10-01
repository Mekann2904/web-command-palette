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
  private onRenderList: (scored: SiteEntry[], hasQuery: boolean) => void = () => {};
  private onUpdateActive: (activeIndex: number) => void = () => {};

  constructor(
    state: AppState, 
    dom: DOMElements, 
    onExecuteEntry: (item: SiteEntry, shiftPressed: boolean) => void,
    onVirtualScroll: (position: any) => void,
    onEscape: () => void,
    onOpenManager: () => void,
    onOpenSettings: () => void
  ) {
    this.state = state;
    this.dom = dom;
    this.onExecuteEntry = onExecuteEntry;
    this.onVirtualScroll = onVirtualScroll;
    this.onEscape = onEscape;
    this.onOpenManager = onOpenManager;
    this.onOpenSettings = onOpenSettings;
    
    // デバウンスされたレンダリング関数を作成
    this.debouncedRenderList = debounce(() => this.performRenderList(), 150);
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

    // 入力イベント
    this.dom.inputEl.addEventListener('input', () => {
      this.state.activeIndex = 0;
      this.renderList();
    });

    // キーダウンイベント
    EventListeners.addKeydown(this.dom.inputEl, (e) => {
      this.handleInputKeydown(e);
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
    if (!this.state.currentItems || !this.state.currentItems.length) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.state.activeIndex = Math.min(this.state.activeIndex + 1, this.state.currentItems.length - 1);
        this.updateActive();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.state.activeIndex = Math.max(this.state.activeIndex - 1, 0);
        this.updateActive();
        break;
      case 'Enter':
        e.preventDefault();
        const item = this.state.currentItems[this.state.activeIndex];
        if (item) {
          this.openItem(item, e.shiftKey);
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.onEscape();
        break;
      case 'Tab':
        e.preventDefault();
        // タグ選択機能はオートコンプリート機能に統一されたため、ここでは何もしない
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
   * イベントリスナーをクリーンアップ
   */
  cleanup(): void {
    // 必要に応じてイベントリスナーのクリーンアップを実装
  }
}