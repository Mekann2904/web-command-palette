import { SiteEntry } from '@/types';

// GM_* APIのグローバル宣言
declare const GM_getValue: <T>(key: string, defaultValue?: T) => T;
declare const GM_setValue: (key: string, value: any) => void;

const SEARCH_HISTORY_KEY = 'vm_sites_palette__search_history_v1';
const MAX_HISTORY_ITEMS = 50;

/**
 * 検索履歴エントリ
 */
export interface SearchHistoryEntry {
  query: string;
  timestamp: number;
  selectedEntry?: SiteEntry;
}

/**
 * 検索履歴を管理するクラス
 */
export class SearchHistory {
  private history: SearchHistoryEntry[] = [];

  constructor() {
    this.loadHistory();
  }

  /**
   * 検索履歴を追加
   */
  addSearch(query: string, selectedEntry?: SiteEntry): void {
    if (!query || !query.trim()) return;

    const entry: SearchHistoryEntry = {
      query: query.trim(),
      timestamp: Date.now(),
      selectedEntry
    };

    // 重複を削除して先頭に追加
    this.history = this.history.filter(h => h.query !== entry.query);
    this.history.unshift(entry);

    // 最大件数を制限
    if (this.history.length > MAX_HISTORY_ITEMS) {
      this.history = this.history.slice(0, MAX_HISTORY_ITEMS);
    }

    this.saveHistory();
  }

  /**
   * 検索履歴を取得
   */
  getHistory(): SearchHistoryEntry[] {
    return [...this.history];
  }

  /**
   * クエリで検索履歴を検索
   */
  searchHistory(query: string): SearchHistoryEntry[] {
    if (!query) return this.getHistory();
    
    const normalizedQuery = query.toLowerCase().trim();
    return this.history.filter(entry => 
      entry.query.toLowerCase().includes(normalizedQuery)
    );
  }

  /**
   * 最近の検索候補を取得
   */
  getRecentSuggestions(limit: number = 5): string[] {
    return this.history
      .slice(0, limit)
      .map(entry => entry.query);
  }

  /**
   * 検索履歴をクリア
   */
  clearHistory(): void {
    this.history = [];
    this.saveHistory();
  }

  /**
   * 検索履歴を読み込む
   */
  private loadHistory(): void {
    try {
      const saved = GM_getValue<SearchHistoryEntry[]>(SEARCH_HISTORY_KEY, []);
      this.history = Array.isArray(saved) ? saved : [];
    } catch {
      this.history = [];
    }
  }

  /**
   * 検索履歴を保存
   */
  private saveHistory(): void {
    try {
      GM_setValue(SEARCH_HISTORY_KEY, this.history);
    } catch {
      console.error('[CommandPalette] Failed to save search history');
    }
  }

  /**
   * 古い履歴をクリーンアップ（30日以上前）
   */
  cleanupOldHistory(): void {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const originalLength = this.history.length;
    
    this.history = this.history.filter(entry => 
      entry.timestamp > thirtyDaysAgo
    );

    if (this.history.length !== originalLength) {
      this.saveHistory();
    }
  }
}
