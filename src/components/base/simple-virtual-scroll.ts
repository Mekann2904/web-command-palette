/**
 * シンプルな仮想スクロール実装
 * パフォーマンスを最適化し、大量のアイテムを効率的に表示する
 */

export interface VirtualScrollItem {
  id: string;
  data: any;
  height?: number;
}

export interface VirtualScrollOptions {
  containerHeight: number;
  itemHeight: number;
  overscan?: number;
  onScroll?: (scrollTop: number) => void;
  onItemsChange?: (visibleItems: VirtualScrollItem[]) => void;
}

export class SimpleVirtualScroll {
  private container: HTMLElement;
  private content!: HTMLElement;
  private options: Required<VirtualScrollOptions>;
  private items: VirtualScrollItem[] = [];
  private visibleItems: VirtualScrollItem[] = [];
  private scrollTop: number = 0;
  private isScrolling: boolean = false;
  private scrollTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(container: HTMLElement, options: VirtualScrollOptions) {
    this.container = container;
    this.options = {
      overscan: 5,
      onScroll: () => {},
      onItemsChange: () => {},
      ...options
    };

    this.setupContainer();
    this.setupEventListeners();
  }

  /**
   * コンテナをセットアップする
   */
  private setupContainer(): void {
    // コンテナのスタイルを設定
    this.container.style.overflow = 'auto';
    this.container.style.height = `${this.options.containerHeight}px`;
    this.container.style.position = 'relative';

    // コンテンツ要素を作成
    this.content = document.createElement('div');
    this.content.style.position = 'relative';
    this.content.style.width = '100%';
    
    this.container.appendChild(this.content);
  }

