import { SiteEntry } from '@/types';

// GM_* APIのグローバル宣言
declare const GM_getValue: <T>(key: string, defaultValue?: T) => T;
declare const GM_setValue: (key: string, value: any) => void;

/**
 * トーストメッセージを表示する
 */
export const showToast = (message: string): void => {
  // グローバル変数から取得
  const toastEl = (window as any).toastEl as HTMLDivElement | null;
  if (!toastEl) return;
  
  toastEl.innerHTML = '';
  const msg = document.createElement('div');
  msg.className = 'toast-message';
  msg.textContent = message;
  toastEl.appendChild(msg);
  toastEl.style.display = 'flex';
  
  setTimeout(() => {
    if (toastEl && toastEl.contains(msg)) {
      toastEl.removeChild(msg);
    }
    if (toastEl) {
      toastEl.style.display = 'none';
    }
  }, 2400);
};
