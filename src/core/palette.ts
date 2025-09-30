import { SiteEntry } from '@/types';
import { getSettings, incrementUsage } from './storage';
import { showToast } from '@/utils/ui';

// GM_* APIのグローバル宣言
declare const GM_openInTab: (url: string, options?: { active?: boolean; insert?: boolean }) => void;
declare const GM_setClipboard: (text: string) => void;

/**
 * パレットのコアロジックを管理するクラス
 */
export class PaletteCore {
  private inputEl: HTMLInputElement | null = null;

  constructor(inputEl?: HTMLInputElement | null) {
    this.inputEl = inputEl || null;
  }

  /**
   * 入力要素を設定
   */
  setInputElement(inputEl: HTMLInputElement | null): void {
    this.inputEl = inputEl;
  }

  /**
   * エントリを実行する
   */
  executeEntry(entry: SiteEntry, shiftPressed: boolean, query?: string): void {
    if (!entry) return;
    const settings = getSettings();
    const preferNew = settings.enterOpens === 'newtab';
    const openNew = shiftPressed ? !preferNew : preferNew;

    let targetUrl = entry.url;
    if (entry.url && entry.url.includes('%s')) {
      const q = query !== undefined ? query : this.inputEl?.value.trim() || '';
      if (!q) {
        if (this.inputEl) {
          this.inputEl.value = '';
          this.inputEl.placeholder = `${entry.name} に検索キーワードを入力…`;
        }
        showToast('検索キーワードを入力してください');
        this.inputEl?.focus();
        return;
      }
      targetUrl = entry.url.replace(/%s/g, encodeURIComponent(q));
    }

    // パレットを閉じる処理は呼び出し元に委ねる
    incrementUsage(entry.id);
    this.openUrlWithPreference(targetUrl, openNew ? 'newtab' : 'same');
  }

  /**
   * Bing検索を実行する
   */
  runBingSearch(shiftPressed: boolean, entry?: SiteEntry, query?: string): void {
    const keywords = (query || '').trim();
    if (!keywords) {
      showToast('検索キーワードを入力してください');
      return;
    }
    const mode = shiftPressed ? 'newtab' : 'auto';
    this.openUrlWithPreference(`https://www.bing.com/search?q=${encodeURIComponent(keywords)}`, mode);
  }

  /**
   * 入力からBing検索を実行する
   */
  runBingSearchFromInput(): void {
    const q = this.inputEl?.value.trim() || '';
    if (!q) {
      showToast('検索キーワードを入力してください');
      return;
    }
    this.openUrlWithPreference(`https://www.bing.com/search?q=${encodeURIComponent(q)}`);
  }

  /**
   * 設定に応じてURLを開く
   */
  openUrlWithPreference(url: string, mode: 'auto' | 'newtab' | 'same' | 'command' = 'auto'): void {
    const settings = getSettings();
    const openNew = mode === 'newtab' ? true : mode === 'same' ? false : mode === 'command' ? true : settings.enterOpens === 'newtab';
    
    if (openNew) {
      try { 
        GM_openInTab(url, { active: true, insert: true }); 
      } catch { 
        window.open(url, '_blank'); 
      }
    } else {
      try { 
        location.assign(url); 
      } catch { 
        location.href = url; 
      }
    }
  }

  /**
   * 現在のページを追加する
   */
  runAddCurrent(): void {
    const title = document.title || location.hostname;
    const url = location.href;
    
    // この処理はストレージモジュールに依存するため、ここでは実装しない
    // 呼び出し元で適切に処理する
    showToast('現在のページを登録しました');
  }

  /**
   * URLをコピーする
   */
  copyUrl(): void {
    try {
      GM_setClipboard(location.href);
      showToast('URLをコピーしました');
    } catch {
      navigator.clipboard?.writeText(location.href);
      showToast('URLをコピーしました');
    }
  }
}
