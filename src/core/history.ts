import { SiteEntry } from '@/types';

// GM_* APIのグローバル宣言
declare const GM_getValue: <T>(key: string, defaultValue?: T) => T;
declare const GM_setValue: (key: string, value: any) => void;

const SEARCH_HISTORY_KEY = 'vm_sites_palette__search_history_v1';
const MAX_HISTORY_ITEMS = 50;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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
  private queryIndex: Map<string, number> = new Map(); // クエリからインデックスへのマップ for O(1) lookup
  private isDirty: boolean = false; // 変更フラグ
  private saveTimeout: number | null = null; // デバウンス用タイマー

  constructor() {
    this.loadHistory();
  }

  /**
   * 検索履歴を追加
   */
  addSearch(query: string, selectedEntry?: SiteEntry): void {
    if (!query || !query.trim()) return;

    const trimmedQuery = query.trim();
    const entry: SearchHistoryEntry = {
      query: trimmedQuery,
      timestamp: Date.now(),
      selectedEntry
    };

    // 既存のエントリを検索して削除
    const existingIndex = this.queryIndex.get(trimmedQuery);
    if (existingIndex !== undefined) {
      this.history.splice(existingIndex, 1);
      // インデックスを更新
      this.updateIndexAfterRemoval(existingIndex);
    }

    // 先頭に追加
    this.history.unshift(entry);
    this.queryIndex.set(trimmedQuery, 0);

    // 最大件数を制限
    if (this.history.length > MAX_HISTORY_ITEMS) {
      const removed = this.history.pop();
      if (removed) {
        this.queryIndex.delete(removed.query);
      }
    }

    // インデックスを再構築
    this.rebuildIndex();
    this.markDirty();
    this.scheduleSave();
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
      .slice(0, Math.min(limit, this.history.length))
      .map(entry => entry.query);
  }

  /**
   * 検索履歴をクリア
   */
  clearHistory(): void {
    this.history = [];
    this.queryIndex.clear();
    this.markDirty();
    this.saveHistory();
  }

  /**
   * 検索履歴を読み込む
   */
  private loadHistory(): void {
    try {
      const saved = GM_getValue<SearchHistoryEntry[]>(SEARCH_HISTORY_KEY, []);
      this.history = Array.isArray(saved) ? saved : [];
      this.rebuildIndex();
    } catch {
      this.history = [];
      this.queryIndex.clear();
    }
  }

  /**
   * 検索履歴を保存
   */
  private saveHistory(): void {
    if (!this.isDirty) return;
    
    try {
      GM_setValue(SEARCH_HISTORY_KEY, this.history);
      this.isDirty = false;
    } catch {
      console.error('[CommandPalette] Failed to save search history');
    }
  }

  /**
   * 変更フラグを設定
   */
  private markDirty(): void {
    this.isDirty = true;
  }

  /**
   * 保存をスケジュール（デバウンス）
   */
  private scheduleSave(): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = window.setTimeout(() => {
      this.saveHistory();
      this.saveTimeout = null;
    }, 500); // 500msデバウンス
  }

  /**
   * インデックスを再構築
   */
  private rebuildIndex(): void {
    this.queryIndex.clear();
    this.history.forEach((entry, index) => {
      this.queryIndex.set(entry.query, index);
    });
  }

  /**
   * 削除後のインデックスを更新
   */
  private updateIndexAfterRemoval(removedIndex: number): void {
    for (let i = removedIndex + 1; i < this.history.length; i++) {
      this.queryIndex.set(this.history[i].query, i - 1);
    }
  }

  /**
   * 古い履歴をクリーンアップ（30日以上前）
   */
  cleanupOldHistory(): void {
    const cutoffTime = Date.now() - THIRTY_DAYS_MS;
    const originalLength = this.history.length;
    
    this.history = this.history.filter(entry =>
      entry.timestamp > cutoffTime
    );

    if (this.history.length !== originalLength) {
      this.rebuildIndex();
      this.markDirty();
      this.scheduleSave();
    }
  }

  /**
   * 破棄時にタイマーをクリーンアップ
   */
  dispose(): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.saveHistory(); // 保存されていない変更があれば保存
  }
}
