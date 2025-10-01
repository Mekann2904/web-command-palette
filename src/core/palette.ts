import { SiteEntry } from '@/types';
import { getSettings, incrementUsage } from './storage';
import { showToast } from '@/utils/ui';
import { isValidUrl, validateInput } from '@/utils/security';

// GM_* APIのグローバル宣言
declare const GM_openInTab: (url: string, options?: { active?: boolean; insert?: boolean }) => void;
declare const GM_setClipboard: (text: string) => void;

// URL開くモードの型
export type UrlOpenMode = 'auto' | 'newtab' | 'same' | 'command';

// エントリ実行結果のインターフェース
export interface ExecuteResult {
  success: boolean;
  requiresInput?: boolean;
  message?: string;
  data?: any;
}

// 定数
const BING_SEARCH_URL = 'https://www.bing.com/search?q=';
const SEARCH_PLACEHOLDER_TEMPLATE = ' に検索キーワードを入力…';
const DEFAULT_MESSAGES = {
  EMPTY_QUERY: '検索キーワードを入力してください',
  URL_COPIED: 'URLをコピーしました',
  PAGE_ADDED: '現在のページを登録しました'
} as const;

/**
 * パレットのコアロジックを管理するクラス
 */
export class PaletteCore {
  private inputEl: HTMLInputElement | null = null;
  private settingsCache: any = null;
  private lastSettingsUpdate = 0;
  private readonly SETTINGS_CACHE_TTL = 1000; // 1秒キャッシュ

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
   * 設定をキャッシュから取得
   */
  private getCachedSettings = () => {
    const now = Date.now();
    if (this.settingsCache && (now - this.lastSettingsUpdate) < this.SETTINGS_CACHE_TTL) {
      return this.settingsCache;
    }
    
    this.settingsCache = getSettings();
    this.lastSettingsUpdate = now;
    return this.settingsCache;
  };

  /**
   * エントリを実行する
   */
  executeEntry(entry: SiteEntry, shiftPressed: boolean, query?: string): ExecuteResult {
    if (!entry) {
      return { success: false, message: '無効なエントリです' };
    }

    const settings = this.getCachedSettings();
    const preferNew = settings.enterOpens === 'newtab';
    const openNew = shiftPressed ? !preferNew : preferNew;

    // 検索エントリの場合はクエリを確認
    if (entry.url && entry.url.includes('%s')) {
      const searchQuery = query !== undefined ? query : this.inputEl?.value.trim() || '';
      if (!searchQuery) {
        this.updateInputPlaceholder(entry.name);
        this.inputEl?.focus();
        return {
          success: false,
          requiresInput: true,
          message: DEFAULT_MESSAGES.EMPTY_QUERY
        };
      }
      
      // 検索クエリの検証
      if (!validateInput(searchQuery, 200)) { // 検索クエリは最大200文字
        return {
          success: false,
          message: '検索キーワードが無効です'
        };
      }
      
      const targetUrl = entry.url.replace(/%s/g, encodeURIComponent(searchQuery));
      
      // 生成されたURLの妥当性を検証
      if (!isValidUrl(targetUrl)) {
        return {
          success: false,
          message: '無効なURLが生成されました'
        };
      }
      
      incrementUsage(entry.id);
      this.openUrlWithPreference(targetUrl, openNew ? 'newtab' : 'same');
      return { success: true };
    }

    // 通常のURLエントリ
    if (!isValidUrl(entry.url)) {
      return {
        success: false,
        message: '無効なURLです'
      };
    }
    
    incrementUsage(entry.id);
    this.openUrlWithPreference(entry.url, openNew ? 'newtab' : 'same');
    return { success: true };
  }

  /**
   * 入力フィールドのプレースホルダーを更新
   */
  private updateInputPlaceholder = (entryName: string): void => {
    if (this.inputEl) {
      this.inputEl.value = '';
      this.inputEl.placeholder = entryName + SEARCH_PLACEHOLDER_TEMPLATE;
    }
  };

