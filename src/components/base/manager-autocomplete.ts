import { DOMElements } from '@/core/state';
import { getSites } from '@/core/storage';
import { getAllTags } from '@/utils/search';
import { escapeHtml } from '@/utils/string';
import { addBlurListener } from '@/utils/events';
import { setBlurCheckTimeout } from '@/utils/timing';
import { sortTagsByHierarchy, countTagUsage, filterTags, createTagSuggestions, TagSuggestion } from '@/utils/tag-sort';
import { BaseAutocomplete, AutocompleteItem, BaseAutocompleteState } from './base-autocomplete';

/**
 * マネージャー用の拡張オートコンプリートアイテムインターフェース
 */
interface ManagerAutocompleteItem extends AutocompleteItem {
  isNew?: boolean;
}

/**
 * マネージャーオートコンプリートの状態インターフェース
 */
interface ManagerAutocompleteState extends BaseAutocompleteState {
  items: TagSuggestion[];
}

/**
 * サイトマネージャのタグ入力フィールド用オートコンプリート機能を管理するクラス
 * BaseAutocompleteを継承し、マネージャー固有の機能を実装
 */
export class ManagerAutocomplete extends BaseAutocomplete {
  private onTagSelect: (tag: string) => void;

  constructor(dom: DOMElements, tagInput: HTMLInputElement, onTagSelect: (tag: string) => void) {
    super(dom, tagInput, (item: TagSuggestion) => {
      this.selectTag(item.name);
    }, 'tag-autocomplete');
    
    this.onTagSelect = onTagSelect;
  }

