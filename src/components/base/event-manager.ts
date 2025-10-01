/**
 * イベント管理システム
 * イベントリスナーの登録・解除を一元管理し、メモリリークを防止する
 */

export interface EventListenerInfo {
  element: Element;
  event: string;
  handler: EventListener;
  options?: boolean | AddEventListenerOptions;
}

export class EventManager {
  private listeners: Map<string, EventListenerInfo[]> = new Map();
  private isActive: boolean = true;

  /**
   * イベントリスナーを登録する
   */
  public add(
    element: Element, 
    event: string, 
    handler: EventListener, 
    options?: boolean | AddEventListenerOptions
  ): void {
    if (!this.isActive) return;

    const key = this.generateKey(element, event);
    
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    
    const listenerInfo: EventListenerInfo = { element, event, handler, options };
    this.listeners.get(key)!.push(listenerInfo);
    
    element.addEventListener(event, handler, options);
  }

  /**
   * イベントリスナーを削除する
   */
  public remove(
    element: Element, 
    event: string, 
    handler?: EventListener
  ): void {
    const key = this.generateKey(element, event);
    const listenerInfos = this.listeners.get(key);
    
    if (!listenerInfos) return;
    
    if (handler) {
      // 特定のハンドラーのみ削除
      const index = listenerInfos.findIndex(info => info.handler === handler);
      if (index !== -1) {
        const info = listenerInfos[index];
        element.removeEventListener(event, info.handler, info.options);
        listenerInfos.splice(index, 1);
      }
    } else {
      // 要素とイベントの全リスナーを削除
      listenerInfos.forEach(info => {
        element.removeEventListener(event, info.handler, info.options);
      });
      this.listeners.delete(key);
    }
  }

  /**
   * 特定の要素の全イベントリスナーを削除する
   */
  public removeAllByElement(element: Element): void {
    const keysToRemove: string[] = [];
    
    this.listeners.forEach((listenerInfos, key) => {
      const filteredInfos = listenerInfos.filter(info => {
        if (info.element === element) {
          element.removeEventListener(info.event, info.handler, info.options);
          return false;
        }
        return true;
      });
      
      if (filteredInfos.length === 0) {
        keysToRemove.push(key);
      } else {
        this.listeners.set(key, filteredInfos);
      }
    });
    
    keysToRemove.forEach(key => this.listeners.delete(key));
  }

  /**
   * 全イベントリスナーを削除する
   */
  public removeAll(): void {
    this.listeners.forEach((listenerInfos) => {
      listenerInfos.forEach(info => {
        info.element.removeEventListener(info.event, info.handler, info.options);
      });
    });
    
    this.listeners.clear();
  }

  /**
   * イベントマネージャを非アクティブ化する
   */
  public deactivate(): void {
    this.isActive = false;
    this.removeAll();
  }

  /**
   * イベントマネージャを再アクティブ化する
   */
  public activate(): void {
    this.isActive = true;
  }

  /**
   * 登録されているリスナーの数を取得する
   */
  public getListenerCount(): number {
    let count = 0;
    this.listeners.forEach(listenerInfos => {
      count += listenerInfos.length;
    });
    return count;
  }

  /**
   * 特定の要素に登録されているリスナーの数を取得する
   */
  public getListenerCountByElement(element: Element): number {
    let count = 0;
    this.listeners.forEach(listenerInfos => {
      count += listenerInfos.filter(info => info.element === element).length;
    });
    return count;
  }

  /**
   * デバッグ情報を取得する
   */
  public getDebugInfo(): { key: string; count: number }[] {
    const info: { key: string; count: number }[] = [];
    this.listeners.forEach((listenerInfos, key) => {
      info.push({ key, count: listenerInfos.length });
    });
    return info;
  }

  /**
   * 要素とイベントから一意のキーを生成する
   */
  private generateKey(element: Element, event: string): string {
    const elementId = element.id || 
                     element.className || 
                     element.tagName.toLowerCase() || 
                     'unnamed';
    return `${elementId}-${event}`;
  }

  /**
   * イベントデリゲーションを設定する
   */
  public delegate(
    container: Element,
    selector: string,
    event: string,
    handler: (e: Event, target: Element) => void,
    options?: boolean | AddEventListenerOptions
  ): void {
    const delegatedHandler = (e: Event) => {
      const target = (e.target as Element).closest(selector);
      if (target && container.contains(target)) {
        handler(e, target);
      }
    };
    
    this.add(container, event, delegatedHandler, options);
  }

  /**
   * 一度だけ実行されるイベントリスナーを登録する
   */
  public once(
    element: Element,
    event: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    const onceHandler = (e: Event) => {
      handler(e);
      this.remove(element, event, onceHandler);
    };
    
    this.add(element, event, onceHandler, options);
  }

  /**
   * スロットル付きイベントリスナーを登録する
   */
  public throttle(
    element: Element,
    event: string,
    handler: EventListener,
    delay: number,
    options?: boolean | AddEventListenerOptions
  ): void {
    let lastCallTime = 0;
    
    const throttledHandler = (e: Event) => {
      const now = Date.now();
      if (now - lastCallTime >= delay) {
        lastCallTime = now;
        handler(e);
      }
    };
    
    this.add(element, event, throttledHandler, options);
  }

  /**
   * デバウンス付きイベントリスナーを登録する
   */
  public debounce(
    element: Element,
    event: string,
    handler: EventListener,
    delay: number,
    options?: boolean | AddEventListenerOptions
  ): void {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const debouncedHandler = (e: Event) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => handler(e), delay);
    };
    
    this.add(element, event, debouncedHandler, options);
  }
}

// グローバルインスタンス
export const globalEventManager = new EventManager();