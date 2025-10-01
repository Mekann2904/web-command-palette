/**
 * メモリ管理ユーティリティ
 * メモリ使用量を最適化し、メモリリークを防止する
 */

export interface MemoryStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  timestamp: number;
}

export interface MemoryThresholds {
  warning: number; // 警告レベル（MB）
  critical: number; // 危険レベル（MB）
  cleanup: number; // クリーンアップ実行レベル（MB）
}

export class MemoryManager {
  private static instance: MemoryManager;
  private stats: MemoryStats[] = [];
  private maxStatsHistory: number = 100;
  private thresholds: MemoryThresholds = {
    warning: 50,   // 50MB
    critical: 100, // 100MB
    cleanup: 75    // 75MB
  };
  private cleanupCallbacks: (() => void)[] = [];
  private isMonitoring: boolean = false;
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {}

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * メモリ統計を取得
   */
  public getMemoryStats(): MemoryStats | null {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        timestamp: Date.now()
      };
    }
    return null;
  }

  /**
   * メモリ使用量をMB単位で取得
   */
  public getMemoryUsageMB(): number {
    const stats = this.getMemoryStats();
    return stats ? stats.usedJSHeapSize / (1024 * 1024) : 0;
  }

  /**
   * メモリ統計を記録
   */
  public recordMemoryStats(): void {
    const stats = this.getMemoryStats();
    if (stats) {
      this.stats.push(stats);
      
      // 履歴のサイズを制限
      if (this.stats.length > this.maxStatsHistory) {
        this.stats.shift();
      }
      
      // メモリ使用量をチェック
      this.checkMemoryUsage(stats);
    }
  }

  /**
   * メモリ使用量をチェックし、必要に応じてクリーンアップを実行
   */
  private checkMemoryUsage(stats: MemoryStats): void {
    const usageMB = stats.usedJSHeapSize / (1024 * 1024);
    
    if (usageMB >= this.thresholds.critical) {
      console.warn(`[MemoryManager] Critical memory usage: ${usageMB.toFixed(2)}MB`);
      this.performCleanup();
      this.notifyCriticalMemory(usageMB);
    } else if (usageMB >= this.thresholds.cleanup) {
      console.warn(`[MemoryManager] High memory usage: ${usageMB.toFixed(2)}MB`);
      this.performCleanup();
    } else if (usageMB >= this.thresholds.warning) {
      console.warn(`[MemoryManager] Warning memory usage: ${usageMB.toFixed(2)}MB`);
    }
  }

  /**
   * クリーンアップを実行
   */
  private performCleanup(): void {
    console.log('[MemoryManager] Performing memory cleanup...');
    
    // 登録されたクリーンアップコールバックを実行
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('[MemoryManager] Error in cleanup callback:', error);
      }
    });
    
    // ガベージコレクションを提案（利用可能な場合）
    this.suggestGarbageCollection();
    
    // 古い統計をクリア
    this.clearOldStats();
  }

  /**
   * ガベージコレクションを提案
   */
  private suggestGarbageCollection(): void {
    if (typeof (window as any).gc === 'function') {
      try {
        (window as any).gc();
        console.log('[MemoryManager] Garbage collection triggered');
      } catch (error) {
        console.warn('[MemoryManager] Failed to trigger garbage collection:', error);
      }
    }
  }

  /**
   * 古い統計をクリア
   */
  private clearOldStats(): void {
    // 最新の50件のみを保持
    if (this.stats.length > 50) {
      this.stats = this.stats.slice(-50);
    }
  }

  /**
   * クリーンアップコールバックを登録
   */
  public addCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * クリーンアップコールバックを削除
   */
  public removeCleanupCallback(callback: () => void): void {
    const index = this.cleanupCallbacks.indexOf(callback);
    if (index !== -1) {
      this.cleanupCallbacks.splice(index, 1);
    }
  }

  /**
   * メモリ監視を開始
   */
  public startMonitoring(intervalMs: number = 5000): void {
    if (this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.recordMemoryStats();
    }, intervalMs);
    
    console.log('[MemoryManager] Memory monitoring started');
  }

  /**
   * メモリ監視を停止
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    console.log('[MemoryManager] Memory monitoring stopped');
  }

  /**
   * 監視状態を取得
   */
  public isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * しきい値を設定
   */
  public setThresholds(thresholds: Partial<MemoryThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * しきい値を取得
   */
  public getThresholds(): MemoryThresholds {
    return { ...this.thresholds };
  }

  /**
   * メモリ統計履歴を取得
   */
  public getStatsHistory(): MemoryStats[] {
    return [...this.stats];
  }

  /**
   * メモリ使用量の傾向を分析
   */
  public analyzeMemoryTrend(): {
    trend: 'increasing' | 'decreasing' | 'stable';
    rate: number; // MB per minute
    prediction: number; // 次の分の予測使用量（MB）
  } {
    if (this.stats.length < 2) {
      return { trend: 'stable', rate: 0, prediction: this.getMemoryUsageMB() };
    }
    
    const recent = this.stats.slice(-10); // 最新10件を使用
    const oldest = recent[0];
    const newest = recent[recent.length - 1];
    
    const timeDiff = (newest.timestamp - oldest.timestamp) / (1000 * 60); // 分
    const memoryDiff = (newest.usedJSHeapSize - oldest.usedJSHeapSize) / (1024 * 1024); // MB
    const rate = memoryDiff / timeDiff; // MB per minute
    
    let trend: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(rate) < 0.5) {
      trend = 'stable';
    } else if (rate > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }
    
    const prediction = this.getMemoryUsageMB() + rate;
    
    return { trend, rate, prediction };
  }

  /**
   * メモリリークを検出
   */
  public detectMemoryLeaks(): {
    hasLeak: boolean;
    leakRate: number; // MB per minute
    confidence: number; // 0-1
  } {
    if (this.stats.length < 10) {
      return { hasLeak: false, leakRate: 0, confidence: 0 };
    }
    
    const trend = this.analyzeMemoryTrend();
    const hasLeak = trend.trend === 'increasing' && trend.rate > 1.0;
    
    // 信頼度を計算
    let confidence = 0;
    if (hasLeak) {
      confidence = Math.min(1, trend.rate / 5); // 5MB/minで信頼度1
    }
    
    return {
      hasLeak,
      leakRate: trend.rate,
      confidence
    };
  }

  /**
   * メモリ使用量レポートを生成
   */
  public generateReport(): {
    current: MemoryStats | null;
    usageMB: number;
    trend: ReturnType<MemoryManager['analyzeMemoryTrend']>;
    leaks: ReturnType<MemoryManager['detectMemoryLeaks']>;
    thresholds: MemoryThresholds;
    recommendations: string[];
  } {
    const current = this.getMemoryStats();
    const usageMB = this.getMemoryUsageMB();
    const trend = this.analyzeMemoryTrend();
    const leaks = this.detectMemoryLeaks();
    
    const recommendations: string[] = [];
    
    if (usageMB >= this.thresholds.critical) {
      recommendations.push('即座にメモリクリーンアップを実行してください');
    } else if (usageMB >= this.thresholds.cleanup) {
      recommendations.push('メモリクリーンアップを検討してください');
    } else if (usageMB >= this.thresholds.warning) {
      recommendations.push('メモリ使用量を監視してください');
    }
    
    if (leaks.hasLeak) {
      recommendations.push('メモリリークが検出されました。コードを確認してください');
    }
    
    if (trend.trend === 'increasing' && trend.rate > 2) {
      recommendations.push('メモリ使用量が急増しています。原因を調査してください');
    }
    
    return {
      current,
      usageMB,
      trend,
      leaks,
      thresholds: this.thresholds,
      recommendations
    };
  }

  /**
   * 危険なメモリ使用量を通知
   */
  private notifyCriticalMemory(usageMB: number): void {
    // カスタムイベントを発行
    if (typeof CustomEvent !== 'undefined') {
      const event = new CustomEvent('memoryCritical', {
        detail: { usageMB, timestamp: Date.now() }
      });
      window.dispatchEvent(event);
    }
  }

  /**
   * 強制的なクリーンアップを実行
   */
  public forceCleanup(): void {
    console.log('[MemoryManager] Force cleanup initiated');
    this.performCleanup();
    
    // 追加のクリーンアップ処理
    this.stats = [];
    this.cleanupCallbacks = [];
  }

  /**
   * メモリマネージャをリセット
   */
  public reset(): void {
    this.stopMonitoring();
    this.stats = [];
    this.cleanupCallbacks = [];
    console.log('[MemoryManager] Memory manager reset');
  }
}

// グローバルインスタンスをエクスポート
export const memoryManager = MemoryManager.getInstance();