  /**
   * イベントリスナーをセットアップする
   */
  private setupEventListeners(): void {
    this.container.addEventListener('scroll', this.handleScroll);
    
    // リサイズイベントを監視
    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(() => {
        this.updateVisibleItems();
      });
      resizeObserver.observe(this.container);
    }
  }

  /**
   * スクロールイベントを処理する
   */
  private handleScroll = (): void => {
    this.scrollTop = this.container.scrollTop;
    
    // スクロール中フラグを設定
    this.isScrolling = true;
    
    // スクロール終了を検出
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    
    this.scrollTimeout = setTimeout(() => {
      this.isScrolling = false;
    }, 150);
    
    // 表示アイテムを更新
    this.updateVisibleItems();
    
    // コールバックを実行
    this.options.onScroll(this.scrollTop);
  };

  /**
   * アイテムを設定する
   */
  public setItems(items: VirtualScrollItem[]): void {
    this.items = items;
    this.updateContentHeight();
    this.updateVisibleItems();
  }

  /**
   * コンテンツの高さを更新する
   */
  private updateContentHeight(): void {
    const totalHeight = this.items.reduce((sum, item) => {
      return sum + (item.height || this.options.itemHeight);
    }, 0);
    
    this.content.style.height = `${totalHeight}px`;
  }

  /**
   * 表示アイテムを更新する
   */
  private updateVisibleItems(): void {
    if (this.items.length === 0) {
      this.visibleItems = [];
      this.renderItems();
      return;
    }

    const startIndex = this.getStartIndex();
    const endIndex = this.getEndIndex(startIndex);
    
    this.visibleItems = this.items.slice(startIndex, endIndex + 1);
    this.renderItems();
    
    // コールバックを実行
    this.options.onItemsChange(this.visibleItems);
  }

  /**
   * 開始インデックスを取得する
   */
  private getStartIndex(): number {
    let accumulatedHeight = 0;
    let index = 0;
    
    for (const item of this.items) {
      const itemHeight = item.height || this.options.itemHeight;
      
      if (accumulatedHeight + itemHeight > this.scrollTop) {
        break;
      }
      
      accumulatedHeight += itemHeight;
      index++;
    }
    
    return Math.max(0, index - this.options.overscan);
  }

  /**
   * 終了インデックスを取得する
   */
  private getEndIndex(startIndex: number): number {
    let accumulatedHeight = 0;
    let index = 0;
    
    // 開始位置までの高さを計算
    for (let i = 0; i < startIndex; i++) {
      accumulatedHeight += this.items[i].height || this.options.itemHeight;
    }
    
    // 表示範囲のアイテムを計算
    for (let i = startIndex; i < this.items.length; i++) {
      const itemHeight = this.items[i].height || this.options.itemHeight;
      
      if (accumulatedHeight > this.scrollTop + this.options.containerHeight) {
        break;
      }
      
      accumulatedHeight += itemHeight;
      index = i;
    }
    
    return Math.min(this.items.length - 1, index + this.options.overscan);
  }

  /**
   * アイテムをレンダリングする
   */
  private renderItems(): void {
    // コンテンツをクリア
    this.content.innerHTML = '';
    
    if (this.visibleItems.length === 0) {
      return;
    }

    // フラグメントを作成してパフォーマンスを向上
    const fragment = document.createDocumentFragment();
    
    // 表示アイテムをレンダリング
    this.visibleItems.forEach((item, index) => {
      const element = this.createItemElement(item, index);
      fragment.appendChild(element);
    });
    
    this.content.appendChild(fragment);
  }

  /**
   * アイテム要素を作成する（オーバーライド用）
   */
  protected createItemElement(item: VirtualScrollItem, index: number): HTMLElement {
    const element = document.createElement('div');
    element.style.position = 'absolute';
    element.style.top = `${this.getItemTop(item)}px`;
    element.style.width = '100%';
    element.style.height = `${item.height || this.options.itemHeight}px`;
    element.dataset.itemId = item.id;
    
    // デフォルトコンテンツ
    element.textContent = `Item ${item.id}`;
    
    return element;
  }

  /**
   * アイテムの上位置を取得する
   */
  private getItemTop(targetItem: VirtualScrollItem): number {
    let top = 0;
    
    for (const item of this.items) {
      if (item.id === targetItem.id) {
        break;
      }
      top += item.height || this.options.itemHeight;
    }
    
    return top;
  }

  /**
   * 特定のアイテムまでスクロールする
   */
  public scrollToItem(itemId: string, alignment: 'start' | 'center' | 'end' = 'start'): void {
    const itemIndex = this.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;
    
    let scrollTop = 0;
    
    // アイテムまでの高さを計算
    for (let i = 0; i < itemIndex; i++) {
      scrollTop += this.items[i].height || this.options.itemHeight;
    }
    
    const itemHeight = this.items[itemIndex].height || this.options.itemHeight;
    
    // アライメントに基づいてスクロール位置を調整
    switch (alignment) {
      case 'center':
        scrollTop -= (this.options.containerHeight - itemHeight) / 2;
        break;
      case 'end':
        scrollTop -= this.options.containerHeight - itemHeight;
        break;
    }
    
    // スクロール位置を制限
    scrollTop = Math.max(0, Math.min(scrollTop, this.getTotalHeight() - this.options.containerHeight));
    
    this.container.scrollTop = scrollTop;
  }

  /**
   * 全体の高さを取得する
   */
  public getTotalHeight(): number {
    return this.items.reduce((sum, item) => {
      return sum + (item.height || this.options.itemHeight);
    }, 0);
  }

  /**
   * 表示アイテムを取得する
   */
  public getVisibleItems(): VirtualScrollItem[] {
    return [...this.visibleItems];
  }

  /**
   * スクロール位置を取得する
   */
  public getScrollTop(): number {
    return this.scrollTop;
  }

  /**
   * スクロール位置を設定する
   */
  public setScrollTop(scrollTop: number): void {
    this.container.scrollTop = scrollTop;
  }

  /**
   * スクロール中かどうかを取得する
   */
  public isScrollingActive(): boolean {
    return this.isScrolling;
  }

  /**
   * アイテムの高さを更新する
   */
  public updateItemHeight(itemId: string, height: number): void {
    const item = this.items.find(item => item.id === itemId);
    if (item) {
      item.height = height;
      this.updateContentHeight();
      this.updateVisibleItems();
    }
  }

  /**
   * コンテナの高さを更新する
   */
  public setContainerHeight(height: number): void {
    this.options.containerHeight = height;
    this.container.style.height = `${height}px`;
    this.updateVisibleItems();
  }

  /**
   * アイテムの高さを更新する
   */
  public setItemHeight(height: number): void {
    this.options.itemHeight = height;
    this.updateContentHeight();
    this.updateVisibleItems();
  }

  /**
   * オプションを更新する
   */
  public updateOptions(options: Partial<VirtualScrollOptions>): void {
    this.options = { ...this.options, ...options };
    
    if (options.containerHeight !== undefined) {
      this.container.style.height = `${options.containerHeight}px`;
    }
    
    this.updateVisibleItems();
  }

  /**
   * クリーンアップ処理
   */
  public destroy(): void {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    
    this.container.removeEventListener('scroll', this.handleScroll);
    
    if (this.content.parentNode) {
      this.content.parentNode.removeChild(this.content);
    }
    
    this.items = [];
    this.visibleItems = [];
  }

  /**
   * デバッグ情報を取得する
   */
  public getDebugInfo(): {
    totalItems: number;
    visibleItems: number;
    scrollTop: number;
    containerHeight: number;
    totalHeight: number;
    isScrolling: boolean;
  } {
    return {
      totalItems: this.items.length,
      visibleItems: this.visibleItems.length,
      scrollTop: this.scrollTop,
      containerHeight: this.options.containerHeight,
      totalHeight: this.getTotalHeight(),
      isScrolling: this.isScrolling
    };
  }
}