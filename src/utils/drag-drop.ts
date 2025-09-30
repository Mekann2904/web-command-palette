/**
 * ドラッグ&ドロップ用のユーティリティ
 * リストアイテムのドラッグ&ドロップによる並べ替え機能を提供
 */

export interface DragDropItem {
  id: string;
  element: HTMLElement;
  data?: any;
}

export interface DragDropOptions {
  items: DragDropItem[];
  onDragStart?: (item: DragDropItem) => void;
  onDragEnd?: (item: DragDropItem) => void;
  onDrop?: (draggedItem: DragDropItem, targetItem: DragDropItem, position: 'before' | 'after') => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  dragHandle?: string;
  disabled?: boolean;
  vertical?: boolean;
}

export class DragDropManager {
  private items: DragDropItem[] = [];
  private options: DragDropOptions;
  private draggedItem: DragDropItem | null = null;
  private draggedElement: HTMLElement | null = null;
  private dropIndicator: HTMLElement | null = null;
  private placeholder: HTMLElement | null = null;
  private originalIndex = -1;
  private isDragging = false;

  constructor(options: DragDropOptions) {
    this.options = options;
    this.items = [...options.items];
    this.setupDropIndicator();
  }

  /**
   * ドラッグ&ドロップを有効化
   */
  enable(): void {
    if (this.options.disabled) return;

    this.items.forEach((item, index) => {
      this.setupItemDragHandlers(item, index);
    });
  }

  /**
   * ドラッグ&ドロップを無効化
   */
  disable(): void {
    this.items.forEach(item => {
      this.removeItemDragHandlers(item);
    });
  }

  /**
   * アイテムリストを更新
   */
  updateItems(items: DragDropItem[]): void {
    this.disable();
    this.items = [...items];
    this.enable();
  }

  /**
   * ドロップインジケーターをセットアップ
   */
  private setupDropIndicator(): void {
    this.dropIndicator = document.createElement('div');
    this.dropIndicator.className = 'drag-drop-indicator';
    this.dropIndicator.style.cssText = `
      position: absolute;
      background: var(--accent-color, #2563eb);
      z-index: 1000;
      pointer-events: none;
      transition: all 0.2s ease;
    `;

    if (this.options.vertical) {
      this.dropIndicator.style.height = '2px';
      this.dropIndicator.style.width = '100%';
      this.dropIndicator.style.left = '0';
    } else {
      this.dropIndicator.style.width = '2px';
      this.dropIndicator.style.height = '100%';
      this.dropIndicator.style.top = '0';
    }
  }

  /**
   * プレースホルダーを作成
   */
  private createPlaceholder(): HTMLElement {
    const placeholder = document.createElement('div');
    placeholder.className = 'drag-drop-placeholder';
    placeholder.style.cssText = `
      opacity: 0.4;
      background: var(--item-bg-alt, #f3f4f6);
      border: 2px dashed var(--border-color, #d1d5db);
    `;
    return placeholder;
  }

  /**
   * アイテムにドラッグハンドラーを設定
   */
  private setupItemDragHandlers(item: DragDropItem, index: number): void {
    const element = item.element;
    const dragHandle = this.options.dragHandle 
      ? element.querySelector(this.options.dragHandle) as HTMLElement
      : element;

    if (!dragHandle) return;

    dragHandle.style.cursor = 'grab';
    dragHandle.draggable = true;

    const dragStartHandler = (e: DragEvent) => this.handleDragStart(e, item, index);
    const dragEndHandler = (e: DragEvent) => this.handleDragEnd(e, item);
    const dragOverHandler = (e: DragEvent) => this.handleDragOver(e);
    const dropHandler = (e: DragEvent) => this.handleDrop(e, item);
    const dragEnterHandler = (e: DragEvent) => this.handleDragEnter(e);
    const dragLeaveHandler = (e: DragEvent) => this.handleDragLeave(e);

    // タッチイベント対応
    const touchStartHandler = (e: TouchEvent) => this.handleTouchStart(e, item, index);
    const touchMoveHandler = (e: TouchEvent) => this.handleTouchMove(e);
    const touchEndHandler = (e: TouchEvent) => this.handleTouchEnd(e, item);

    dragHandle.addEventListener('dragstart', dragStartHandler);
    dragHandle.addEventListener('dragend', dragEndHandler);
    dragHandle.addEventListener('dragover', dragOverHandler);
    dragHandle.addEventListener('drop', dropHandler);
    dragHandle.addEventListener('dragenter', dragEnterHandler);
    dragHandle.addEventListener('dragleave', dragLeaveHandler);

    // タッチイベント対応
    dragHandle.addEventListener('touchstart', touchStartHandler, { passive: false });
    dragHandle.addEventListener('touchmove', touchMoveHandler, { passive: false });
    dragHandle.addEventListener('touchend', touchEndHandler);

    // ハンドラーを要素に保存して後で削除できるようにする
    (dragHandle as any)._dragHandlers = {
      dragStartHandler,
      dragEndHandler,
      dragOverHandler,
      dropHandler,
      dragEnterHandler,
      dragLeaveHandler,
      touchStartHandler,
      touchMoveHandler,
      touchEndHandler
    };
  }

