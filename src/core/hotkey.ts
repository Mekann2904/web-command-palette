import { Settings } from '@/types';
import { getSettings } from './storage';
import { wildcard } from '@/utils';

/**
 * ホットキーが一致するかチェックする
 */
export const matchHotkey = (e: KeyboardEvent, sig: string): boolean => {
  if (!sig) return false;
  
  // ホットキー文字列を解析（例: "Meta+Shift+KeyP"）
  const parts = sig.split('+');
  const mainKey = parts[parts.length - 1]; // 最後の部分がメインキー
  
  // 修飾キーの部分を取得
  const modifiers = parts.slice(0, -1);
  
  // 修飾キー自体がメインキーとして設定されている場合は無効
  const isModifierKey = [
    'MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight',
    'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight'
  ].includes(mainKey);
  
  if (isModifierKey) return false;
  
  // メインキーが一致するかチェック
  if (e.code !== mainKey) return false;
  
  // 修飾キーの状態をチェック
  const hasMeta = modifiers.includes('Meta');
  const hasControl = modifiers.includes('Control');
  const hasAlt = modifiers.includes('Alt');
  const hasShift = modifiers.includes('Shift');
  
  // 修飾キーの状態が一致するかチェック
  return (
    (hasMeta === e.metaKey) &&
    (hasControl === e.ctrlKey) &&
    (hasAlt === e.altKey) &&
    (hasShift === e.shiftKey)
  );
};

/**
 * サイトがブロックリストに含まれるかチェックする
 */
export const isBlocked = (): boolean => {
  const s = getSettings();
  const patterns = (s.blocklist || '').split(/\r?\n/).map(t => t.trim()).filter(Boolean);
  if (!patterns.length) return false;
  const host = location.hostname;
  return patterns.some(p => wildcard(host, p));
};

/**
 * 自動オープンが必要かチェックする
 */
export const shouldAutoOpen = (): boolean => {
  const { autoOpenUrls = [] } = getSettings();
  if (!Array.isArray(autoOpenUrls) || !autoOpenUrls.length) return false;
  const current = location.href;
  return autoOpenUrls.some(pattern => {
    const parts = pattern.split('*').map(x => x.replace(/[\.^$+?()|{}\[\]]/g, r => '\\' + r));
    const regex = new RegExp('^' + parts.join('.*') + '');
    return regex.test(current);
  });
};

// グローバルホットキーコールバックを保持する変数
let globalHotkeyCallback: (() => void) | null = null;

// パレットが開いているかどうかを追跡する変数
let isPaletteOpen = false;

/**
 * パレットの開閉状態を設定する
 */
export const setPaletteOpenState = (isOpen: boolean): void => {
  isPaletteOpen = isOpen;
};

/**
 * グローバルキーボードイベントハンドラ
 */
export const onGlobalKeydown = (e: KeyboardEvent): void => {
  try {
    // ブロックサイトでは処理しない
    if (isBlocked()) return;
    
    // デバッグログ
    if (isPaletteOpen) {
      console.log('[Debug] Global keydown:', {
        key: e.key,
        code: e.code,
        target: e.target,
        targetTagName: (e.target as HTMLElement)?.tagName,
        targetClassName: (e.target as HTMLElement)?.className,
        isComposing: e.isComposing,
        keyCode: e.keyCode
      });
    }
    
    // パレットが開いている場合は、特定のキー以外は無視
    if (isPaletteOpen) {
      // パレット内の要素からのイベントかチェック
      const target = e.target as HTMLElement | null;
      const isInPalette = target && (
        target.closest('#vm-cmd-palette-host') ||
        target.closest('.overlay') ||
        target.closest('.panel')
      );
      
      console.log('[Debug] Is in palette:', isInPalette, 'Target:', target);
      
      // パレット内からのイベントでない場合は無視
      if (!isInPalette) {
        // Escキーは常に許可（パネルを閉じるため）
        if (e.key === 'Escape') {
          return; // Escキーは許可
        }
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      // パレット内の入力フィールドの場合は、ほぼすべてのキーを許可
      const inputTarget = e.target as HTMLElement | null;
      const isInputField = inputTarget && (
        inputTarget.tagName === 'INPUT' ||
        inputTarget.tagName === 'TEXTAREA' ||
        inputTarget.contentEditable === 'true'
      );
      
      console.log('[Debug] Is input field:', isInputField);
      
      // 入力フィールド内では基本的にすべてのキーを許可
      if (isInputField) {
        console.log('[Debug] Allowing key in input field');
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
        console.log('[Debug] Blocking key:', e.key);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      return; // パレットが開いている場合はここで処理終了
    }
    
    // 編集中の要素では処理しない
    const mainTarget = e.target as HTMLElement | null;
    const tag = (mainTarget && mainTarget.tagName) || '';
    const editable = ['INPUT', 'TEXTAREA'].includes(tag) ||
                     (mainTarget && mainTarget.isContentEditable);
    if (editable) return;
    
    const settings = getSettings();
    
    // ホットキーをチェック
    if (matchHotkey(e, settings.hotkeyPrimary) || matchHotkey(e, settings.hotkeySecondary)) {
      e.preventDefault();
      e.stopPropagation();
      
      // パレットを開く処理を実行
      if (globalHotkeyCallback) {
        globalHotkeyCallback();
      }
    }
  } catch (error) {
    console.error('[CommandPalette] Global hotkey error:', error);
  }
};

/**
 * グローバルホットキーコールバックを設定する
 */
export const setGlobalHotkeyCallback = (callback: () => void): void => {
  globalHotkeyCallback = callback;
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
