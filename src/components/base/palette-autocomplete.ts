import { DOMElements, AutocompleteState } from '@/core/state';
import { getAllTags, shouldShowTagSuggestions } from '@/utils/search';
import { escapeHtml } from '@/utils/string';
import { sortTagsByHierarchy, countTagUsage, filterHierarchicalTags, createTagSuggestions, TagSuggestion } from '@/utils/tag-sort';
import { BaseAutocomplete, AutocompleteItem, BaseAutocompleteState } from './base-autocomplete';

/**
 * パレット用オートコンプリートクラス
 * BaseAutocompleteを継承し、タグフィルタ機能を実装
 */
export class PaletteAutocomplete extends BaseAutocomplete {
  private onRenderList: () => void;
  private onUpdateActive: () => void;

  constructor(
    dom: DOMElements, 
    state: AutocompleteState, 
    onRenderList: () => void, 
    onUpdateActive: () => void
  ) {
    super(dom, dom.inputEl!, (item: TagSuggestion) => {
      this.selectTag(item);
    }, 'autocomplete');
    
    this.onRenderList = onRenderList;
    this.onUpdateActive = onUpdateActive;
  }

  /**
   * スタイルを追加する
   */
  protected addStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .autocomplete-container {
        position: relative;
        width: 100%;
      }
      .autocomplete-list {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--autocomplete-bg);
        border: 1px solid var(--autocomplete-border);
        border-top: none;
        border-radius: 0 0 8px 8px;
        max-height: 200px;
        overflow-y: auto;
        z-index: 2147483647;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        scrollbar-width: none;
      }
      .autocomplete-list::-webkit-scrollbar {
        width: 0;
        height: 0;
      }
      .autocomplete-item {
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
        border-bottom: 1px solid var(--autocomplete-border);
        display: flex;
        align-items: center;
        gap: 8px;
        transition: background 0.12s ease, transform 0.12s ease;
      }
      .autocomplete-item:first-child {
        border-radius: 8px 8px 0 0;
      }
      .autocomplete-item:last-child {
        border-bottom: none;
        border-radius: 0 0 8px 8px;
      }
      .autocomplete-item:hover,
      .autocomplete-item.active {
        background: var(--item-active);
        transform: translateX(2px);
      }
      .autocomplete-tag {
        flex: 1;
        color: var(--panel-text);
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .autocomplete-count {
        font-size: 12px;
        color: var(--muted);
        background: var(--hint-bg);
        padding: 2px 6px;
        border-radius: 4px;
      }
    `;
    
    if (this.dom.root) {
      this.dom.root.appendChild(style);
    }
  }

  /**
   * クエリを抽出する
   */
  protected extractQuery(value: string): string {
    const hashIndex = value.indexOf('#');
    return hashIndex >= 0 ? value.slice(hashIndex + 1) : '';
  }

  /**
   * 候補を表示すべきか判定する
   */
  protected shouldShowSuggestions(query: string): boolean {
    return shouldShowTagSuggestions(this.inputElement.value);
  }

  /**
   * アイテムをフィルタリングする
   */
  protected filterItems(query: string): TagSuggestion[] {
    const entries = this.getEntries();
    const allTags = getAllTags(entries);
    
    // タグの使用回数をカウント
    const tagCounts = countTagUsage(entries);
    
    // タグをフィルタリング
    let filteredTags = filterHierarchicalTags(allTags, query);
    
    // 階層の浅い順、アルファベット順にソート
    filteredTags = sortTagsByHierarchy(filteredTags);
    
    // タグ候補オブジェクトに変換
    return createTagSuggestions(filteredTags, tagCounts);
  }

  /**
   * アイテムをレンダリングする
   */
  protected renderItems(items: TagSuggestion[]): void {
    this.listElement.innerHTML = '';
    
    items.forEach((tag, index) => {
      const item = this.createItemElement(tag, index);
      this.listElement.appendChild(item);
    });
  }

  /**
   * アイテムの内容を生成する
   */
  protected generateItemContent(item: TagSuggestion): string {
    const parts = item.name.split('/');
    const depth = parts.length - 1;
    const displayName = parts.pop() || '';
    const parentPath = parts.join('/');
    
    // 階層関係を視覚的に表現
    let hierarchyDisplay = '';
    if (depth > 0) {
      // 親パスを表示
      hierarchyDisplay = `<span style="color: var(--muted); font-size: 11px;">${escapeHtml(parentPath)}/</span>`;
    }
    
    return `
      <div style="display: flex; align-items: center; gap: 4px; flex: 1;">
        <span style="margin-left: ${depth * 12}px; color: var(--muted); font-size: 12px;">${depth > 0 ? '└─' : ''}</span>
        <div style="display: flex; flex-direction: column; gap: 1px; flex: 1;">
          <div style="display: flex; align-items: center; gap: 4px;">
            ${hierarchyDisplay}
            <span class="autocomplete-tag" style="font-weight: ${depth > 0 ? '400' : '500'};">${escapeHtml(displayName)}</span>
          </div>
          ${depth > 0 ? `<div style="font-size: 10px; color: var(--muted); margin-left: ${depth * 12 + 16}px;">フルパス: ${escapeHtml(item.name)}</div>` : ''}
        </div>
      </div>
      <span class="autocomplete-count">${item.count}件</span>
    `;
  }

  /**
   * 空の結果を処理する
   */
  protected handleEmptyResults(query: string): void {
    this.state.items = [];
    this.state.index = -1;
    this.state.isVisible = true;
    
    this.listElement.innerHTML = '';
    
    // 新規タグ作成を提案
    const createItem = document.createElement('div');
    createItem.className = 'autocomplete-item';
    createItem.style.cursor = 'pointer';
    createItem.innerHTML = `
      <span class="autocomplete-tag" style="color: var(--accent-color);">➕ 新規タグを作成: "${escapeHtml(query)}"</span>
      <div style="font-size: 10px; color: var(--muted); margin-top: 2px;">Enterで作成して続行</div>
    `;
    createItem.addEventListener('click', () => {
      this.createNewTag(query);
    });
    this.listElement.appendChild(createItem);
    
    // デバッグ情報
    const debugItem = document.createElement('div');
    debugItem.className = 'autocomplete-item';
    debugItem.style.color = 'var(--muted)';
    debugItem.style.fontSize = '11px';
    debugItem.style.cursor = 'default';
    debugItem.innerHTML = `
      <div>デバッグ情報:</div>
      <div>・全タグ数: ${this.getAllTagsCount()}</div>
      <div>・検索クエリ: "${escapeHtml(query)}"</div>
      <div>・サイト数: ${this.getEntries().length}</div>
    `;
    debugItem.addEventListener('click', (e) => e.preventDefault());
    this.listElement.appendChild(debugItem);
    
    this.listElement.style.display = 'block';
    this.updateActive();
  }

  /**
   * タグを選択する
   */
  private selectTag(tag: TagSuggestion): void {
    const currentValue = this.inputElement.value;
    const hashIndex = currentValue.indexOf('#');
    
    if (hashIndex >= 0) {
      const beforeHash = currentValue.slice(0, hashIndex);
      this.updateInputValue(beforeHash + '#' + tag.name);
    } else {
      this.updateInputValue('#' + tag.name);
    }
    
    // レンダリングとアクティブ更新
    this.onRenderList();
    this.onUpdateActive();
  }

  /**
   * 新規タグを作成する
   */
  private createNewTag(tagName: string): void {
    const currentValue = this.inputElement.value;
    const hashIndex = currentValue.indexOf('#');
    
    if (hashIndex >= 0) {
      const beforeHash = currentValue.slice(0, hashIndex);
      this.updateInputValue(beforeHash + '#' + tagName);
    } else {
      this.updateInputValue('#' + tagName);
    }
    
    // レンダリングとアクティブ更新
    this.onRenderList();
    this.onUpdateActive();
  }

  /**
   * エントリを取得する
   */
  private getEntries(): any[] {
    try {
      const getSites = require('@/core/storage').getSites;
      return getSites();
    } catch {
      return [];
    }
  }

  /**
   * 全タグ数を取得する
   */
  private getAllTagsCount(): number {
    const entries = this.getEntries();
    return getAllTags(entries).length;
  }
}