  /**
   * アイテムからドラッグハンドラーを削除
   */
  private removeItemDragHandlers(item: DragDropItem): void {
    const element = item.element;
    const dragHandle = this.options.dragHandle 
      ? element.querySelector(this.options.dragHandle) as HTMLElement
      : element;

    if (!dragHandle) return;

    dragHandle.style.cursor = '';
    dragHandle.draggable = false;
    dragHandle.removeAttribute('draggable');

    // 保存したハンドラーを取得して削除
    const handlers = (dragHandle as any)._dragHandlers;
    if (handlers) {
      dragHandle.removeEventListener('dragstart', handlers.dragStartHandler);
      dragHandle.removeEventListener('dragend', handlers.dragEndHandler);
      dragHandle.removeEventListener('dragover', handlers.dragOverHandler);
      dragHandle.removeEventListener('drop', handlers.dropHandler);
      dragHandle.removeEventListener('dragenter', handlers.dragEnterHandler);
      dragHandle.removeEventListener('dragleave', handlers.dragLeaveHandler);
      dragHandle.removeEventListener('touchstart', handlers.touchStartHandler);
      dragHandle.removeEventListener('touchmove', handlers.touchMoveHandler);
      dragHandle.removeEventListener('touchend', handlers.touchEndHandler);
      
      // ハンドラー参照を削除
      delete (dragHandle as any)._dragHandlers;
    }
  }

  /**
   * ドラッグ開始処理
   */
  private handleDragStart(e: DragEvent, item: DragDropItem, index: number): void {
    this.draggedItem = item;
    this.originalIndex = index;
    this.isDragging = true;

    // ドラッグイメージを設定
    const dragImage = item.element.cloneNode(true) as HTMLElement;
    dragImage.style.opacity = '0.8';
    dragImage.style.transform = 'rotate(2deg)';
    dragImage.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
    document.body.appendChild(dragImage);
    e.dataTransfer?.setDragImage(dragImage, e.offsetX, e.offsetY);
    setTimeout(() => document.body.removeChild(dragImage), 0);

    // プレースホルダーを作成
    this.placeholder = this.createPlaceholder();
    this.placeholder.style.height = `${item.element.offsetHeight}px`;

    // スタイルを適用
    item.element.style.opacity = '0.5';
    item.element.style.transform = 'scale(0.95)';

    this.options.onDragStart?.(item);

    e.dataTransfer!.effectAllowed = 'move';
  }

  /**
   * ドラッグ終了処理
   */
  private handleDragEnd(e: DragEvent, item: DragDropItem): void {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.draggedItem = null;
    this.originalIndex = -1;

    // スタイルをリセット
    item.element.style.opacity = '';
    item.element.style.transform = '';

    // プレースホルダーを削除
    if (this.placeholder && this.placeholder.parentNode) {
      this.placeholder.parentNode.removeChild(this.placeholder);
    }
    this.placeholder = null;

    // ドロップインジケーターを非表示
    this.hideDropIndicator();

    this.options.onDragEnd?.(item);
  }

