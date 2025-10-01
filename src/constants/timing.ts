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
  
  // トースト非表示遅延
  TOAST_HIDE_DELAY: 3000,
  
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
  SCALE_IN_DURATION: 200,
  
  // 新しく追加する定数（リファクタリング計画に基づく）
  
  // オートコンプリート非表示遅延
  AUTOCOMPLETE_HIDE_DELAY: 300,
  
  // フォーカストラップ遅延
  FOCUS_TRAP_DELAY: 0,
  
  // オーバーレイ非表示遅延
  OVERLAY_HIDE_DELAY: 200,
  
  // アニメーションフレーム遅延
  ANIMATION_FRAME_DELAY: 16,
  
  // ダブルクリック遅延
  DOUBLE_CLICK_DELAY: 300,
  
  // ホールド遅延
  HOLD_DELAY: 500,
  
  // リサイズデバウンス
  RESIZE_DEBOUNCE: 250,
  
  // スクロールデバウンス
  SCROLL_DEBOUNCE: 100,
  
  // キー入力遅延
  KEY_INPUT_DELAY: 50,
  
  // メニュー表示遅延
  MENU_SHOW_DELAY: 100,
  
  // メニュー非表示遅延
  MENU_HIDE_DELAY: 150
} as const;