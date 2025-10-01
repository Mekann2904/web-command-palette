/**
 * 最適化されたタイミング定数
 * パフォーマンスとユーザー体験を向上させるための定義
 */

// アニメーションタイミング（60fps基準）
export const ANIMATION_TIMING = {
  FAST: 100,      // 高速アニメーション (6フレーム)
  NORMAL: 200,    // 通常アニメーション (12フレーム)
  SLOW: 300,      // 低速アニメーション (18フレーム)
  VERY_FAST: 50,  // 非常に高速 (3フレーム)
  VERY_SLOW: 500  // 非常に低速 (30フレーム)
} as const;

// デバウンスタイミング（パフォーマンス最適化）
export const DEBOUNCE_TIMING = {
  INPUT: 150,           // 入力デバウンス（ユーザー入力とパフォーマンスのバランス）
  RESIZE: 250,         // リサイズデバウンス（リサイズイベントの頻度を考慮）
  SCROLL: 100,         // スクロールデバウンス（60fpsを維持）
  VIRTUAL_SCROLL: 16,  // 仮想スクロールデバウンス（1フレーム）
  SEARCH: 200,         // 検索デバウンス（検索結果の安定性）
  AUTO_COMPLETE: 100,  // オートコンプリートデバウンス（応答性重視）
  FORM_INPUT: 300      // フォーム入力デバウンス（入力完了を待機）
} as const;

// インタラクションタイミング（ユーザー体験最適化）
export const INTERACTION_TIMING = {
  AUTO_OPEN_DELAY: 120,     // 自動オープン遅延
  TOAST_DURATION: 3000,     // トースト表示期間（読み取り時間を考慮）
  TOAST_FADE_OUT: 300,      // トーストフェードアウト時間
  DOUBLE_CLICK: 300,       // ダブルクリック間隔
  TRIPLE_CLICK: 500,       // トリプルクリック間隔
  HOLD: 500,              // ホールド時間（長押し）
  LONG_PRESS: 800,         // 長押し時間（モバイル考慮）
  TAP_TIMEOUT: 300         // タップタイムアウト
} as const;

// UIフィードバックタイミング
export const FEEDBACK_TIMING = {
  FOCUS_VISIBLE: 200,     // フォーカス表示時間
  ACTIVE_STATE: 150,      // アクティブ状態表示時間
  ERROR_DISPLAY: 5000,    // エラー表示時間（ユーザーが確認できる時間）
  SUCCESS_DISPLAY: 2000,  // 成功表示時間
  LOADING_MIN: 1000,      // 最小ローディング表示時間
  LOADING_MAX: 5000,      // 最大ローディング表示時間
  SKELETON_MIN: 800,      // スケルトン表示最小時間
  TRANSITION_FAST: 150,   // 高速トランジション
  TRANSITION_NORMAL: 250, // 通常トランジション
  TRANSITION_SLOW: 350    // 低速トランジション
} as const;

// レイアウトタイミング（レンダリング最適化）
export const LAYOUT_TIMING = {
  RESIZE_DEBOUNCE: 250,   // リサイズデバウンス
  SCROLL_DEBOUNCE: 16,    // スクロールデバウンス（60fps）
  LAYOUT_SHIFT: 200,      // レイアウトシフト時間
  STABILIZE_DELAY: 100,   // 安定化遅延
  REFRESH_INTERVAL: 1000,  // 更新間隔
  BATCH_RENDER_DELAY: 16, // バッチレンダリング遅延
  RECALCULATION: 50      // 再計算遅延
} as const;

// ネットワークタイミング（パフォーマンス最適化）
export const NETWORK_TIMING = {
  REQUEST_TIMEOUT: 10000,     // リクエストタイムアウト
  RETRY_DELAY: 1000,          // リトライ遅延
  MAX_RETRIES: 3,             // 最大リトライ回数
  CACHE_EXPIRE: 300000,       // キャッシュ有効期限（5分）
  PREFETCH_DELAY: 2000,       // プリフェッチ遅延
  BATCH_SIZE: 10,             // バッチサイズ
  CONCURRENT_LIMIT: 5         // 同時実行制限
} as const;

// パフォーマンス最適化定数
export const PERFORMANCE = {
  // レンダリング最適化
  MAX_DOM_NODES: 5000,           // 最大DOMノード数
  VIRTUAL_SCROLL_THRESHOLD: 100, // 仮想スクロール閾値
  BATCH_SIZE: 50,                // バッチサイズ
  FRAME_BUDGET: 16,              // フレームバジェット（ms）
  
  // メモリ最適化
  MEMORY_CLEANUP_THRESHOLD: 100, // メモリクリーンアップ閾値（MB）
  CACHE_SIZE_LIMIT: 1000,        // キャッシュサイズ制限
  OBJECT_POOL_SIZE: 50,          // オブジェクトプールサイズ
  
  // アニメーション最適化
  REDUCE_MOTION: 'reduce',       // モーション低減設定
  PREFER_REDUCED_MOTION: true,   // 低モーション優先
  ANIMATION_FRAME_SKIP: 2,       // アニメーションフレームスキップ
  
  // 監視最適化
  PERFORMANCE_SAMPLE_RATE: 1000, // パフォーマンスサンプリングレート（ms）
  METRICS_BUFFER_SIZE: 100,      // メトリクスバッファサイズ
  MONITORING_INTERVAL: 5000     // 監視間隔（ms）
} as const;

