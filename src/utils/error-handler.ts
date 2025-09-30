/**
 * エラーハンドリングユーティリティ
 */

export interface ErrorContext {
  component: string;
  action: string;
  data?: any;
  timestamp: number;
}

export interface ErrorReport {
  error: Error;
  context: ErrorContext;
  stack?: string;
  userAgent: string;
  url: string;
}

/**
 * エラーハンドラー
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errors: ErrorReport[] = [];
  private maxErrors = 100;
  private onErrorCallback?: (error: ErrorReport) => void;

  private constructor() {
    // グローバルエラーハンドラを設定
    if (typeof window !== 'undefined') {
      window.addEventListener('error', this.handleGlobalError.bind(this));
      window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    }
  }

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * エラーコールバックを設定
   */
  onError(callback: (error: ErrorReport) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * エラーを記録
   */
  record(error: Error, context: Partial<ErrorContext> = {}): void {
    const errorReport: ErrorReport = {
      error,
      context: {
        component: context.component || 'Unknown',
        action: context.action || 'Unknown',
        data: context.data,
        timestamp: Date.now()
      },
      stack: error.stack,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'Unknown'
    };

    this.errors.push(errorReport);

    // 最大件数を超えた場合は古いものを削除
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // コールバックを実行
    if (this.onErrorCallback) {
      try {
        this.onErrorCallback(errorReport);
      } catch (callbackError) {
        console.error('[ErrorHandler] Error in error callback:', callbackError);
      }
    }

    // コンソールに出力
    this.logError(errorReport);
  }

  /**
   * エラーをラップして実行
   */
  static async wrap<T>(
    fn: () => T | Promise<T>,
    context: Partial<ErrorContext> = {}
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      ErrorHandler.getInstance().record(error as Error, context);
      return null;
    }
  }

  /**
   * 同期関数をラップして実行
   */
  static wrapSync<T>(
    fn: () => T,
    context: Partial<ErrorContext> = {}
  ): T | null {
    try {
      return fn();
    } catch (error) {
      ErrorHandler.getInstance().record(error as Error, context);
      return null;
    }
  }

  /**
   * 非同期関数を安全に実行
   */
  static async safeExecute<T>(
    fn: () => Promise<T>,
    fallback?: T,
    context: Partial<ErrorContext> = {}
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      ErrorHandler.getInstance().record(error as Error, context);
      return fallback !== undefined ? fallback : null as T;
    }
  }

  /**
   * 同期関数を安全に実行
   */
  static safeExecuteSync<T>(
    fn: () => T,
    fallback?: T,
    context: Partial<ErrorContext> = {}
  ): T {
    try {
      return fn();
    } catch (error) {
      ErrorHandler.getInstance().record(error as Error, context);
      return fallback !== undefined ? fallback : null as T;
    }
  }

  /**
   * グローバルエラーハンドラ
   */
  private handleGlobalError(event: ErrorEvent): void {
    this.record(event.error || new Error(event.message), {
      component: 'Global',
      action: 'GlobalError',
      data: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    });
  }

  /**
   * 未処理のPromise拒否をハンドル
   */
  private handleUnhandledRejection(event: PromiseRejectionEvent): void {
    this.record(new Error(`Unhandled Promise Rejection: ${event.reason}`), {
      component: 'Global',
      action: 'UnhandledRejection',
      data: { reason: event.reason }
    });
  }

  /**
   * エラーをコンソールに出力
   */
  private logError(errorReport: ErrorReport): void {
    const { error, context } = errorReport;
    
    console.group(`🚨 [${context.component}] ${context.action}`);
    console.error('Error:', error.message);
    
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    
    if (context.data) {
      console.error('Context:', context.data);
    }
    
    console.error('Timestamp:', new Date(errorReport.context.timestamp).toISOString());
    console.groupEnd();
  }

  /**
   * エラーレポートを取得
   */
  getErrorReport(): ErrorReport[] {
    return [...this.errors];
  }

  /**
   * エラーをクリア
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * エラー統計を取得
   */
  getErrorStats(): {
    total: number;
    byComponent: Record<string, number>;
    byAction: Record<string, number>;
    recent: Array<{
      component: string;
      action: string;
      message: string;
      timestamp: number;
    }>;
  } {
    const stats = {
      total: this.errors.length,
      byComponent: {} as Record<string, number>,
      byAction: {} as Record<string, number>,
      recent: this.errors.slice(-10).map(e => ({
        component: e.context.component,
        action: e.context.action,
        message: e.error.message,
        timestamp: e.context.timestamp
      }))
    };

    this.errors.forEach(error => {
      const { component, action } = error.context;
      stats.byComponent[component] = (stats.byComponent[component] || 0) + 1;
      stats.byAction[action] = (stats.byAction[action] || 0) + 1;
    });

    return stats;
  }

  /**
   * エラーレポートをJSONでエクスポート
   */
  exportErrors(): string {
    return JSON.stringify({
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
      stats: this.getErrorStats(),
      errors: this.errors
    }, null, 2);
  }

  /**
   * 開発モードかどうかを判定
   */
  static isDevelopment(): boolean {
    return (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.NODE_ENV === 'development') ||
           (typeof window !== 'undefined' && (window as any).__DEV__);
  }

  /**
   * ユーザーにエラーを通知
   */
  static notifyUser(message: string, typeValue: 'error' | 'warning' | 'info' = 'error'): void {
    // トースト通知を実装
    if (typeof window !== 'undefined' && (window as any).toastEl) {
      const toastEl = (window as any).toastEl;
      toastEl.innerHTML = '';
      
      const toastMessage = document.createElement('div');
      toastMessage.className = 'toast-message';
      const type = typeValue;
      
      if (type === 'error') {
        toastMessage.style.background = '#dc2626';
      } else if (type === 'warning') {
        toastMessage.style.background = '#f59e0b';
      } else {
        toastMessage.style.background = '#3b82f6';
      }
      
      toastMessage.style.color = 'white';
      toastMessage.style.padding = '10px 16px';
      toastMessage.style.borderRadius = '999px';
      toastMessage.style.boxShadow = '0 10px 20px rgba(0,0,0,0.2)';
      toastMessage.style.animation = 'fade-slide 2.4s ease forwards';
      toastMessage.textContent = message;
      
      toastEl.appendChild(toastMessage);
      toastEl.style.display = 'flex';
      
      setTimeout(() => {
        if (toastEl.contains(toastMessage)) {
          toastEl.removeChild(toastMessage);
        }
        if (toastEl.children.length === 0) {
          toastEl.style.display = 'none';
        }
      }, 2400);
    } else {
      console.error(`[ErrorHandler] ${message}`);
    }
  }
}

/**
 * デコレータ for error handling
 */
export function catchErrors(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    return ErrorHandler.wrap(
      () => originalMethod.apply(this, args),
      {
        component: target.constructor.name,
        action: propertyKey,
        data: { args }
      }
    );
  };

  return descriptor;
}

/**
 * 非同期関数用のデコレータ
 */
export function catchAsyncErrors(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    return ErrorHandler.wrap(
      () => originalMethod.apply(this, args),
      {
        component: target.constructor.name,
        action: propertyKey,
        data: { args }
      }
    );
  };

  return descriptor;
}