  /**
   * スタイルを追加する
   */
  protected addStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .tag-autocomplete-container {
        position: relative;
        width: 100%;
      }
      .tag-autocomplete-list {
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
        scrollbar-width: none;
        min-width: 300px;
        width: max-content;
        max-width: 500px;
      }
      .tag-autocomplete-list::-webkit-scrollbar {
        width: 0;
        height: 0;
      }
      .tag-autocomplete-item {
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-items: flex-start;
        gap: 8px;
        transition: background 0.12s ease, transform 0.12s ease;
        min-height: 40px;
        white-space: nowrap;
      }
      .tag-autocomplete-item:first-child {
        border-radius: 8px 8px 0 0;
      }
      .tag-autocomplete-item:last-child {
        border-bottom: none;
        border-radius: 0 0 8px 8px;
      }
      .tag-autocomplete-item:hover,
      .tag-autocomplete-item.active {
        background: var(--item-active);
        transform: translateX(2px);
      }
      .tag-autocomplete-tag {
        flex: 1;
        color: var(--panel-text);
        display: flex;
        align-items: flex-start;
        gap: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
      }
      .tag-autocomplete-count {
        font-size: 12px;
        color: var(--muted);
        background: var(--hint-bg);
        padding: 2px 6px;
        border-radius: 4px;
        flex-shrink: 0;
        white-space: nowrap;
      }
      .tag-autocomplete-new {
        color: var(--accent-color);
        font-style: italic;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
      }
      .tag-autocomplete-debug {
        font-size: 11px;
        color: var(--muted);
        cursor: default;
        white-space: normal;
        word-break: break-word;
      }
    `;
    
    if (this.dom.root) {
      this.dom.root.appendChild(style);
    }
  }

  /**
   * イベントリスナーを設定する
   */
  protected setupEventListeners(): void {
    super.setupEventListeners();
    
    // フォーカスイベントを追加
    addBlurListener(this.inputElement, this.handleBlur);
  }

  /**
   * クエリを抽出する
   */
  protected extractQuery(value: string): string {
    // カンマ区切りの最後の単語を取得
    const tags = value.split(/[,\s]+/).filter(Boolean);
    return tags[tags.length - 1] || '';
  }

  /**
   * 候補を表示すべきか判定する
   */
  protected shouldShowSuggestions(query: string): boolean {
    return query.length > 0;
  }

  /**
   * アイテムをフィルタリングする
   */
  protected filterItems(query: string): ManagerAutocompleteItem[] {
    const entries = getSites();
    const allTags = getAllTags(entries);
    
    // タグの使用回数をカウント
    const tagCounts = countTagUsage(entries);
    
    // クエリに基づいてタグをフィルタリング
    let filteredTags = filterTags(allTags, query);
    
    // 階層の浅い順、アルファベット順にソート
    filteredTags = sortTagsByHierarchy(filteredTags);
    
    // タグ候補オブジェクトに変換
    const filteredTagObjects = createTagSuggestions(filteredTags, tagCounts);
    
    // 新規タグ作成を提案
    const showNewTagOption = !filteredTagObjects.some(item => item.name.toLowerCase() === query.toLowerCase());
    
    const result: ManagerAutocompleteItem[] = [...filteredTagObjects];
    
    if (showNewTagOption) {
      result.push({
        name: query,
        count: 0,
        depth: 0,
        parentPath: undefined,
        isNew: true
      });
    }
    
    return result;
  }

  /**
   * アイテムをレンダリングする
   */
  protected renderItems(items: ManagerAutocompleteItem[]): void {
    this.listElement.innerHTML = '';
    
    items.forEach((tag, index) => {
      const item = this.createItemElement(tag, index);
      this.listElement.appendChild(item);
    });
  }

  /**
   * アイテムの内容を生成する
   */
  protected generateItemContent(item: ManagerAutocompleteItem): string {
    const isNewTag = item.isNew || item.count === 0;
    
    if (isNewTag) {
      // 新規タグ作成オプション
      return `
        <div style="display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0;">
          <span class="tag-autocomplete-tag tag-autocomplete-new" style="overflow: hidden; text-overflow: ellipsis;">➕ 新規タグを作成: "${escapeHtml(item.name)}"</span>
          <div style="font-size: 10px; color: var(--muted);">Enterで作成して続行</div>
        </div>
      `;
    } else {
      // 既存タグ
      const parts = item.name.split('/');
      const displayName = parts.pop() || '';
      
      // 階層関係を視覚的に表現
      let hierarchyDisplay = '';
      if (item.depth && item.depth > 0 && item.parentPath) {
        hierarchyDisplay = `<span style="color: var(--muted); font-size: 11px;">${escapeHtml(item.parentPath)}/</span>`;
      }
      
      return `
        <div style="display: flex; align-items: flex-start; gap: 4px; flex: 1; min-width: 0;">
          <span style="margin-left: ${(item.depth || 0) * 12}px; color: var(--muted); font-size: 12px; flex-shrink: 0; margin-top: 2px;">${(item.depth || 0) > 0 ? '└─' : ''}</span>
          <div style="display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 4px; min-width: 0;">
              ${hierarchyDisplay}
              <span class="tag-autocomplete-tag" style="font-weight: ${(item.depth || 0) > 0 ? '400' : '500'}; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(displayName)}</span>
            </div>
            ${(item.depth || 0) > 0 ? `<div style="font-size: 10px; color: var(--muted); margin-left: ${(item.depth || 0) * 12 + 16}px; overflow: hidden; text-overflow: ellipsis;">フルパス: ${escapeHtml(item.name)}</div>` : ''}
          </div>
        </div>
        <span class="tag-autocomplete-count">${item.count}件</span>
      `;
    }
  }

  /**
   * 空の結果を処理する
   */
  protected handleEmptyResults(query: string): void {
    // 新規タグ作成オプションを常に表示
    const newItem: ManagerAutocompleteItem = {
      name: query,
      count: 0,
      depth: 0,
      parentPath: undefined,
      isNew: true
    };
    
    this.state.items = [newItem];
    this.state.index = 0;
    this.state.isVisible = true;
    
    this.renderItems([newItem]);
    this.listElement.style.display = 'block';
    this.updateActive();
  }

  /**
   * フォーカスイベントを処理する
   */
  private handleBlur = (e: FocusEvent): void => {
    const to = e.relatedTarget as Node;
    const insideAuto = to && this.listElement.contains(to);
    setBlurCheckTimeout(() => {
      if (!insideAuto && !this.listElement.matches(':hover')) {
        this.hide();
      }
    });
  };

  /**
   * タグを選択する
   */
  private selectTag(tag: string): void {
    const currentValue = this.inputElement.value;
    const tags = currentValue.split(/[,\s]+/).filter(Boolean);
    
    // 最後のタグを置換
    if (tags.length > 0) {
      tags[tags.length - 1] = tag;
    } else {
      tags.push(tag);
    }
    
    // 入力欄を更新
    this.inputElement.value = tags.join(', ') + ', ';
    
    this.hide();
    this.inputElement.focus();
    
    // コールバックを実行
    this.onTagSelect(tag);
  }
}