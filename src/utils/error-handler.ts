/**
 * 統一されたエラーハンドリングシステム
 */

// エラーの種類を定義
export enum ErrorType {
  VALIDATION = 'validation',
  STORAGE = 'storage',
  NETWORK = 'network',
  PERMISSION = 'permission',
  UNKNOWN = 'unknown'
}

// エラーレベルを定義
export enum ErrorLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// エラー情報のインターフェース
export interface ErrorInfo {
  type: ErrorType;
  level: ErrorLevel;
  message: string;
  code?: string;
  details?: any;
  timestamp: number;
  stack?: string;
  context?: Record<string, any>;
}

// エラーハンドラのインターフェース
export interface ErrorHandler {
  handle(error: ErrorInfo): void;
}

/**
 * カスタムエラークラス
 */
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly level: ErrorLevel;
  public readonly code?: string;
  public readonly details?: any;
  public readonly context?: Record<string, any>;
  public readonly timestamp: number;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    level: ErrorLevel = ErrorLevel.MEDIUM,
    code?: string,
    details?: any,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.level = level;
    this.code = code;
    this.details = details;
    this.context = context;
    this.timestamp = Date.now();
    
    // スタックトレースを維持
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * エラー情報をオブジェクトに変換
   */
  toErrorInfo(): ErrorInfo {
    return {
      type: this.type,
      level: this.level,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
      context: this.context
    };
  }

  /**
   * ユーザー向けのメッセージを取得
   */
  getUserMessage(): string {
    switch (this.type) {
      case ErrorType.VALIDATION:
        return '入力内容が無効です。確認して再度お試しください。';
      case ErrorType.STORAGE:
        return 'データの保存に失敗しました。ブラウザのストレージ容量を確認してください。';
      case ErrorType.NETWORK:
        return 'ネットワーク接続に問題があります。接続状態を確認してください。';
      case ErrorType.PERMISSION:
        return '必要な権限がありません。ブラウザの設定を確認してください。';
      default:
        return 'エラーが発生しました。再度お試しください。';
    }
  }
}

/**
 * エラーハンドリングマネージャー
 */
export class ErrorHandlerManager {
  private static instance: ErrorHandlerManager;
  private handlers: ErrorHandler[] = [];
  private errorHistory: ErrorInfo[] = [];
  private maxHistorySize = 100;

  private constructor() {}

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): ErrorHandlerManager {
    if (!ErrorHandlerManager.instance) {
      ErrorHandlerManager.instance = new ErrorHandlerManager();
    }
    return ErrorHandlerManager.instance;
  }

  /**
   * エラーハンドラを登録
   */
  registerHandler(handler: ErrorHandler): void {
    this.handlers.push(handler);
  }

  /**
   * エラーハンドラを削除
   */
  removeHandler(handler: ErrorHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }

  /**
   * エラーを処理
   */
  handleError(error: Error | AppError | ErrorInfo): void {
    let errorInfo: ErrorInfo;

    if (error instanceof AppError) {
      errorInfo = error.toErrorInfo();
    } else if (error instanceof Error) {
      errorInfo = {
        type: ErrorType.UNKNOWN,
        level: ErrorLevel.MEDIUM,
        message: error.message,
        timestamp: Date.now(),
        stack: error.stack
      };
    } else {
      errorInfo = error;
    }

    // エラー履歴に追加
    this.addToHistory(errorInfo);

    // 登録されたハンドラを実行
    this.handlers.forEach(handler => {
      try {
        handler.handle(errorInfo);
      } catch (handlerError) {
        console.error('[ErrorHandler] Handler error:', handlerError);
      }
    });

    // コンソールに出力
    this.logToConsole(errorInfo);
  }

  /**
   * エラー履歴に追加
   */
  private addToHistory(errorInfo: ErrorInfo): void {
    this.errorHistory.push(errorInfo);
    
    // 履歴サイズを制限
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * コンソールに出力
   */
  private logToConsole(errorInfo: ErrorInfo): void {
    const logLevel = this.getLogLevel(errorInfo.level);
    const message = `[${errorInfo.type.toUpperCase()}] ${errorInfo.message}`;
    
    switch (logLevel) {
      case 'error':
        console.error(message, errorInfo);
        break;
      case 'warn':
        console.warn(message, errorInfo);
        break;
      case 'info':
        console.info(message, errorInfo);
        break;
      default:
        console.log(message, errorInfo);
    }
  }

  /**
   * エラーレベルに応じたログレベルを取得
   */
  private getLogLevel(level: ErrorLevel): 'error' | 'warn' | 'info' | 'log' {
    switch (level) {
      case ErrorLevel.CRITICAL:
      case ErrorLevel.HIGH:
        return 'error';
      case ErrorLevel.MEDIUM:
        return 'warn';
      case ErrorLevel.LOW:
        return 'info';
      default:
        return 'log';
    }
  }

  /**
   * エラー履歴を取得
   */
  getErrorHistory(): ErrorInfo[] {
    return [...this.errorHistory];
  }

  /**
   * エラー履歴をクリア
   */
  clearHistory(): void {
    this.errorHistory = [];
  }
}