  /**
   * ドラッグオーバー処理
   */
  private handleDragOver(e: DragEvent): void {
    if (!this.isDragging) return;

    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';

    const target = e.currentTarget as HTMLElement;
    const targetItem = this.items.find(item => item.element === target);
    
    if (targetItem && this.draggedItem && targetItem !== this.draggedItem) {
      const rect = target.getBoundingClientRect();
      const position = this.options.vertical
        ? e.clientY - rect.top < rect.height / 2 ? 'before' : 'after'
        : e.clientX - rect.left < rect.width / 2 ? 'before' : 'after';

      this.showDropIndicator(target, position);
    }
  }

  /**
   * ドロップ処理
   */
  private handleDrop(e: DragEvent, targetItem: DragDropItem): void {
    if (!this.isDragging || !this.draggedItem) return;

    e.preventDefault();

    if (this.draggedItem !== targetItem) {
      const rect = targetItem.element.getBoundingClientRect();
      const position = this.options.vertical
        ? e.clientY - rect.top < rect.height / 2 ? 'before' : 'after'
        : e.clientX - rect.left < rect.width / 2 ? 'before' : 'after';

      const fromIndex = this.items.indexOf(this.draggedItem);
      const toIndex = this.items.indexOf(targetItem);

      if (position === 'after') {
        this.items.splice(toIndex + 1, 0, this.items.splice(fromIndex, 1)[0]);
      } else {
        this.items.splice(toIndex, 0, this.items.splice(fromIndex, 1)[0]);
      }

      this.options.onDrop?.(this.draggedItem, targetItem, position);
      this.options.onReorder?.(fromIndex, toIndex);
    }

    this.hideDropIndicator();
  }

  /**
   * ドラッグエンター処理
   */
  private handleDragEnter(e: DragEvent): void {
    if (!this.isDragging) return;
    e.preventDefault();
  }

  /**
   * ドラッグリーブ処理
   */
  private handleDragLeave(e: DragEvent): void {
    if (!this.isDragging) return;
    e.preventDefault();
  }

  /**
   * ドロップインジケーターを表示
   */
  private showDropIndicator(target: HTMLElement, position: 'before' | 'after'): void {
    if (!this.dropIndicator) return;

    const rect = target.getBoundingClientRect();
    const parentRect = target.parentElement?.getBoundingClientRect();

    if (!parentRect) return;

    if (this.options.vertical) {
      const top = position === 'before' 
        ? rect.top - parentRect.top
        : rect.bottom - parentRect.top - 2;
      
      this.dropIndicator.style.top = `${top}px`;
      this.dropIndicator.style.left = '0';
      this.dropIndicator.style.width = '100%';
    } else {
      const left = position === 'before'
        ? rect.left - parentRect.left
        : rect.right - parentRect.left - 2;
      
      this.dropIndicator.style.left = `${left}px`;
      this.dropIndicator.style.top = '0';
      this.dropIndicator.style.height = '100%';
    }

    if (target.parentElement && !target.parentElement.contains(this.dropIndicator)) {
      target.parentElement.style.position = 'relative';
      target.parentElement.appendChild(this.dropIndicator);
    }
  }

  /**
   * ドロップインジケーターを非表示
   */
  private hideDropIndicator(): void {
    if (this.dropIndicator && this.dropIndicator.parentNode) {
      this.dropIndicator.parentNode.removeChild(this.dropIndicator);
    }
  }

  /**
   * タッチ開始処理
   */
  private handleTouchStart(e: TouchEvent, item: DragDropItem, index: number): void {
    if (this.options.disabled) return;

    const touch = e.touches[0];
    const target = e.target as HTMLElement;

    // ドラッグ開始を遅延してスクロールと区別
    setTimeout(() => {
      if (Math.abs(touch.clientX - this.touchStartX) < 10 && 
          Math.abs(touch.clientY - this.touchStartY) < 10) {
        this.startTouchDrag(item, index, touch);
      }
    }, 150);

    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  }

