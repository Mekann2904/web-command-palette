/**
 * タイミング関連のユーティリティ関数
 */

import { TIMING } from '@/constants';

/**
 * タイミングユーティリティの共通オブジェクト
 */
export const TimingUtils = {
  /**
   * 指定した時間だけ遅延するPromiseを返す
   */
  delay: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * 基本的なsetTimeout関数
   */
  setTimeout: (callback: () => void, delay: number): ReturnType<typeof setTimeout> => {
    return setTimeout(callback, delay);
  },

  /**
   * 即時実行タイムアウトを設定する
   */
  setImmediate: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.IMMEDIATE);
  },

  /**
   * 自動オープン用の遅延タイムアウトを設定する
   */
  setAutoOpen: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.AUTO_OPEN_DELAY);
  },

  /**
   * トースト非表示用の遅延処理を実行する
   */
  hideToast: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.TOAST_HIDE_DELAY);
  },

  /**
   * 入力フィールドにスペースを追加する
   */
  addInputSpace: (inputEl: HTMLInputElement): void => {
    TimingUtils.setTimeout(() => {
      inputEl.value += ' ';
    }, TIMING.INPUT_SPACE_DELAY);
  },

  /**
   * ブラーチェック用の遅延処理を実行する
   */
  setBlurCheck: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.BLUR_CHECK_DELAY);
  },

  /**
   * URL破棄用の遅延処理を実行する
   */
  setUrlRevoke: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.URL_REVOKE_DELAY);
  },

  /**
   * トースト表示用の遅延処理を実行する
   */
  setToast: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.TOAST_DURATION);
  },

  /**
   * ドラッグ開始用の遅延処理を実行する
   */
  setDragStart: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.DRAG_START_DELAY);
  },

  /**
   * アニメーションオフセット用の遅延処理を実行する
   */
  setAnimationOffset: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.ANIMATION_OFFSET);
  },

  /**
   * フォーカス設定用の遅延処理を実行する
   */
  setFocus: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.FOCUS_DELAY);
  },

  /**
   * デバウンス用の遅延処理を実行する
   */
  setDebounce: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.INPUT_DEBOUNCE);
  },

  /**
   * 仮想スクロール用のデバウンス遅延処理を実行する
   */
  setVirtualScroll: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.VIRTUAL_SCROLL_DEBOUNCE);
  },

  /**
   * オートコンプリート非表示用の遅延処理を実行する
   */
  hideAutocomplete: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.AUTOCOMPLETE_HIDE_DELAY);
  },

  /**
   * フォーカストラップ用の遅延処理を実行する
   */
  setFocusTrap: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.FOCUS_TRAP_DELAY);
  },

  /**
   * オーバーレイ非表示用の遅延処理を実行する
   */
  hideOverlay: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.OVERLAY_HIDE_DELAY);
  },

  /**
   * アニメーションフレーム用の遅延処理を実行する
   */
  setAnimationFrame: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.ANIMATION_FRAME_DELAY);
  },

  /**
   * ダブルクリック用の遅延処理を実行する
   */
  setDoubleClick: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.DOUBLE_CLICK_DELAY);
  },

  /**
   * ホールド用の遅延処理を実行する
   */
  setHold: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.HOLD_DELAY);
  },

  /**
   * リサイズデバウンス用の遅延処理を実行する
   */
  setResizeDebounce: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.RESIZE_DEBOUNCE);
  },

  /**
   * スクロールデバウンス用の遅延処理を実行する
   */
  setScrollDebounce: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.SCROLL_DEBOUNCE);
  },

  /**
   * キー入力用の遅延処理を実行する
   */
  setKeyInput: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.KEY_INPUT_DELAY);
  },

  /**
   * メニュー表示用の遅延処理を実行する
   */
  showMenu: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.MENU_SHOW_DELAY);
  },

  /**
   * メニュー非表示用の遅延処理を実行する
   */
  hideMenu: (callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, TIMING.MENU_HIDE_DELAY);
  },

  /**
   * 指定した時間だけ待機してからコールバックを実行する
   */
  waitAndExecute: (ms: number, callback: () => void): ReturnType<typeof setTimeout> => {
    return TimingUtils.setTimeout(callback, ms);
  },

  /**
   * タイムアウトをクリアする安全な関数
   */
  clearSafeTimeout: (timeoutId: ReturnType<typeof setTimeout> | undefined): void => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
};

// 後方互換性のために個別関数もエクスポート
/**
 * 指定した時間だけ遅延するPromiseを返す
 */
export const delay = TimingUtils.delay;

/**
 * 即時実行タイムアウトを設定する
 */
export const setImmediateTimeout = TimingUtils.setImmediate;

/**
 * 自動オープン用の遅延タイムアウトを設定する
 */
export const setAutoOpenTimeout = TimingUtils.setAutoOpen;

/**
 * 入力フィールドにスペースを追加する
 */
export const addInputSpace = TimingUtils.addInputSpace;

/**
 * ブラーチェック用の遅延処理を実行する
 */
export const setBlurCheckTimeout = TimingUtils.setBlurCheck;

/**
 * URL破棄用の遅延処理を実行する
 */
export const setUrlRevokeTimeout = TimingUtils.setUrlRevoke;

/**
 * トースト表示用の遅延処理を実行する
 */
export const setToastTimeout = TimingUtils.setToast;

/**
 * ドラッグ開始用の遅延処理を実行する
 */
export const setDragStartTimeout = TimingUtils.setDragStart;

/**
 * アニメーションオフセット用の遅延処理を実行する
 */
export const setAnimationOffsetTimeout = TimingUtils.setAnimationOffset;

/**
 * フォーカス設定用の遅延処理を実行する
 */
export const setFocusTimeout = TimingUtils.setFocus;

/**
 * デバウンス用の遅延処理を実行する
 */
export const setDebounceTimeout = TimingUtils.setDebounce;

/**
 * 仮想スクロール用のデバウンス遅延処理を実行する
 */
export const setVirtualScrollTimeout = TimingUtils.setVirtualScroll;

/**
 * 指定した時間だけ待機してからコールバックを実行する
 */
export const waitAndExecute = TimingUtils.waitAndExecute;

/**
 * タイムアウトをクリアする安全な関数
 */
export const clearSafeTimeout = TimingUtils.clearSafeTimeout;