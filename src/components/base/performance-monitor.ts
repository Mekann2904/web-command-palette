/**
 * パフォーマンス監視ユーティリティ
 * 最適化結果を検証するためのツール
 */

export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  eventHandlingTime: number;
  domNodesCount: number;
  timestamp: number;
}

export interface PerformanceReport {
  averageRenderTime: number;
  averageMemoryUsage: number;
  averageEventHandlingTime: number;
  peakMemoryUsage: number;
  totalDOMNodes: number;
  metrics: PerformanceMetrics[];
  recommendations: string[];
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private maxMetricsHistory: number = 100;
  private isMonitoring: boolean = false;
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;
  private observers: PerformanceObserver[] = [];

  private constructor() {}

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * パフォーマンス監視を開始
   */
  public startMonitoring(intervalMs: number = 1000): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.setupPerformanceObservers();
    
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    console.log('[PerformanceMonitor] Performance monitoring started');
  }

  /**
   * パフォーマンス監視を停止
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.cleanupPerformanceObservers();
    console.log('[PerformanceMonitor] Performance monitoring stopped');
  }

  /**
   * パフォーマンスオブザーバーを設定
   */
  private setupPerformanceObservers(): void {
    // レンダリングパフォーマンスを監視
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        const renderObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'measure') {
              this.recordRenderTime(entry.name, entry.duration);
            }
          });
        });
        
        renderObserver.observe({ entryTypes: ['measure'] });
        this.observers.push(renderObserver);
      } catch (error) {
        console.warn('[PerformanceMonitor] Failed to setup render observer:', error);
      }

      // 長いタスクを監視
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'longtask') {
              console.warn('[PerformanceMonitor] Long task detected:', entry.duration);
            }
          });
        });
        
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (error) {
        console.warn('[PerformanceMonitor] Failed to setup long task observer:', error);
      }
    }
  }

  /**
   * パフォーマンスオブザーバーをクリーンアップ
   */
  private cleanupPerformanceObservers(): void {
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        console.warn('[PerformanceMonitor] Error disconnecting observer:', error);
      }
    });
    this.observers = [];
  }

  /**
   * メトリクスを収集
   */
  private collectMetrics(): void {
    const metrics: PerformanceMetrics = {
      renderTime: this.measureRenderTime(),
      memoryUsage: this.getMemoryUsage(),
      eventHandlingTime: this.measureEventHandlingTime(),
      domNodesCount: this.getDOMNodesCount(),
      timestamp: performance.now()
    };

    this.metrics.push(metrics);

    // 履歴のサイズを制限
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift();
    }

    // パフォーマンス警告をチェック
    this.checkPerformanceWarnings(metrics);
  }

  /**
   * レンダリング時間を測定
   */
  private measureRenderTime(): number {
    const startTime = performance.now();
    
    // 簡単なDOM操作でレンダリング時間を測定
    const testElement = document.createElement('div');
    testElement.style.display = 'none';
    document.body.appendChild(testElement);
    document.body.removeChild(testElement);
    
    return performance.now() - startTime;
  }

  /**
   * メモリ使用量を取得
   */
  private getMemoryUsage(): number {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize / (1024 * 1024); // MB
    }
    return 0;
  }

  /**
   * イベント処理時間を測定
   */
  private measureEventHandlingTime(): number {
    let startTime = 0;
    let endTime = 0;
    
    const testHandler = () => {
      endTime = performance.now();
    };
    
    startTime = performance.now();
    window.dispatchEvent(new Event('test'));
    
    return endTime - startTime;
  }

  /**
   * DOMノード数を取得
   */
  private getDOMNodesCount(): number {
    return document.querySelectorAll('*').length;
  }

  /**
   * レンダリング時間を記録
   */
  private recordRenderTime(name: string, duration: number): void {
    console.log(`[PerformanceMonitor] ${name}: ${duration.toFixed(2)}ms`);
  }

  /**
   * パフォーマンス警告をチェック
   */
  private checkPerformanceWarnings(metrics: PerformanceMetrics): void {
    if (metrics.renderTime > 16) {
      console.warn(`[PerformanceMonitor] Slow render time: ${metrics.renderTime.toFixed(2)}ms`);
    }

    if (metrics.memoryUsage > 100) {
      console.warn(`[PerformanceMonitor] High memory usage: ${metrics.memoryUsage.toFixed(2)}MB`);
    }

    if (metrics.eventHandlingTime > 5) {
      console.warn(`[PerformanceMonitor] Slow event handling: ${metrics.eventHandlingTime.toFixed(2)}ms`);
    }

    if (metrics.domNodesCount > 5000) {
      console.warn(`[PerformanceMonitor] High DOM nodes count: ${metrics.domNodesCount}`);
    }
  }

  /**
   * パフォーマンスレポートを生成
   */
  public generateReport(): PerformanceReport {
    if (this.metrics.length === 0) {
      return {
        averageRenderTime: 0,
        averageMemoryUsage: 0,
        averageEventHandlingTime: 0,
        peakMemoryUsage: 0,
        totalDOMNodes: 0,
        metrics: [],
        recommendations: ['No performance data available']
      };
    }

    const averageRenderTime = this.metrics.reduce((sum, m) => sum + m.renderTime, 0) / this.metrics.length;
    const averageMemoryUsage = this.metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / this.metrics.length;
    const averageEventHandlingTime = this.metrics.reduce((sum, m) => sum + m.eventHandlingTime, 0) / this.metrics.length;
    const peakMemoryUsage = Math.max(...this.metrics.map(m => m.memoryUsage));
    const totalDOMNodes = this.metrics[this.metrics.length - 1]?.domNodesCount || 0;

    const recommendations = this.generateRecommendations({
      averageRenderTime,
      averageMemoryUsage,
      averageEventHandlingTime,
      peakMemoryUsage,
      totalDOMNodes
    });

    return {
      averageRenderTime,
      averageMemoryUsage,
      averageEventHandlingTime,
      peakMemoryUsage,
      totalDOMNodes,
      metrics: [...this.metrics],
      recommendations
    };
  }

  /**
   * パフォーマンス推奨事項を生成
   */
  private generateRecommendations(metrics: {
    averageRenderTime: number;
    averageMemoryUsage: number;
    averageEventHandlingTime: number;
    peakMemoryUsage: number;
    totalDOMNodes: number;
  }): string[] {
    const recommendations: string[] = [];

    if (metrics.averageRenderTime > 16) {
      recommendations.push('レンダリングパフォーマンスが低下しています。仮想スクロールの使用を検討してください。');
    }

    if (metrics.averageMemoryUsage > 50) {
      recommendations.push('メモリ使用量が高いです。不要なオブジェクトを解放してください。');
    }

    if (metrics.peakMemoryUsage > 100) {
      recommendations.push('メモリ使用量が危険なレベルです。メモリリークを確認してください。');
    }

    if (metrics.averageEventHandlingTime > 5) {
      recommendations.push('イベント処理が遅いです。デバウンスやスロットルの使用を検討してください。');
    }

    if (metrics.totalDOMNodes > 3000) {
      recommendations.push('DOMノード数が多いです。不要な要素を削除してください。');
    }

    if (recommendations.length === 0) {
      recommendations.push('パフォーマンスは良好です。');
    }

    return recommendations;
  }

  /**
   * カスタムメトリクスを記録
   */
  public recordCustomMetric(name: string, value: number, unit: string = 'ms'): void {
    console.log(`[PerformanceMonitor] ${name}: ${value.toFixed(2)}${unit}`);
  }

  /**
   * パフォーマンス測定を開始
   */
  public startMeasure(name: string): void {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`${name}-start`);
    }
  }

  /**
   * パフォーマンス測定を終了
   */
  public endMeasure(name: string): number {
    if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
      try {
        performance.mark(`${name}-end`);
        performance.measure(name, `${name}-start`, `${name}-end`);
        
        const entries = performance.getEntriesByName(name, 'measure');
        if (entries.length > 0) {
          return entries[entries.length - 1].duration;
        }
      } catch (error) {
        console.warn('[PerformanceMonitor] Error measuring performance:', error);
      }
    }
    return 0;
  }

  /**
   * メトリクス履歴を取得
   */
  public getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * メトリクスをクリア
   */
  public clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * 監視状態を取得
   */
  public isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * パフォーマンススコアを計算
   */
  public calculatePerformanceScore(): number {
    if (this.metrics.length === 0) {
      return 100;
    }

    const report = this.generateReport();
    let score = 100;

    // レンダリング時間スコア (0-30点)
    if (report.averageRenderTime > 16) {
      score -= Math.min(30, (report.averageRenderTime - 16) * 2);
    }

    // メモリ使用量スコア (0-30点)
    if (report.averageMemoryUsage > 50) {
      score -= Math.min(30, (report.averageMemoryUsage - 50) * 0.6);
    }

    // イベント処理時間スコア (0-20点)
    if (report.averageEventHandlingTime > 5) {
      score -= Math.min(20, (report.averageEventHandlingTime - 5) * 4);
    }

    // DOMノード数スコア (0-20点)
    if (report.totalDOMNodes > 3000) {
      score -= Math.min(20, (report.totalDOMNodes - 3000) / 100);
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * パフォーマンスグレードを取得
   */
  public getPerformanceGrade(): 'A' | 'B' | 'C' | 'D' | 'F' {
    const score = this.calculatePerformanceScore();
    
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * リアルタイムパフォーマンスダッシュボードを表示
   */
  public showDashboard(): void {
    const report = this.generateReport();
    const score = this.calculatePerformanceScore();
    const grade = this.getPerformanceGrade();

    console.group('[PerformanceMonitor] Performance Dashboard');
    console.log(`Score: ${score}/100 (Grade: ${grade})`);
    console.log(`Average Render Time: ${report.averageRenderTime.toFixed(2)}ms`);
    console.log(`Average Memory Usage: ${report.averageMemoryUsage.toFixed(2)}MB`);
    console.log(`Average Event Handling: ${report.averageEventHandlingTime.toFixed(2)}ms`);
    console.log(`Peak Memory Usage: ${report.peakMemoryUsage.toFixed(2)}MB`);
    console.log(`Total DOM Nodes: ${report.totalDOMNodes}`);
    console.log('Recommendations:');
    report.recommendations.forEach(rec => console.log(`  - ${rec}`));
    console.groupEnd();
  }

  /**
   * パフォーマンスモニタをリセット
   */
  public reset(): void {
    this.stopMonitoring();
    this.clearMetrics();
    console.log('[PerformanceMonitor] Performance monitor reset');
  }
}

// グローバルインスタンスをエクスポート
export const performanceMonitor = PerformanceMonitor.getInstance();