// アクセシビリティタイミング
export const ACCESSIBILITY_TIMING = {
  FOCUS_VISIBLE_DURATION: 200,  // フォーカス表示持続時間
  SKIP_LINK_DURATION: 3000,    // スキップリンク表示時間
  ANNOUNCEMENT_DELAY: 100,     // アナウンス遅延
  SCREEN_READER_DELAY: 50,     // スクリーンリーダー遅延
  KEYBOARD_NAV_DELAY: 100,     // キーボードナビゲーション遅延
  HIGH_CONTRAST_MODE: 0        // ハイコントラストモード遅延
} as const;

// レスポンシブタイミング
export const RESPONSIVE_TIMING = {
  BREAKPOINT_CHECK_DELAY: 250, // ブレークポイントチェック遅延
  MEDIA_QUERY_DEBOUNCE: 100,    // メディアクエリデバウンス
  ORIENTATION_CHANGE_DELAY: 300, // 向き変更遅延
  RESIZE_END_DELAY: 500,        // リサイズ終了遅延
  TOUCH_FEEDBACK_DELAY: 50      // タッチフィードバック遅延
} as const;

// デバッグタイミング（開発環境用）
export const DEBUG_TIMING = {
  LOG_THROTTLE: 100,           // ログスロットル
  PERFORMANCE_LOG_INTERVAL: 5000, // パフォーマンスログ間隔
  MEMORY_LOG_INTERVAL: 10000,   // メモリログ間隔
  ERROR_REPORT_DELAY: 1000,    // エラー報告遅延
  HEARTBEAT_INTERVAL: 30000     // ハートビート間隔
} as const;

// タイミングユーティリティ
export const TimingUtils = {
  /**
   * アニメーション時間を取得
   */
  getAnimationDuration(speed: keyof typeof ANIMATION_TIMING): number {
    return ANIMATION_TIMING[speed];
  },

  /**
   * デバウンス時間を取得
   */
  getDebounceDelay(type: keyof typeof DEBOUNCE_TIMING): number {
    return DEBOUNCE_TIMING[type];
  },

  /**
   * フレームバジェットをチェック
   */
  checkFrameBudget(startTime: number): boolean {
    return performance.now() - startTime < PERFORMANCE.FRAME_BUDGET;
  },

  /**
   * パフォーマンスモードに基づいてタイミングを調整
   */
  getAdjustedTiming(baseTiming: number, preferReducedMotion: boolean): number {
    if (preferReducedMotion) {
      return Math.min(baseTiming, ANIMATION_TIMING.FAST);
    }
    return baseTiming;
  },

  /**
   * デバイスタイプに基づいてタイミングを調整
   */
  getDeviceAdjustedTiming(baseTiming: number): number {
    // モバイルデバイスの場合は少し長めに設定
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return isMobile ? baseTiming * 1.2 : baseTiming;
  },

  /**
   * ネットワーク状態に基づいてタイミングを調整
   */
  getNetworkAdjustedTiming(baseTiming: number): number {
    // オフラインの場合はタイムアウトを延長
    if (!navigator.onLine) {
      return baseTiming * 2;
    }
    return baseTiming;
  }
};

// 型定義
export type AnimationSpeed = keyof typeof ANIMATION_TIMING;
export type DebounceType = keyof typeof DEBOUNCE_TIMING;
export type InteractionType = keyof typeof INTERACTION_TIMING;
export type FeedbackType = keyof typeof FEEDBACK_TIMING;
export type LayoutType = keyof typeof LAYOUT_TIMING;
export type NetworkType = keyof typeof NETWORK_TIMING;

// バリデーション
export const TimingValidation = {
  /**
   * アニメーション時間が有効かチェック
   */
  isValidAnimationDuration(duration: number): boolean {
    return duration >= ANIMATION_TIMING.VERY_FAST && duration <= ANIMATION_TIMING.VERY_SLOW;
  },

  /**
   * デバウンス時間が有効かチェック
   */
  isValidDebounceDelay(delay: number): boolean {
    return delay >= 16 && delay <= 1000; // 1フレーム〜1秒
  },

  /**
   * パフォーマンスしきい値をチェック
   */
  isPerformanceOptimized(timing: number, maxBudget: number = PERFORMANCE.FRAME_BUDGET): boolean {
    return timing <= maxBudget;
  }
};