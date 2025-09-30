import { SearchHistory, SearchHistoryEntry } from '@/core/history';
import { DOMElements } from '@/core/state';
import { escapeHtml } from '@/utils/string';
import { SiteEntry } from '@/types';

/**
 * 検索候補UIを管理するクラス
 */
export class SearchSuggestions {
  private dom: DOMElements;
  private history: SearchHistory;
  private isVisible: boolean = false;
  private selectedIndex: number = -1;
  private suggestions: string[] = [];
  private onSelectSuggestion: (suggestion: string) => void;

  constructor(dom: DOMElements, onSelectSuggestion: (suggestion: string) => void) {
    this.dom = dom;
    this.history = new SearchHistory();
    this.onSelectSuggestion = onSelectSuggestion;
  }

  /**
   * 検索候補UIを構築
   */
  buildSuggestionsUI(): void {
    if (this.dom.suggestionsEl) return;

    this.dom.suggestionsEl = document.createElement('div');
    this.dom.suggestionsEl.className = 'search-suggestions';
    this.dom.suggestionsEl.style.display = 'none';

    // スタイルを追加
    const style = document.createElement('style');
    style.textContent = `
      .search-suggestions {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--panel-bg);
        border: 1px solid var(--border-color);
        border-top: none;
        border-radius: 0 0 8px 8px;
        max-height: 200px;
        overflow-y: auto;
        z-index: 2147483647;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
      .suggestion-item {
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        gap: 8px;
        transition: background 0.12s ease;
      }
      .suggestion-item:last-child {
        border-bottom: none;
      }
      .suggestion-item:hover,
      .suggestion-item.active {
        background: var(--item-active);
      }
      .suggestion-text {
        flex: 1;
        color: var(--panel-text);
      }
      .suggestion-meta {
        font-size: 12px;
        color: var(--muted);
      }
      .suggestion-history {
        opacity: 0.7;
        font-size: 11px;
      }
      .suggestion-clear {
        padding: 4px 8px;
        font-size: 12px;
        color: var(--muted);
        cursor: pointer;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        transition: all 0.12s ease;
      }
      .suggestion-clear:hover {
        background: var(--item-active);
        color: var(--panel-text);
      }
    `;

    if (this.dom.root) {
      this.dom.root.appendChild(style);
      this.dom.root.appendChild(this.dom.suggestionsEl);
    }
  }

  /**
   * 検索候補を表示
   */
  showSuggestions(query: string): void {
    if (!this.dom.suggestionsEl) {
      this.buildSuggestionsUI();
    }

    // 入力が空の場合は最近の検索を表示
    if (!query.trim()) {
      this.suggestions = this.history.getRecentSuggestions(8);
    } else {
      // 入力に基づいて履歴を検索
      const historyEntries = this.history.searchHistory(query);
      this.suggestions = historyEntries.map(entry => entry.query);
      
      // 完全一致がない場合は入力自体を候補に追加
      if (!this.suggestions.includes(query.trim())) {
        this.suggestions.unshift(query.trim());
      }
    }

    if (this.suggestions.length === 0) {
      this.hideSuggestions();
      return;
    }

    this.isVisible = true;
    this.selectedIndex = -1;
    this.renderSuggestions();
    if (this.dom.suggestionsEl) {
      this.dom.suggestionsEl.style.display = 'block';
    }
  }

  /**
   * 検索候補を非表示
   */
  hideSuggestions(): void {
    this.isVisible = false;
    this.selectedIndex = -1;
    if (this.dom.suggestionsEl) {
      this.dom.suggestionsEl.style.display = 'none';
    }
  }

  /**
   * 検索候補をレンダリング
   */
  private renderSuggestions(): void {
    if (!this.dom.suggestionsEl) return;

    this.dom.suggestionsEl.innerHTML = '';

    // 履歴クリアボタンを追加
    if (this.history.getHistory().length > 0) {
      const clearItem = document.createElement('div');
      clearItem.className = 'suggestion-item';
      clearItem.innerHTML = `
        <span class="suggestion-text">検索履歴をクリア</span>
        <span class="suggestion-meta">${this.history.getHistory().length}件</span>
      `;
      clearItem.addEventListener('click', () => {
        this.history.clearHistory();
        this.hideSuggestions();
      });
      clearItem.addEventListener('mouseenter', () => {
        this.selectedIndex = -1;
        this.updateActive();
      });
      this.dom.suggestionsEl.appendChild(clearItem);

      // 区切り線
      const separator = document.createElement('div');
      separator.style.cssText = 'height: 1px; background: var(--border-color); margin: 4px 0;';
      this.dom.suggestionsEl.appendChild(separator);
    }

    this.suggestions.forEach((suggestion, index) => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.dataset.index = index.toString();
      
      // 履歴からのものかどうかを判定
      const isFromHistory = this.history.getHistory().some(h => h.query === suggestion);
      
      item.innerHTML = `
        <span class="suggestion-text">${escapeHtml(suggestion)}</span>
        ${isFromHistory ? '<span class="suggestion-history">履歴</span>' : ''}
      `;

      item.addEventListener('click', () => {
        this.selectSuggestion(suggestion);
      });

      item.addEventListener('mouseenter', () => {
        this.selectedIndex = index;
        this.updateActive();
      });

      if (this.dom.suggestionsEl) {
        this.dom.suggestionsEl.appendChild(item);
      }
    });
  }

  /**
   * アクティブな候補を更新
   */
  private updateActive(): void {
    if (!this.dom.suggestionsEl) return;

    const items = this.dom.suggestionsEl.querySelectorAll('.suggestion-item');
    items.forEach((item, index) => {
      // クリアボタンは除外
      if (item.textContent.includes('検索履歴をクリア')) return;
      
      item.classList.toggle('active', index === this.selectedIndex);
    });
  }

  /**
   * 候補を選択
   */
  selectSuggestion(suggestion: string): void {
    this.hideSuggestions();
    this.onSelectSuggestion(suggestion);
  }

  /**
   * キーボードイベント処理
   */
  handleKeydown(e: KeyboardEvent): boolean {
    if (!this.isVisible) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.suggestions.length - 1);
      this.updateActive();
      return true;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
      this.updateActive();
      return true;
    } else if (e.key === 'Enter' && this.selectedIndex >= 0) {
      e.preventDefault();
      this.selectSuggestion(this.suggestions[this.selectedIndex]);
      return true;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.hideSuggestions();
      return true;
    }

    return false;
  }

  /**
   * 検索を履歴に追加
   */
  addToHistory(query: string, selectedEntry?: SiteEntry): void {
    this.history.addSearch(query, selectedEntry);
  }

  /**
   * 表示状態を取得
   */
  getIsVisible(): boolean {
    return this.isVisible;
  }
}
