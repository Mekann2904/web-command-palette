/**
 * レンダリング最適化ユーティリティ
 * DOM操作のパフォーマンスを向上させる
 */

export interface RenderBatch {
  operations: (() => void)[];
  priority: 'high' | 'normal' | 'low';
  timestamp: number;
}

export class RenderOptimizer {
  private static instance: RenderOptimizer;
  private renderQueue: RenderBatch[] = [];
  private isRendering: boolean = false;
  private rafId: number | null = null;
  private maxBatchSize: number = 50;
  private frameDeadline: number = 16; // 60fps (16ms per frame)

  private constructor() {}

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): RenderOptimizer {
    if (!RenderOptimizer.instance) {
      RenderOptimizer.instance = new RenderOptimizer();
    }
    return RenderOptimizer.instance;
  }

  /**
   * レンダリング操作をキューに追加
   */
  public scheduleRender(
    operation: () => void,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): void {
    const batch: RenderBatch = {
      operations: [operation],
      priority,
      timestamp: performance.now()
    };

    this.renderQueue.push(batch);
    this.scheduleRenderFrame();
  }

  /**
   * 複数のレンダリング操作をバッチとしてキューに追加
   */
  public scheduleBatch(
    operations: (() => void)[],
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): void {
    const batch: RenderBatch = {
      operations: [...operations],
      priority,
      timestamp: performance.now()
    };

    this.renderQueue.push(batch);
    this.scheduleRenderFrame();
  }

  /**
   * レンダリングフレームをスケジュール
   */
  private scheduleRenderFrame(): void {
    if (this.isRendering) {
      return;
    }

    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.processRenderQueue();
      });
    }
  }

  /**
   * レンダリングキューを処理
   */
  private processRenderQueue(): void {
    this.isRendering = true;
    this.rafId = null;

    const startTime = performance.now();
    const endTime = startTime + this.frameDeadline;

    // 優先度順にソート
    this.renderQueue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    while (this.renderQueue.length > 0 && performance.now() < endTime) {
      const batch = this.renderQueue.shift()!;
      
      // バッチ内の操作を処理
      for (const operation of batch.operations) {
        try {
          operation();
        } catch (error) {
          console.error('[RenderOptimizer] Error in render operation:', error);
        }
        
        // 時間チェック
        if (performance.now() >= endTime) {
          break;
        }
      }
    }

    // 残りの操作がある場合は次のフレームをスケジュール
    if (this.renderQueue.length > 0) {
      this.scheduleRenderFrame();
    } else {
      this.isRendering = false;
    }
  }

  /**
   * DOM要素の作成をバッチ処理
   */
  public createElementsBatch(
    createElement: () => HTMLElement,
    count: number,
    container: HTMLElement
  ): void {
    const operations: (() => void)[] = [];
    
    for (let i = 0; i < count; i++) {
      operations.push(() => {
        const element = createElement();
        container.appendChild(element);
      });
    }
    
    this.scheduleBatch(operations, 'normal');
  }

  /**
   * DOM要素の更新をバッチ処理
   */
  public updateElementsBatch(
    elements: HTMLElement[],
    updateFn: (element: HTMLElement) => void
  ): void {
    const operations = elements.map(element => () => updateFn(element));
    this.scheduleBatch(operations, 'normal');
  }

  /**
   * DOM要素の削除をバッチ処理
   */
  public removeElementsBatch(elements: HTMLElement[]): void {
    const operations = elements.map(element => () => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    
    this.scheduleBatch(operations, 'low');
  }

  /**
   * スタイルの更新をバッチ処理
   */
  public updateStylesBatch(
    updates: Array<{
      element: HTMLElement;
      styles: Record<string, string>;
    }>
  ): void {
    const operations = updates.map(({ element, styles }) => () => {
      Object.entries(styles).forEach(([property, value]) => {
        element.style.setProperty(property, value);
      });
    });
    
    this.scheduleBatch(operations, 'high');
  }

  /**
   * クラスの更新をバッチ処理
   */
  public updateClassesBatch(
    updates: Array<{
      element: HTMLElement;
      classes: {
        add?: string[];
        remove?: string[];
        toggle?: string[];
      };
    }>
  ): void {
    const operations = updates.map(({ element, classes }) => () => {
      if (classes.add) {
        element.classList.add(...classes.add);
      }
      if (classes.remove) {
        element.classList.remove(...classes.remove);
      }
      if (classes.toggle) {
        classes.toggle.forEach(className => {
          element.classList.toggle(className);
        });
      }
    });
    
    this.scheduleBatch(operations, 'high');
  }

  /**
   * 属性の更新をバッチ処理
   */
  public updateAttributesBatch(
    updates: Array<{
      element: HTMLElement;
      attributes: Record<string, string | null>;
    }>
  ): void {
    const operations = updates.map(({ element, attributes }) => () => {
      Object.entries(attributes).forEach(([name, value]) => {
        if (value === null) {
          element.removeAttribute(name);
        } else {
          element.setAttribute(name, value);
        }
      });
    });
    
    this.scheduleBatch(operations, 'normal');
  }

  /**
   * テキストコンテンツの更新をバッチ処理
   */
  public updateTextBatch(
    updates: Array<{
      element: HTMLElement;
      text: string;
    }>
  ): void {
    const operations = updates.map(({ element, text }) => () => {
      element.textContent = text;
    });
    
    this.scheduleBatch(operations, 'high');
  }

  /**
   * DOM要素の可視性を切り替える
   */
  public toggleVisibilityBatch(
    elements: HTMLElement[],
    visible: boolean
  ): void {
    const displayValue = visible ? '' : 'none';
    const operations = elements.map(element => () => {
      element.style.display = displayValue;
    });
    
    this.scheduleBatch(operations, 'high');
  }

  /**
   * アニメーションを最適化
   */
  public animateElementsBatch(
    animations: Array<{
      element: HTMLElement;
      keyframes: Keyframe[];
      options?: KeyframeAnimationOptions;
    }>
  ): void {
    const operations = animations.map(({ element, keyframes, options }) => () => {
      element.animate(keyframes, options);
    });
    
    this.scheduleBatch(operations, 'normal');
  }

  /**
   * フラグメントを使用したDOM操作
   */
  public appendFragmentBatch(
    container: HTMLElement,
    elements: HTMLElement[]
  ): void {
    const operation = () => {
      const fragment = document.createDocumentFragment();
      elements.forEach(element => fragment.appendChild(element));
      container.appendChild(fragment);
    };
    
    this.scheduleRender(operation, 'high');
  }

  /**
   * レンダリングキューをクリア
   */
  public clearQueue(): void {
    this.renderQueue = [];
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isRendering = false;
  }

  /**
   * キューのサイズを取得
   */
  public getQueueSize(): number {
    return this.renderQueue.reduce((total, batch) => total + batch.operations.length, 0);
  }

  /**
   * 最大バッチサイズを設定
   */
  public setMaxBatchSize(size: number): void {
    this.maxBatchSize = Math.max(1, size);
  }

  /**
   * フレームのタイムアウトを設定
   */
  public setFrameDeadline(deadline: number): void {
    this.frameDeadline = Math.max(1, deadline);
  }

  /**
   * パフォーマンス統計を取得
   */
  public getPerformanceStats(): {
    queueSize: number;
    isRendering: boolean;
    averageBatchSize: number;
    priorityDistribution: Record<string, number>;
  } {
    const priorityDistribution = this.renderQueue.reduce((acc, batch) => {
      acc[batch.priority] = (acc[batch.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const averageBatchSize = this.renderQueue.length > 0
      ? this.renderQueue.reduce((sum, batch) => sum + batch.operations.length, 0) / this.renderQueue.length
      : 0;

    return {
      queueSize: this.getQueueSize(),
      isRendering: this.isRendering,
      averageBatchSize,
      priorityDistribution
    };
  }

  /**
   * レンダリングを一時停止
   */
  public pause(): void {
    this.clearQueue();
  }

  /**
   * レンダリングを再開
   */
  public resume(): void {
    // 特に何もしない（次の操作で自動的に再開）
  }

  /**
   * レンダリングオプティマイザをリセット
   */
  public reset(): void {
    this.clearQueue();
    this.maxBatchSize = 50;
    this.frameDeadline = 16;
  }
}

// グローバルインスタンスをエクスポート
export const renderOptimizer = RenderOptimizer.getInstance();

/**
 * ユーティリティ関数
 */
export const RenderUtils = {
  /**
   * スロットル付き関数を作成
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastCallTime = 0;
    return (...args: Parameters<T>) => {
      const now = performance.now();
      if (now - lastCallTime >= delay) {
        lastCallTime = now;
        func(...args);
      }
    };
  },

  /**
   * デバウンス付き関数を作成
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  },

  /**
   * requestAnimationFrameをPromiseでラップ
   */
  nextFrame(): Promise<number> {
    return new Promise(resolve => {
      requestAnimationFrame(resolve);
    });
  },

  /**
   * 指定された時間だけ待機
   */
  wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * 要素がビューポート内にあるかチェック
   */
  isInViewport(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );
  },

  /**
   * 要素が表示されるまで待機
   */
  waitForElement(
    selector: string,
    timeout: number = 5000
  ): Promise<Element | null> {
    return new Promise(resolve => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }
};