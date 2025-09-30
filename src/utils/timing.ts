/**
 * タイミング関連のユーティリティ関数
 */

import { TIMING } from '@/constants';

/**
 * 指定した時間だけ遅延するPromiseを返す
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * 即時実行タイムアウトを設定する
 */
export const setImmediateTimeout = (callback: () => void): ReturnType<typeof setTimeout> => {
  return setTimeout(callback, TIMING.IMMEDIATE);
};

/**
 * 自動オープン用の遅延タイムアウトを設定する
 */
export const setAutoOpenTimeout = (callback: () => void): ReturnType<typeof setTimeout> => {
  return setTimeout(callback, TIMING.AUTO_OPEN_DELAY);
};

/**
 * 入力フィールドにスペースを追加する
 */
export const addInputSpace = (inputEl: HTMLInputElement): void => {
  setTimeout(() => {
    inputEl.value += ' ';
  }, TIMING.INPUT_SPACE_DELAY);
};

/**
 * ブラーチェック用の遅延処理を実行する
 */
export const setBlurCheckTimeout = (callback: () => void): ReturnType<typeof setTimeout> => {
  return setTimeout(callback, TIMING.BLUR_CHECK_DELAY);
};

/**
 * URL破棄用の遅延処理を実行する
 */
export const setUrlRevokeTimeout = (callback: () => void): ReturnType<typeof setTimeout> => {
  return setTimeout(callback, TIMING.URL_REVOKE_DELAY);
};

/**
 * トースト表示用の遅延処理を実行する
 */
export const setToastTimeout = (callback: () => void): ReturnType<typeof setTimeout> => {
  return setTimeout(callback, TIMING.TOAST_DURATION);
};

/**
 * ドラッグ開始用の遅延処理を実行する
 */
export const setDragStartTimeout = (callback: () => void): ReturnType<typeof setTimeout> => {
  return setTimeout(callback, TIMING.DRAG_START_DELAY);
};

/**
 * アニメーションオフセット用の遅延処理を実行する
 */
export const setAnimationOffsetTimeout = (callback: () => void): ReturnType<typeof setTimeout> => {
  return setTimeout(callback, TIMING.ANIMATION_OFFSET);
};

/**
 * フォーカス設定用の遅延処理を実行する
 */
export const setFocusTimeout = (callback: () => void): ReturnType<typeof setTimeout> => {
  return setTimeout(callback, TIMING.FOCUS_DELAY);
};

/**
 * デバウンス用の遅延処理を実行する
 */
export const setDebounceTimeout = (callback: () => void): ReturnType<typeof setTimeout> => {
  return setTimeout(callback, TIMING.INPUT_DEBOUNCE);
};

/**
 * 仮想スクロール用のデバウンス遅延処理を実行する
 */
export const setVirtualScrollTimeout = (callback: () => void): ReturnType<typeof setTimeout> => {
  return setTimeout(callback, TIMING.VIRTUAL_SCROLL_DEBOUNCE);
};

/**
 * 指定した時間だけ待機してからコールバックを実行する
 */
export const waitAndExecute = (ms: number, callback: () => void): ReturnType<typeof setTimeout> => {
  return setTimeout(callback, ms);
};

/**
 * タイムアウトをクリアする安全な関数
 */
export const clearSafeTimeout = (timeoutId: ReturnType<typeof setTimeout> | undefined): void => {
  if (timeoutId !== undefined) {
    clearTimeout(timeoutId);
  }
};