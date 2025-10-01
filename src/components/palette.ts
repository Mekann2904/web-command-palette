import { SiteEntry, Settings } from '@/types';
import { AppState, DOMElements } from '@/core/state';
import { getSettings, getSites, getUsageCache } from '@/core/storage';
import { DEFAULT_PLACEHOLDER } from '@/constants';
import { PaletteUI } from './palette-ui';
import { PaletteEventHandler } from './palette-event-handler';
import { extractTagFilter, filterAndScoreEntries, filterEntriesByTag } from '@/utils/search';

/**
 * メインパレットUIを管理するクラス
 * UI生成とイベント処理を分離したアーキテクチャを採用
 */
export class Palette {
  private state: AppState;
  private dom: DOMElements;
  private onExecuteEntry: (item: SiteEntry, shiftPressed: boolean) => void;
  private ui: PaletteUI;
  private eventHandler: PaletteEventHandler;
  private openManagerCallback: () => void;
  private openSettingsCallback: () => void;

  constructor(
    state: AppState, 
    dom: DOMElements, 
    onExecuteEntry: (item: SiteEntry, shiftPressed: boolean) => void,
    openManagerCallback: () => void,
    openSettingsCallback: () => void
  ) {
    this.state = state;
    this.dom = dom;
    this.onExecuteEntry = onExecuteEntry;
    this.openManagerCallback = openManagerCallback;
    this.openSettingsCallback = openSettingsCallback;
    
    // UIとイベントハンドラを初期化
    this.ui = new PaletteUI(state, dom);
    this.eventHandler = new PaletteEventHandler(
      state,
      dom,
      onExecuteEntry,
      (position) => this.handleVirtualScroll(position),
      () => this.hidePalette(),
      () => this.openManager(),
      () => this.openSettings()
    );
    
    // コールバックを設定
    this.setupCallbacks();
    
    // 仮想スクロールハンドラを設定
    this.ui.setVirtualScrollHandler((position) => this.handleVirtualScroll(position));
  }

  /**
   * コールバックを設定
   */
  private setupCallbacks(): void {
    this.eventHandler.setRenderCallback((scored, hasQuery) => {
      this.renderList(scored, hasQuery);
    });
    
    this.eventHandler.setUpdateActiveCallback((activeIndex) => {
      this.ui.updateActive(activeIndex);
    });
    
    this.eventHandler.setGetEntriesCallback(() => this.getEntries());
    
    this.eventHandler.setGetUsageCacheCallback(() => this.getUsageCache());
  }

  /**
   * Shadow Rootホストを確保する
   */
  ensureRoot(): void {
    this.ui.ensureRoot();
  }

  /**
   * パレットを開く
   */
  async openPalette(): Promise<void> {
    this.ensureRoot();
    this.state.cachedSettings = getSettings();
    this.ui.applyTheme(this.state.cachedSettings || undefined);
    this.state.isOpen = true;
    
    if (!this.dom.overlayEl) {
      this.ui.createPaletteUI();
      // イベントリスナーを設定
      this.eventHandler.setupEventListeners();
    }
    
    this.ui.showPalette();
    this.ui.clearInput();
    this.ui.setInputPlaceholder(DEFAULT_PLACEHOLDER);
    this.state.activeIndex = 0;
    this.eventHandler.renderList();
    
    // フォーカストラップを有効化
    this.ui.activateFocusTrap();
  }

  /**
   * パレットを閉じる
   */
  hidePalette(): void {
    this.state.isOpen = false;
    
    // フォーカストラップを無効化
    this.ui.deactivateFocusTrap();
    
    this.ui.hidePalette();
  }

  /**
   * テーマを適用する
   */
  applyTheme(): void {
    this.ui.applyTheme(this.state.cachedSettings || undefined);
  }

  /**
   * リストをレンダリング
   */
  renderList(scored: SiteEntry[], hasQuery: boolean): void {
    // 仮想スクロールを使用するかどうかを判定
    const useVirtualScroll = scored.length >= this.ui.getVirtualScrollThreshold();

    if (useVirtualScroll) {
      this.ui.renderVirtualList(scored, hasQuery);
    } else {
      this.ui.renderNormalList(scored, hasQuery);
    }

    this.state.currentItems = scored;
    this.ui.updateActive(this.state.activeIndex);
  }

  /**
   * 仮想スクロールイベントを処理
   */
  private handleVirtualScroll(position: any): void {
    const virtualScrollManager = this.ui.getVirtualScrollManager();
    const virtualScrollContainer = this.ui.getVirtualScrollContainer();
    const virtualScrollContent = this.ui.getVirtualScrollContent();
    
    if (!virtualScrollManager || !virtualScrollContainer || !virtualScrollContent) return;

    // 現在のスクロール位置で表示すべきアイテムを取得
    const scrollTop = virtualScrollContainer.scrollTop || 0;
    const visibleItems = virtualScrollManager.getVisibleItems(scrollTop);

    // コンテンツの高さを設定
    virtualScrollContent.style.height = `${virtualScrollManager.getTotalHeight()}px`;
    virtualScrollContent.innerHTML = '';

    // 表示アイテムをレンダリング
    visibleItems.forEach(({ item, index, style }) => {
      const { entry } = item.data;
      const itemEl = this.ui.createListItem(entry, index);
      itemEl.setAttribute('style', Object.entries(style).map(([k, v]) => `${k}: ${v}`).join('; '));
      virtualScrollContent!.appendChild(itemEl);
    });
  }

  /**
   * マネージャを開く
   */
  private openManager(): void {
    this.openManagerCallback();
  }

  /**
   * 設定を開く
   */
  private openSettings(): void {
    this.openSettingsCallback();
  }

  /**
   * エントリーを取得
   */
  getEntries(): SiteEntry[] {
    return getSites();
  }

  /**
   * 使用キャッシュを取得
   */
  getUsageCache(): Record<string, number> {
    try {
      return getUsageCache();
    } catch (error) {
      console.error('[CommandPalette] Error getting usage cache:', error);
      return {};
    }
  }

  /**
   * アイテムを開く
   */
  openItem(item: SiteEntry, shiftPressed: boolean): void {
    this.onExecuteEntry(item, shiftPressed);
  }

  /**
   * アクティブなアイテムを更新
   */
  updateActive(): void {
    this.ui.updateActive(this.state.activeIndex);
  }

  /**
   * 入力フィールドの値を取得
   */
  getInputValue(): string {
    return this.ui.getInputValue();
  }

  /**
   * リストを再レンダリング
   */
  refreshList(): void {
    this.eventHandler.renderList();
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    this.eventHandler.cleanup();
  }
}
