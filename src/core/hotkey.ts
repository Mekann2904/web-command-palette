import { getSettings } from '@/core/storage';
import type { Settings } from '@/types/settings';
import { createSafeRegex } from '@/utils/security';

// 修飾キーの定数
const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Alt', 'Shift']);
const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA']);
const PALETTE_SELECTORS = ['#vm-cmd-palette-host', '.overlay', '.panel'];
const ALLOWED_KEYS = new Set([
  'Escape', 'Enter', 'Tab', 'ArrowUp', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete',
  'Home', 'End', 'PageUp', 'PageDown', ' '
]);

// キャッシュ用変数
let cachedSettings: Settings | null = null;
let cachedBlocklist: string[] | null = null;
let cachedAutoOpenUrls: string[] | null = null;
let lastSettingsUpdate = 0;
const SETTINGS_CACHE_TTL = 5000; // 5秒キャッシュ

// パレットが開いているかどうかを追跡する変数
let isPaletteOpen = false;

// グローバルホットキーコールバック
let globalHotkeyCallback: (() => void) | null = null;

// デバッグモードフラグ（本番環境ではfalseに設定）
const DEBUG_MODE = false;

/**
 * デバッグログを出力（デバッグモード時のみ）
 */
const debugLog = (message: string, data?: any): void => {
  if (DEBUG_MODE) {
    console.log(`[Debug] ${message}`, data);
  }
};

/**
 * 設定をキャッシュから取得
 */
const getCachedSettings = (): Settings => {
  const now = Date.now();
  if (cachedSettings && (now - lastSettingsUpdate) < SETTINGS_CACHE_TTL) {
    return cachedSettings;
  }
  
  cachedSettings = getSettings();
  cachedBlocklist = cachedSettings.blocklist ?
    cachedSettings.blocklist.split(',').map(s => s.trim()).filter(Boolean) :
    [];
  cachedAutoOpenUrls = cachedSettings.autoOpenUrls || [];
  lastSettingsUpdate = now;
  
  return cachedSettings;
};

/**
 * ホットキー判定関数
 */
export const matchHotkey = (e: KeyboardEvent, signature: string): boolean => {
  if (!signature) return false;
  
  const parts = signature.split('+');
  const hasMeta = parts.includes('Meta');
  const hasCtrl = parts.includes('Control');
  const hasAlt = parts.includes('Alt');
  const hasShift = parts.includes('Shift');
  const keyPart = parts.find(p => !MODIFIER_KEYS.has(p));
  
  // メインキーが修飾キーでないことを確認
  if (keyPart && MODIFIER_KEYS.has(keyPart)) {
    return false;
  }
  
  return (
    e.metaKey === hasMeta &&
    e.ctrlKey === hasCtrl &&
    e.altKey === hasAlt &&
    e.shiftKey === hasShift &&
    (keyPart ? e.key === keyPart || e.code === keyPart : true)
  );
};

/**
 * ブロックサイト判定関数
 */
const isBlocked = (): boolean => {
  const settings = getCachedSettings();
  if (!settings.blocklist) return false;
  
  const blocklist = settings.blocklist.split(',').map(s => s.trim()).filter(Boolean);
  if (!blocklist.length) return false;
  
  const hostname = window.location.hostname;
  const href = window.location.href;
  
  return blocklist.some((pattern: string) => {
    const safeRegex = createSafeRegex(pattern, 'i');
    if (!safeRegex) {
      return false;
    }
    return safeRegex.test(hostname) || safeRegex.test(href);
  });
};

/**
 * 自動オープンをチェック
 */
export const shouldAutoOpen = (): boolean => {
  const settings = getCachedSettings();
  if (!settings.autoOpenUrls || !settings.autoOpenUrls.length) return false;
  
  const currentUrl = window.location.href;
  return settings.autoOpenUrls.some((url: string) => {
    const safeRegex = createSafeRegex(url, 'i');
    if (!safeRegex) {
      return false;
    }
    return safeRegex.test(currentUrl);
  });
};

/**
 * パレットの開閉状態を設定する
 */
export const setPaletteOpenState = (isOpen: boolean): void => {
  isPaletteOpen = isOpen;
  debugLog('Palette state set to:', isOpen);
};

/**
 * グローバルホットキーコールバックを設定する
 */
export const setGlobalHotkeyCallback = (callback: () => void): void => {
  globalHotkeyCallback = callback;
};

/**
 * パレットが表示されているかチェック
 */
const isPaletteVisible = (): boolean => {
  const overlayVisible = document.querySelector('.overlay') as HTMLElement;
  return !!(overlayVisible &&
           overlayVisible.classList.contains('visible') &&
           overlayVisible.style.display !== 'none');
};

/**
 * イベントがパレット内から発生したかチェック
 */
const isEventFromPalette = (target: HTMLElement | null): boolean => {
  if (!target) return false;
  return PALETTE_SELECTORS.some(selector => target.closest(selector));
};

/**
 * 入力フィールドかチェック
 */
const isInputField = (target: HTMLElement | null): boolean => {
  if (!target) return false;
  return INPUT_TAGS.has(target.tagName) || target.contentEditable === 'true';
};

/**
 * 許可されたキーかチェック
 */
