import { Settings } from '@/types';
import { getSettings } from './storage';
import { wildcard } from '@/utils';

/**
 * ホットキーが一致するかチェックする
 */
export const matchHotkey = (e: KeyboardEvent, sig: string): boolean => {
  if (!sig) return false;
  const [mod, code] = sig.split('+');
  return ((mod === 'Meta' && e.metaKey) || (mod === 'Control' && e.ctrlKey)) && 
         e.code === code && 
         !e.altKey && 
         !e.shiftKey;
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

/**
 * グローバルキーボードイベントハンドラ
 */
export const onGlobalKeydown = (e: KeyboardEvent): void => {
  // ブロックサイトでは処理しない
  if (isBlocked()) return;
  
  // 編集中の要素では処理しない
  const target = e.target as HTMLElement | null;
  const tag = (target && target.tagName) || '';
  const editable = ['INPUT', 'TEXTAREA'].includes(tag) || 
                   (target && target.isContentEditable);
  if (editable) return;
  
  const settings = getSettings();
  
  // ホットキーをチェック
  if (matchHotkey(e, settings.hotkeyPrimary) || matchHotkey(e, settings.hotkeySecondary)) {
    e.preventDefault();
    e.stopPropagation();
    
    // パレットを開く処理はmain.tsからインポートする
    // ここではイベントを阻止するのみ
  }
};

/**
 * グローバルホットキーを設定する
 */
export const setupGlobalHotkey = (settings: Settings): void => {
  // 既存のリスナーを削除
  window.removeEventListener('keydown', onGlobalKeydown, true);
  // 新しいリスナーを追加
  window.addEventListener('keydown', onGlobalKeydown, true);
};
