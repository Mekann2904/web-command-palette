/**
 * タイミング関連の定数
 */

export const TIMING = {
  // 即時実行
  IMMEDIATE: 0,
  
  // フォーカス遅延
  FOCUS_DELAY: 0,
  
  // 自動オープン遅延
  AUTO_OPEN_DELAY: 120,
  
  // アニメーションオフセット
  ANIMATION_OFFSET: 60,
  
  // トースト表示期間
  TOAST_DURATION: 3000,
  
  // URL破棄遅延
  URL_REVOKE_DELAY: 2000,
  
  // ブラーチェック遅延
  BLUR_CHECK_DELAY: 0,
  
  // 入力スペース追加遅延
  INPUT_SPACE_DELAY: 0,
  
  // ドラッグ開始遅延
  DRAG_START_DELAY: 0,
  
  // 仮想スクロールのデバウンス時間
  VIRTUAL_SCROLL_DEBOUNCE: 16,
  
  // 入力デバウンス時間
  INPUT_DEBOUNCE: 150,
  
  // シェイクアニメーション間隔
  SHAKE_INTERVAL: 50,
  
  // バウンスアニメーション遅延
  BOUNCE_DELAY: 150,
  
  // フェードアウト遅延
  FADE_OUT_DELAY: 200,
  
  // スライドイン時間
  SLIDE_IN_DURATION: 200,
  
  // スケールイン時間
  SCALE_IN_DURATION: 200
} as const;