/**
 * コンソールエラーハンドラ
 */
export class ConsoleErrorHandler implements ErrorHandler {
  handle(error: ErrorInfo): void {
    const level = error.level;
    const message = `[${error.type.toUpperCase()}] ${error.message}`;
    
    switch (level) {
      case ErrorLevel.CRITICAL:
      case ErrorLevel.HIGH:
        console.error(message, error);
        break;
      case ErrorLevel.MEDIUM:
        console.warn(message, error);
        break;
      case ErrorLevel.LOW:
        console.info(message, error);
        break;
    }
  }
}

/**
 * ユーザー通知エラーハンドラ
 */
export class UserNotificationErrorHandler implements ErrorHandler {
  handle(error: ErrorInfo): void {
    // 重要度が中以上のエラーのみユーザーに通知
    if (error.level === ErrorLevel.LOW) return;
    
    // エラーメッセージを表示
    this.showErrorNotification(error);
  }

  private showErrorNotification(error: ErrorInfo): void {
    // この実装はUIコンポーネントに依存するため、簡易的な実装
    // 実際のアプリケーションでは、適切なUIコンポーネントを使用
    
    // トースト通知の代替
    if (typeof window !== 'undefined' && window.document) {
      const toast = document.createElement('div');
      toast.className = 'error-toast';
      toast.textContent = this.getUserMessage(error);
      toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 2147483647;
        max-width: 300px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
      `;
      
      document.body.appendChild(toast);
      
      // 3秒後に自動的に削除
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 3000);
    }
  }

  private getUserMessage(error: ErrorInfo): string {
    switch (error.type) {
      case ErrorType.VALIDATION:
        return '入力内容が無効です。確認して再度お試しください。';
      case ErrorType.STORAGE:
        return 'データの保存に失敗しました。ブラウザのストレージ容量を確認してください。';
      case ErrorType.NETWORK:
        return 'ネットワーク接続に問題があります。接続状態を確認してください。';
      case ErrorType.PERMISSION:
        return '必要な権限がありません。ブラウザの設定を確認してください。';
      default:
        return error.message || 'エラーが発生しました。再度お試しください。';
    }
  }
}

/**
 * エラーハンドリングのユーティリティ関数
 */
export const handleError = (
  error: Error | AppError | string,
  type: ErrorType = ErrorType.UNKNOWN,
  level: ErrorLevel = ErrorLevel.MEDIUM,
  code?: string,
  details?: any,
  context?: Record<string, any>
): void => {
  const manager = ErrorHandlerManager.getInstance();
  
  if (typeof error === 'string') {
    manager.handleError(new AppError(error, type, level, code, details, context));
  } else {
    manager.handleError(error);
  }
};

/**
 * 非同期関数のエラーをハンドリングするラッパー
 */
export const withErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  type: ErrorType = ErrorType.UNKNOWN,
  level: ErrorLevel = ErrorLevel.MEDIUM
): ((...args: T) => Promise<R | null>) => {
  return async (...args: T): Promise<R | null> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof Error) {
        handleError(error, type, level);
      } else {
        handleError(String(error), type, level);
      }
      return null;
    }
  };
};

/**
 * 初期化関数
 */
export const initializeErrorHandling = (): void => {
  const manager = ErrorHandlerManager.getInstance();
  
  // デフォルトのエラーハンドラを登録
  manager.registerHandler(new ConsoleErrorHandler());
  manager.registerHandler(new UserNotificationErrorHandler());
  
  // グローバルエラーハンドラを設定
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      handleError(
        event.error || new Error(event.message),
        ErrorType.UNKNOWN,
        ErrorLevel.HIGH,
        'GLOBAL_ERROR',
        { filename: event.filename, lineno: event.lineno, colno: event.colno }
      );
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      handleError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        ErrorType.UNKNOWN,
        ErrorLevel.HIGH,
        'UNHANDLED_PROMISE_REJECTION'
      );
    });
  }
};
