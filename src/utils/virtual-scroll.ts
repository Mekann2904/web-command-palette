/**
 * 仮想スクロール用のユーティリティ
 * 大量のアイテムを効率的に表示するための仮想スクロール機能を提供
 */

export interface VirtualScrollItem {
  id: string;
  height?: number;
  data: any;
}

export interface VirtualScrollOptions {
  containerHeight: number;
  itemHeight?: number;
  overscan?: number;
  estimatedItemHeight?: number;
}

export interface VirtualScrollPosition {
  scrollTop: number;
  startIndex: number;
  endIndex: number;
  offsetY: number;
}

/**
 * 仮想スクロールを管理するクラス
 * パフォーマンス最適化のための改善を実装
 */
export class VirtualScrollManager {
  private items: VirtualScrollItem[] = [];
  private containerHeight: number;
  private itemHeight: number;
  private overscan: number;
  private estimatedItemHeight: number;
  private itemHeights: Map<string, number> = new Map();
  private itemPositions: number[] = [];
  private totalHeight = 0;
  private lastScrollTop = 0;
  private scrollDirection: 'up' | 'down' | 'none' = 'none';
  private visibleRangeCache: Map<number, VirtualScrollPosition> = new Map();
  private maxCacheSize = 10;

  constructor(options: VirtualScrollOptions) {
    this.containerHeight = options.containerHeight;
    this.itemHeight = options.itemHeight || 40;
    this.overscan = options.overscan || 5;
    this.estimatedItemHeight = options.estimatedItemHeight || options.itemHeight || 40;
  }

  /**
   * アイテムリストを設定
   */
  setItems(items: VirtualScrollItem[]): void {
    this.items = items;
    this.visibleRangeCache.clear(); // キャッシュをクリア
    this.recalculatePositions();
  }

  /**
   * アイテムの高さを更新
   */
  updateItemHeight(itemId: string, height: number): void {
    const oldHeight = this.itemHeights.get(itemId) || this.estimatedItemHeight;
    this.itemHeights.set(itemId, height);
    
    if (Math.abs(oldHeight - height) > 1) {
      this.visibleRangeCache.clear(); // キャッシュをクリア
      this.recalculatePositions();
    }
  }

  /**
   * アイテムの位置を再計算
   * パフォーマンス最適化のため、差分計算を実装
   */
  private recalculatePositions(): void {
    this.itemPositions = [0];
    let currentY = 0;

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const height = this.itemHeights.get(item.id) || this.estimatedItemHeight;
      currentY += height;
      this.itemPositions.push(currentY);
    }