const isAllowedKey = (e: KeyboardEvent): boolean => {
  // 修飾キーのみの場合は許可
  if (MODIFIER_KEYS.has(e.key)) {
    return true;
  }
  
  // Meta+Enter（Cmd+Enter）は常に許可（Web検索用）
  if (e.key === 'Enter' && e.metaKey) {
    return true;
  }
  
  // 許可されたキーリストに含まれるかチェック
  return ALLOWED_KEYS.has(e.key);
};

/**
 * パレットが開いている場合のキーボードイベント処理
 */
const handlePaletteOpenKeydown = (e: KeyboardEvent): boolean => {
  const target = e.target as HTMLElement | null;
  const isInPalette = isEventFromPalette(target);
  
  debugLog('Palette is visible, checking if event is from palette:', isInPalette);
  
  // パネル内からのイベントでない場合は無視
  if (!isInPalette) {
    // Escキーは常に許可（パネルを閉じるため）
    if (e.key === 'Escape') {
      debugLog('Allowing Escape key outside palette');
      return false; // Escキーは許可
    }
    debugLog('Blocking key outside palette:', e.key);
    e.preventDefault();
    e.stopPropagation();
    return true; // イベントを処理した
  }
  
  // パネル内の入力フィールドの場合は、ほぼすべてのキーを許可
  if (isInputField(target)) {
    debugLog('Allowing key in input field:', e.key);
    return false; // イベントを処理しない
  }
  
  // 入力フィールド以外のパネル内要素では、特定のキーのみ許可
  if (!isAllowedKey(e)) {
    debugLog('Blocking key in palette:', e.key);
    e.preventDefault();
    e.stopPropagation();
    return true; // イベントを処理した
  }
  
  debugLog('Allowing key in palette:', e.key);
  return false; // イベントを処理しない
};

/**
 * パレットが閉じている場合のキーボードイベント処理
 */
const handlePaletteClosedKeydown = (e: KeyboardEvent): boolean => {
  const target = e.target as HTMLElement | null;
  const tag = target?.tagName || '';
  const editable = INPUT_TAGS.has(tag) || (target && target.isContentEditable);
  
  debugLog('Palette is closed, checking for hotkey:', e.key);
  
  if (editable) {
    debugLog('Target is editable, only checking hotkey');
    // 編集中の要素でもホットキーはチェックするが、それ以外はすべて許可
    const settings = getCachedSettings();
    if (matchHotkey(e, settings.hotkeyPrimary) || matchHotkey(e, settings.hotkeySecondary)) {
      debugLog('Hotkey matched in editable element');
      e.preventDefault();
      e.stopPropagation();
      
      // パレットを開く処理を実行
      if (globalHotkeyCallback) {
        globalHotkeyCallback();
      }
      return true; // イベントを処理した
    }
    return false; // ホットキー以外はすべて許可
  }
  
  // 編集中でない要素の場合のみ、ホットキーをチェック
  const settings = getCachedSettings();
  if (matchHotkey(e, settings.hotkeyPrimary) || matchHotkey(e, settings.hotkeySecondary)) {
    debugLog('Hotkey matched, opening palette');
    e.preventDefault();
    e.stopPropagation();
    
    // パレットを開く処理を実行
    if (globalHotkeyCallback) {
      globalHotkeyCallback();
    }
    return true; // イベントを処理した
  }
  
  return false; // ホットキー以外はすべて許可
};

/**
 * グローバルホットキーを設定する
 */
export const setupGlobalHotkey = (settings: Settings): void => {
  // 既存のリスナーを削除
  window.removeEventListener('keydown', onGlobalKeydown, true);
  // 新しいリスナーを追加（バブリングフェーズでキャプチャ）
  window.addEventListener('keydown', onGlobalKeydown, false);
  
  // 設定キャッシュを更新
  cachedSettings = settings;
  cachedBlocklist = settings.blocklist ?
    settings.blocklist.split(',').map(s => s.trim()).filter(Boolean) :
    [];
  cachedAutoOpenUrls = settings.autoOpenUrls || [];
  lastSettingsUpdate = Date.now();
};

/**
 * グローバルキーボードイベントハンドラ
 */
export const onGlobalKeydown = (e: KeyboardEvent): void => {
  try {
    // ブロックサイトでは処理しない
    if (isBlocked()) return;
    
    // パネルが実際に表示されているかをチェック
    const isActuallyVisible = isPaletteVisible();
    
    if (DEBUG_MODE) {
      debugLog('Global keydown:', {
        key: e.key,
        code: e.code,
        target: e.target,
        targetTagName: (e.target as HTMLElement)?.tagName,
        targetClassName: (e.target as HTMLElement)?.className,
        isComposing: e.isComposing,
        keyCode: e.keyCode,
        isPaletteOpen,
        isActuallyVisible,
        overlayDisplay: (document.querySelector('.overlay') as HTMLElement)?.style.display,
        overlayClasses: (document.querySelector('.overlay') as HTMLElement)?.className
      });
    }
    
    // パネルが表示されている場合と閉じている場合で処理を分岐
    if (isActuallyVisible) {
      handlePaletteOpenKeydown(e);
    } else {
      handlePaletteClosedKeydown(e);
    }
  } catch (error) {
    console.error('[CommandPalette] Global hotkey error:', error);
  }
};

/**
 * 設定キャッシュをクリア
 */
export const clearSettingsCache = (): void => {
  cachedSettings = null;
  cachedBlocklist = null;
  cachedAutoOpenUrls = null;
  lastSettingsUpdate = 0;
};
