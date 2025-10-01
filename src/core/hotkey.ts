import { getSettings } from '@/core/storage';
import type { Settings } from '@/types/settings';

// ホットキー判定関数
export const matchHotkey = (e: KeyboardEvent, signature: string): boolean => {
  const parts = signature.split('+');
  const hasMeta = parts.includes('Meta');
  const hasCtrl = parts.includes('Control');
  const hasAlt = parts.includes('Alt');
  const hasShift = parts.includes('Shift');
  const keyPart = parts.find(p => !['Meta', 'Control', 'Alt', 'Shift'].includes(p));
  
  return (
    e.metaKey === hasMeta &&
    e.ctrlKey === hasCtrl &&
    e.altKey === hasAlt &&
    e.shiftKey === hasShift &&
    (keyPart ? e.key === keyPart || e.code === keyPart : true)
  );
};

// ブロックサイト判定関数
const isBlocked = (): boolean => {
  const settings = getSettings();
  if (!settings.blocklist) return false;
  
  const blocklist = settings.blocklist.split(',').map(s => s.trim()).filter(Boolean);
  if (!blocklist.length) return false;
  
  const hostname = window.location.hostname;
  const href = window.location.href;
  
  return blocklist.some(pattern => {
    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(hostname) || regex.test(href);
    } catch {
      return false;
    }
  });
};

// パレットが開いているかどうかを追跡する変数
let isPaletteOpen = false;

// グローバルホットキーコールバック
let globalHotkeyCallback: (() => void) | null = null;

/**
 * パレットの開閉状態を設定する
 */
export const setPaletteOpenState = (isOpen: boolean): void => {
  isPaletteOpen = isOpen;
  console.log('[Debug] Palette state set to:', isOpen);
};

/**
 * グローバルホットキーコールバックを設定する
 */
export const setGlobalHotkeyCallback = (callback: () => void): void => {
  globalHotkeyCallback = callback;
};

/**
 * 自動オープンをチェック
 */
export const shouldAutoOpen = (): boolean => {
  const settings = getSettings();
  if (!settings.autoOpenUrls || !settings.autoOpenUrls.length) return false;
  
  const currentUrl = window.location.href;
  return settings.autoOpenUrls.some(url => {
    try {
      return new RegExp(url, 'i').test(currentUrl);
    } catch {
      return false;
    }
  });
};

/**
 * グローバルホットキーを設定する
 */
export const setupGlobalHotkey = (settings: Settings): void => {
  // 既存のリスナーを削除
  window.removeEventListener('keydown', onGlobalKeydown, true);
  // 新しいリスナーを追加（バブリングフェーズでキャプチャ）
  window.addEventListener('keydown', onGlobalKeydown, false);
};

/**
 * グローバルキーボードイベントハンドラ
 */
export const onGlobalKeydown = (e: KeyboardEvent): void => {
  try {
    // ブロックサイトでは処理しない
    if (isBlocked()) return;
    
    // パネルが実際に表示されているかをチェック
    const overlayVisible = document.querySelector('.overlay') as HTMLElement;
    const isActuallyVisible = overlayVisible && 
                            overlayVisible.classList.contains('visible') && 
                            overlayVisible.style.display !== 'none';
    
    // デバッグログ
    console.log('[Debug] Global keydown:', {
      key: e.key,
      code: e.code,
      target: e.target,
      targetTagName: (e.target as HTMLElement)?.tagName,
      targetClassName: (e.target as HTMLElement)?.className,
      isComposing: e.isComposing,
      keyCode: e.keyCode,
      isPaletteOpen,
      isActuallyVisible,
      overlayDisplay: overlayVisible?.style.display,
      overlayClasses: overlayVisible?.className
    });
    
    // パネルが実際に表示されている場合のみ、パネル関連の処理を行う
    if (isActuallyVisible) {
      // パレット内の要素からのイベントかチェック
      const target = e.target as HTMLElement | null;
      const isInPalette = target && (
        target.closest('#vm-cmd-palette-host') ||
        target.closest('.overlay') ||
        target.closest('.panel')
      );
      
      console.log('[Debug] Palette is visible, checking if event is from palette:', isInPalette);
      
      // パネル内からのイベントでない場合は無視
      if (!isInPalette) {
        // Escキーは常に許可（パネルを閉じるため）
        if (e.key === 'Escape') {
          console.log('[Debug] Allowing Escape key outside palette');
          return; // Escキーは許可
        }
        console.log('[Debug] Blocking key outside palette:', e.key);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      // パネル内の入力フィールドの場合は、ほぼすべてのキーを許可
      const inputTarget = e.target as HTMLElement | null;
      const isInputField = inputTarget && (
        inputTarget.tagName === 'INPUT' ||
        inputTarget.tagName === 'TEXTAREA' ||
        inputTarget.contentEditable === 'true'
      );
      
      console.log('[Debug] Is input field:', isInputField);
      
      // 入力フィールド内では基本的にすべてのキーを許可
      if (isInputField) {
        console.log('[Debug] Allowing key in input field:', e.key);
        // 入力フィールド内では何も制限しない
        return;
      }
      
      // 入力フィールド以外のパネル内要素では、特定のキーのみ許可
      const allowedKeys = [
        'Escape', 'Enter', 'Tab', 'ArrowUp', 'ArrowDown',
        'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete',
        'Home', 'End', 'PageUp', 'PageDown', ' '
      ];
      
      // 修飾キーのみの場合は許可
      if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) {
        return;
      }
      
      // Meta+Enter（Cmd+Enter）は常に許可（Web検索用）
      if (e.key === 'Enter' && e.metaKey) {
        console.log('[Debug] Allowing Cmd+Enter for web search');
        return;
      }
      
      // 許可されたキーでない場合は無視
      if (!allowedKeys.includes(e.key)) {
        console.log('[Debug] Blocking key in palette:', e.key);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      console.log('[Debug] Allowing key in palette:', e.key);
      return; // パレットが開いている場合はここで処理終了
    }
    
    // パネルが閉じている場合は、基本的にすべてのキーを許可
    console.log('[Debug] Palette is closed, checking for hotkey:', e.key);
    
    // 編集中の要素ではホットキーのみをチェック
    const mainTarget = e.target as HTMLElement | null;
    const tag = (mainTarget && mainTarget.tagName) || '';
    const editable = ['INPUT', 'TEXTAREA'].includes(tag) ||
                     (mainTarget && mainTarget.isContentEditable);
    
    if (editable) {
      console.log('[Debug] Target is editable, only checking hotkey');
      // 編集中の要素でもホットキーはチェックするが、それ以外はすべて許可
      const settings = getSettings();
      if (matchHotkey(e, settings.hotkeyPrimary) || matchHotkey(e, settings.hotkeySecondary)) {
        console.log('[Debug] Hotkey matched in editable element');
        e.preventDefault();
        e.stopPropagation();
        
        // パレットを開く処理を実行
        if (globalHotkeyCallback) {
          globalHotkeyCallback();
        }
      }
      // ホットキー以外はすべて許可
      return;
    }
    
    // 編集中でない要素の場合のみ、ホットキーをチェック
    const settings = getSettings();
    if (matchHotkey(e, settings.hotkeyPrimary) || matchHotkey(e, settings.hotkeySecondary)) {
      console.log('[Debug] Hotkey matched, opening palette');
      e.preventDefault();
      e.stopPropagation();
      
      // パレットを開く処理を実行
      if (globalHotkeyCallback) {
        globalHotkeyCallback();
      }
    }
    // ホットキー以外はすべて許可
  } catch (error) {
    console.error('[CommandPalette] Global hotkey error:', error);
  }
};