    this.totalHeight = currentY;
  }

  /**
   * スクロール位置に基づいて表示範囲を計算
   * パフォーマンス最適化のため、キャッシュとバイナリサーチを実装
   */
  getVisibleRange(scrollTop: number): VirtualScrollPosition {
    // スクロール方向を検出
    this.scrollDirection = scrollTop > this.lastScrollTop ? 'down' : scrollTop < this.lastScrollTop ? 'up' : 'none';
    this.lastScrollTop = scrollTop;

    // キャッシュをチェック
    const cacheKey = Math.floor(scrollTop / 10) * 10; // 10px単位でキャッシュ
    if (this.visibleRangeCache.has(cacheKey)) {
      return this.visibleRangeCache.get(cacheKey)!;
    }

    let startIndex = 0;
    let endIndex = 0;

    // バイナリサーチで開始位置を特定
    let left = 0;
    let right = this.itemPositions.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (this.itemPositions[mid] <= scrollTop && this.itemPositions[mid + 1] > scrollTop) {
        startIndex = Math.max(0, mid - this.overscan);
        break;
      } else if (this.itemPositions[mid] < scrollTop) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    // 終了位置を計算
    const visibleBottom = scrollTop + this.containerHeight;
    for (let i = startIndex; i < this.itemPositions.length - 1; i++) {
      if (this.itemPositions[i] < visibleBottom) {
        endIndex = i;
      } else {
        break;
      }
    }

    endIndex = Math.min(this.items.length - 1, endIndex + this.overscan);

    const result = {
      scrollTop,
      startIndex,
      endIndex,
      offsetY: this.itemPositions[startIndex] || 0
    };

    // キャッシュに保存
    if (this.visibleRangeCache.size >= this.maxCacheSize) {
      const firstKey = this.visibleRangeCache.keys().next().value;
      if (firstKey !== undefined) {
        this.visibleRangeCache.delete(firstKey);
      }
    }
    this.visibleRangeCache.set(cacheKey, result);

    return result;
  }

  /**
   * 表示すべきアイテムを取得
   * パフォーマンス最適化のため、メモリ割り当てを最小化
   */
  getVisibleItems(scrollTop: number): Array<{ item: VirtualScrollItem; index: number; style: any }> {
    const position = this.getVisibleRange(scrollTop);
    const visibleItems: Array<{ item: VirtualScrollItem; index: number; style: any }> = [];
    const styleCache: { [key: string]: any } = {};

    for (let i = position.startIndex; i <= position.endIndex; i++) {
      if (i < this.items.length) {
        const item = this.items[i];
        const top = this.itemPositions[i];
        const height = this.itemHeights.get(item.id) || this.estimatedItemHeight;

        // スタイルオブジェクトを再利用
        const styleKey = `${top}-${height}`;
        let style = styleCache[styleKey];
        
        if (!style) {
          style = {
            position: 'absolute',
            top: `${top}px`,
            left: '0',
            right: '0',
            height: `${height}px`,
            zIndex: i
          };
          styleCache[styleKey] = style;
        }

        visibleItems.push({
          item,
          index: i,
          style
        });
      }
    }

    return visibleItems;
  }

  /**
   * 総高さを取得
   */
  getTotalHeight(): number {
    return this.totalHeight;
  }

  /**
   * アイテム数を取得
   */
  getItemCount(): number {
    return this.items.length;
  }

  /**
   * 指定されたインデックスのアイテムを取得
   */
  getItemAtIndex(index: number): VirtualScrollItem | null {
    return index >= 0 && index < this.items.length ? this.items[index] : null;
  }

  /**
   * 指定されたアイテムのインデックスを取得
   */
  getItemIndex(itemId: string): number {
    return this.items.findIndex(item => item.id === itemId);
  }

  /**
   * スクロールしてアイテムを表示
   */
  scrollToItem(itemId: string, container: HTMLElement, alignment: 'start' | 'center' | 'end' = 'start'): void {
    const index = this.getItemIndex(itemId);
    if (index === -1) return;

    const itemTop = this.itemPositions[index];
    const itemHeight = this.itemHeights.get(itemId) || this.estimatedItemHeight;
    const itemBottom = itemTop + itemHeight;

    let scrollTop: number;

    switch (alignment) {
      case 'start':
        scrollTop = itemTop;
        break;
      case 'center':
        scrollTop = itemTop - (this.containerHeight - itemHeight) / 2;
        break;
      case 'end':
        scrollTop = itemBottom - this.containerHeight;
        break;
    }

    scrollTop = Math.max(0, Math.min(scrollTop, this.totalHeight - this.containerHeight));
    container.scrollTop = scrollTop;
  }
}

/**
 * 仮想スクロールコンテナを作成するヘルパー関数
 */
export function createVirtualScrollContainer(options: {
  containerHeight: number;
  itemHeight?: number;
  onScroll?: (position: VirtualScrollPosition) => void;
}): {
  container: HTMLElement;
  content: HTMLElement;
  manager: VirtualScrollManager;
} {
  const container = document.createElement('div');
  container.style.height = `${options.containerHeight}px`;
  container.style.overflow = 'auto';
  container.style.position = 'relative';

  const content = document.createElement('div');
  content.style.position = 'relative';
  content.style.width = '100%';

  const manager = new VirtualScrollManager({
    containerHeight: options.containerHeight,
    itemHeight: options.itemHeight
  });

  container.addEventListener('scroll', () => {
    const position = manager.getVisibleRange(container.scrollTop);
    options.onScroll?.(position);
  });

  container.appendChild(content);

  return { container, content, manager };
}

/**
 * React風の仮想スクロールフック（簡易版）
 */
export function useVirtualScroll(items: VirtualScrollItem[], options: VirtualScrollOptions) {
  const manager = new VirtualScrollManager(options);
  manager.setItems(items);

  return {
    manager,
    getVisibleItems: (scrollTop: number) => manager.getVisibleItems(scrollTop),
    getTotalHeight: () => manager.getTotalHeight(),
    scrollToItem: (itemId: string, container: HTMLElement, alignment?: 'start' | 'center' | 'end') => 
      manager.scrollToItem(itemId, container, alignment)
  };
}