  /**
   * タッチ移動処理
   */
  private handleTouchMove(e: TouchEvent): void {
    if (!this.isDragging) return;

    e.preventDefault();
    const touch = e.touches[0];
    
    // ドラッグ要素を移動
    if (this.draggedElement) {
      this.draggedElement.style.left = `${touch.clientX - this.touchOffsetX}px`;
      this.draggedElement.style.top = `${touch.clientY - this.touchOffsetY}px`;
    }

    // ドロップターゲットを検索
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetItem = this.items.find(item => 
      item.element.contains(elementBelow) || item.element === elementBelow
    );

    if (targetItem && this.draggedItem && targetItem !== this.draggedItem) {
      const rect = targetItem.element.getBoundingClientRect();
      const position = this.options.vertical
        ? touch.clientY - rect.top < rect.height / 2 ? 'before' : 'after'
        : touch.clientX - rect.left < rect.width / 2 ? 'before' : 'after';

      this.showDropIndicator(targetItem.element, position);
    }
  }

  /**
   * タッチ終了処理
   */
  private handleTouchEnd(e: TouchEvent, item: DragDropItem): void {
    if (!this.isDragging) return;

    const touch = e.changedTouches[0];
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    
    const targetItem = this.items.find(item => 
      item.element.contains(elementBelow) || item.element === elementBelow
    );

    if (targetItem && this.draggedItem && targetItem !== this.draggedItem) {
      const rect = targetItem.element.getBoundingClientRect();
      const position = this.options.vertical
        ? touch.clientY - rect.top < rect.height / 2 ? 'before' : 'after'
        : touch.clientX - rect.left < rect.width / 2 ? 'before' : 'after';

      const fromIndex = this.items.indexOf(this.draggedItem);
      const toIndex = this.items.indexOf(targetItem);

      if (position === 'after') {
        this.items.splice(toIndex + 1, 0, this.items.splice(fromIndex, 1)[0]);
      } else {
        this.items.splice(toIndex, 0, this.items.splice(fromIndex, 1)[0]);
      }

      this.options.onDrop?.(this.draggedItem, targetItem, position);
      this.options.onReorder?.(fromIndex, toIndex);
    }

    this.endTouchDrag();
  }

  /**
   * タッチドラッグを開始
   */
  private startTouchDrag(item: DragDropItem, index: number, touch: Touch): void {
    this.draggedItem = item;
    this.originalIndex = index;
    this.isDragging = true;

    // ドラッグ要素を作成
    this.draggedElement = item.element.cloneNode(true) as HTMLElement;
    this.draggedElement.style.cssText = `
      position: fixed;
      top: ${touch.clientY}px;
      left: ${touch.clientX}px;
      z-index: 10000;
      opacity: 0.8;
      transform: rotate(2deg);
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      pointer-events: none;
      width: ${item.element.offsetWidth}px;
    `;

    document.body.appendChild(this.draggedElement);

    this.touchOffsetX = touch.clientX - item.element.getBoundingClientRect().left;
    this.touchOffsetY = touch.clientY - item.element.getBoundingClientRect().top;

    // 元の要素を半透明に
    item.element.style.opacity = '0.5';
    item.element.style.transform = 'scale(0.95)';

    this.options.onDragStart?.(item);
  }

  /**
   * タッチドラッグを終了
   */
  private endTouchDrag(): void {
    if (!this.isDragging) return;

    this.isDragging = false;

    // ドラッグ要素を削除
    if (this.draggedElement && this.draggedElement.parentNode) {
      this.draggedElement.parentNode.removeChild(this.draggedElement);
    }
    this.draggedElement = null;

    // 元の要素のスタイルをリセット
    if (this.draggedItem) {
      this.draggedItem.element.style.opacity = '';
      this.draggedItem.element.style.transform = '';
    }

    this.draggedItem = null;
    this.originalIndex = -1;

    this.hideDropIndicator();
    this.options.onDragEnd?.(this.draggedItem!);
  }

  private touchStartX = 0;
  private touchStartY = 0;
  private touchOffsetX = 0;
  private touchOffsetY = 0;
}

/**
 * ドラッグ&ドロップを簡単にセットアップするヘルパー関数
 */
export function setupDragDrop(container: HTMLElement, options: Partial<DragDropOptions>): DragDropManager {
  const items: DragDropItem[] = Array.from(container.children).map((element, index) => ({
    id: `item-${index}`,
    element: element as HTMLElement,
    data: (element as HTMLElement).dataset
  }));

  const manager = new DragDropManager({
    items,
    vertical: true,
    ...options
  });

  manager.enable();
  return manager;
}