  /**
   * Bing検索を実行する
   */
  runBingSearch(shiftPressed: boolean, entry?: SiteEntry, query?: string): ExecuteResult {
    const keywords = (query || this.inputEl?.value.trim() || '').trim();
    if (!keywords) {
      return {
        success: false,
        message: DEFAULT_MESSAGES.EMPTY_QUERY
      };
    }
    
    // 検索キーワードの検証
    if (!validateInput(keywords, 200)) { // 検索キーワードは最大200文字
      return {
        success: false,
        message: '検索キーワードが無効です'
      };
    }
    
    const mode = shiftPressed ? 'newtab' : 'auto';
    const searchUrl = `${BING_SEARCH_URL}${encodeURIComponent(keywords)}`;
    
    // エントリが指定されている場合は使用回数を増やす
    if (entry) {
      incrementUsage(entry.id);
    }
    
    this.openUrlWithPreference(searchUrl, mode);
    return { success: true };
  }

  /**
   * 入力からBing検索を実行する
   */
  runBingSearchFromInput(): ExecuteResult {
    const query = this.inputEl?.value.trim() || '';
    if (!query) {
      return {
        success: false,
        message: DEFAULT_MESSAGES.EMPTY_QUERY
      };
    }
    
    // 検索クエリの検証
    if (!validateInput(query, 200)) { // 検索クエリは最大200文字
      return {
        success: false,
        message: '検索キーワードが無効です'
      };
    }
    
    const searchUrl = `${BING_SEARCH_URL}${encodeURIComponent(query)}`;
    this.openUrlWithPreference(searchUrl);
    return { success: true };
  }

  /**
   * 設定に応じてURLを開く
   */
  openUrlWithPreference(url: string, mode: UrlOpenMode = 'auto'): void {
    const settings = this.getCachedSettings();
    const openNew = this.shouldOpenNewTab(mode, settings);
    
    if (openNew) {
      this.openUrlInNewTab(url);
    } else {
      this.openUrlInSameTab(url);
    }
  }

  /**
   * 新しいタブでURLを開くかどうかを判定
   */
  private shouldOpenNewTab = (mode: UrlOpenMode, settings: any): boolean => {
    switch (mode) {
      case 'newtab':
        return true;
      case 'same':
        return false;
      case 'command':
        return true;
      case 'auto':
      default:
        return settings.enterOpens === 'newtab';
    }
  };

  /**
   * 新しいタブでURLを開く
   */
  private openUrlInNewTab = (url: string): void => {
    try {
      GM_openInTab(url, { active: true, insert: true });
    } catch {
      // ポップアップブロック対策
      const newWindow = window.open(url, '_blank');
      if (!newWindow) {
        showToast('ポップアップがブロックされました。ブラウザの設定を確認してください。');
      }
    }
  };

  /**
   * 同じタブでURLを開く
   */
  private openUrlInSameTab = (url: string): void => {
    try {
      location.assign(url);
    } catch {
      location.href = url;
    }
  };

  /**
   * 現在のページ情報を取得
   */
  getCurrentPageInfo = (): { title: string; url: string } => {
    return {
      title: document.title || location.hostname,
      url: location.href
    };
  };

  /**
   * 現在のページを追加する
   */
  runAddCurrent(): ExecuteResult {
    const pageInfo = this.getCurrentPageInfo();
    
    // この処理はストレージモジュールに依存するため、ここでは実装しない
    // 呼び出し元で適切に処理する
    showToast(DEFAULT_MESSAGES.PAGE_ADDED);
    
    return {
      success: true,
      data: pageInfo
    };
  }

  /**
   * URLをコピーする（非同期対応）
   */
  async copyUrl(): Promise<ExecuteResult> {
    const url = location.href;
    
    try {
      GM_setClipboard(url);
      showToast(DEFAULT_MESSAGES.URL_COPIED);
      return { success: true };
    } catch {
      // フォールバックとしてClipboard APIを使用
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(url);
          showToast(DEFAULT_MESSAGES.URL_COPIED);
          return { success: true };
        } catch (clipboardError) {
          return { success: false, message: 'URLのコピーに失敗しました' };
        }
      }
      
      return { success: false, message: 'クリップボードAPIが利用できません' };
    }
  }

  /**
   * 設定キャッシュをクリア
   */
  clearSettingsCache = (): void => {
    this.settingsCache = null;
    this.lastSettingsUpdate = 0;
  };

  /**
   * 入力値を取得
   */
  getInputValue = (): string => {
    return this.inputEl?.value.trim() || '';
  };

  /**
   * 入力値を設定
   */
  setInputValue = (value: string): void => {
    if (this.inputEl) {
      this.inputEl.value = value;
    }
  };

  /**
   * 入力フィールドにフォーカス
   */
  focusInput = (): void => {
    this.inputEl?.focus();
  };
}
