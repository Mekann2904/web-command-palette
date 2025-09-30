import { DOMElements, AutocompleteState } from '@/core/state';
import { getAllTags, shouldShowTagSuggestions } from '@/utils/search';
import { escapeHtml } from '@/utils/string';

/**
 * オートコンプリートUIを管理するクラス
 */
export class Autocomplete {
  private dom: DOMElements;
  private state: AutocompleteState;
  private onRenderList: () => void;
  private onUpdateActive: () => void;

  constructor(dom: DOMElements, state: AutocompleteState, onRenderList: () => void, onUpdateActive: () => void) {
    this.dom = dom;
    this.state = state;
    this.onRenderList = onRenderList;
    this.onUpdateActive = onUpdateActive;
  }

  /**
   * オートコンプリートを構築
   */
  buildAutocomplete(): void {
    const container = document.createElement('div');
    container.className = 'autocomplete-container';
    container.style.position = 'relative';
    
    this.dom.autocompleteEl = document.createElement('div');
    this.dom.autocompleteEl.className = 'autocomplete-list';
    this.dom.autocompleteEl.style.display = 'none';
    
    // オートコンプリートのスタイルを追加
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
    
    // 元の入力欄をコンテナに移動
    if (this.dom.inputEl && this.dom.inputEl.parentNode) {
      this.dom.inputEl.parentNode.replaceChild(container, this.dom.inputEl);
      container.appendChild(this.dom.inputEl);
      container.appendChild(this.dom.autocompleteEl);
      
      // スタイルをルート要素に追加
      if (this.dom.root) {
        this.dom.root.appendChild(style);
      }
    }

    // オートコンプリートのイベントリスナーを追加
    this.dom.inputEl!.addEventListener('input', this.handleAutocompleteInput);
    this.dom.inputEl!.addEventListener('keydown', this.handleAutocompleteKeydown);
    
    // blur 時、実際に外へ出たときだけ閉じる
    this.dom.inputEl!.addEventListener('blur', (e) => {
      const to = e.relatedTarget as Node;
      const insideAuto = to && this.dom.autocompleteEl!.contains(to);
      setTimeout(() => {
        if (!insideAuto && !this.dom.autocompleteEl!.matches(':hover')) {
          this.hideAutocomplete();
        }
      }, 0);
    });

    // オートコンプリート内クリック時にフォーカスを奪われても閉じない
    this.dom.autocompleteEl!.addEventListener('mousedown', (e) => {
      e.preventDefault();        // 入力の blur を抑止
      this.dom.inputEl!.focus();  // フォーカスを戻す
    });
  }

  /**
   * オートコンプリート入力処理
   */
  handleAutocompleteInput = (): void => {
    const value = this.dom.inputEl!.value;
    
    setTimeout(() => {
      // タグ候補を表示すべきか判定
      if (shouldShowTagSuggestions(value)) {
        const hashIndex = value.indexOf('#');
        const afterHash = value.slice(hashIndex + 1);
        console.log('[CommandPalette] Autocomplete input - value:', value);
        console.log('[CommandPalette] Autocomplete input - afterHash:', afterHash);
        this.showAutocomplete(afterHash);
      } else {
        this.hideAutocomplete();
      }
    }, 10);
  };

  /**
   * オートコンプリートキーボード処理
   */
  handleAutocompleteKeydown = (e: KeyboardEvent): void => {
    if (!this.state.isVisible) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.state.index = (this.state.index + 1) % this.state.items.length;
      this.updateAutocompleteActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.state.index = (this.state.index - 1 + this.state.items.length) % this.state.items.length;
      this.updateAutocompleteActive();
    } else if (e.key === 'Enter' && this.state.index >= 0) {
      e.preventDefault();
      this.selectAutocompleteItem(this.state.items[this.state.index]);
    } else if (e.key === 'Escape') {
      this.hideAutocomplete();
    }
  };

  /**
   * オートコンプリートを表示
   */
  showAutocomplete(query: string): void {
    const entries = this.getEntries();
    console.log('[CommandPalette] Autocomplete - entries from storage:', entries);
    const allTags = getAllTags(entries);
    console.log('[CommandPalette] Autocomplete - allTags:', allTags);
    
    const tagCounts: Record<string, number> = {};
    entries.forEach(entry => {
      if (entry.tags) {
        entry.tags.forEach((tag: string) => {
          // タグを正規化してカウント
          const normalizedTag = tag.trim();
          if (normalizedTag) {
            tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1;
          }
        });
      }
    });
    
    let filteredTags = [];
    
    if (query.includes('/')) {
      const parts = query.split('/');
      const parentQuery = parts.slice(0, -1).join('/');
      const childQuery = parts[parts.length - 1];
      
      filteredTags = allTags.filter(tag => {
        if (tag.startsWith(parentQuery + '/')) {
          const childPart = tag.slice(parentQuery.length + 1);
          return childPart.toLowerCase().includes(childQuery.toLowerCase());
        }
        return false;
      });
    } else {
      filteredTags = allTags.filter(tag => {
        const tagLower = tag.toLowerCase();
        const queryLower = query.toLowerCase();
        
        console.log(`[CommandPalette] Filtering tag "${tag}" against query "${query}"`);
        
        // 完全一致
        if (tagLower === queryLower) {
          console.log(`[CommandPalette] Exact match: ${tag}`);
          return true;
        }
        
        // 階層タグの親タグで一致（例: "ai/deepseek" は "ai" で一致）
        const parts = tag.split('/');
        if (parts.some(part => part.toLowerCase() === queryLower)) {
          console.log(`[CommandPalette] Parent tag match: ${tag}`);
          return true;
        }
        
        // 部分一致（ただし階層タグの一部として既に一致している場合は重複を避ける）
        if (tagLower.includes(queryLower)) {
          console.log(`[CommandPalette] Partial match: ${tag}`);
          return true;
        }
        
        return false;
      });
    }
    
    filteredTags.sort((a, b) => {
      const aDepth = (a.match(/\//g) || []).length;
      const bDepth = (b.match(/\//g) || []).length;
      if (aDepth !== bDepth) return aDepth - bDepth;
      return a.localeCompare(b);
    });
    
    const filteredTagObjects = filteredTags.map(tag => {
      // 階層タグの場合、親タグと子タグの件数を合算
      let count = tagCounts[tag] || 0;
      
      // 親タグの場合、子タグの件数も合算
      if (!tag.includes('/')) {
        // 親タグの場合、その親タグで始まるすべての子タグの件数を合算
        Object.keys(tagCounts).forEach(childTag => {
          if (childTag.startsWith(tag + '/')) {
            count += tagCounts[childTag];
          }
        });
      }
      
      return {
        name: tag,
        count: count
      };
    });
    
    if (filteredTagObjects.length === 0) {
      this.state.items = [];
      this.state.index = -1;
      this.state.isVisible = true;
      
      this.dom.autocompleteEl!.innerHTML = '';
      
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
      this.dom.autocompleteEl!.appendChild(createItem);
      
      // デバッグ情報
      const debugItem = document.createElement('div');
      debugItem.className = 'autocomplete-item';
      debugItem.style.color = 'var(--muted)';
      debugItem.style.fontSize = '11px';
      debugItem.style.cursor = 'default';
      debugItem.innerHTML = `
        <div>デバッグ情報:</div>
        <div>・全タグ数: ${allTags.length}</div>
        <div>・検索クエリ: "${escapeHtml(query)}"</div>
        <div>・サイト数: ${entries.length}</div>
      `;
      debugItem.addEventListener('click', (e) => e.preventDefault());
      this.dom.autocompleteEl!.appendChild(debugItem);
      
      this.dom.autocompleteEl!.style.display = 'block';
      this.updateAutocompleteActive();
      return;
    }
    
    this.state.items = filteredTagObjects;
    this.state.index = 0;
    this.state.isVisible = true;
    
    this.dom.autocompleteEl!.innerHTML = '';
    filteredTagObjects.forEach((tag, index) => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.dataset.index = index.toString();
      
      const parts = tag.name.split('/');
      const depth = parts.length - 1;
      const displayName = parts.pop() || '';
      const parentPath = parts.join('/');
      
      // 階層関係を視覚的に表現
      let hierarchyDisplay = '';
      if (depth > 0) {
        // 親パスを表示
        hierarchyDisplay = `<span style="color: var(--muted); font-size: 11px;">${escapeHtml(parentPath)}/</span>`;
      }
      
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 4px; flex: 1;">
          <span style="margin-left: ${depth * 12}px; color: var(--muted); font-size: 12px;">${depth > 0 ? '└─' : ''}</span>
          <div style="display: flex; flex-direction: column; gap: 1px; flex: 1;">
            <div style="display: flex; align-items: center; gap: 4px;">
              ${hierarchyDisplay}
              <span class="autocomplete-tag" style="font-weight: ${depth > 0 ? '400' : '500'};">${escapeHtml(displayName)}</span>
            </div>
            ${depth > 0 ? `<div style="font-size: 10px; color: var(--muted); margin-left: ${depth * 12 + 16}px;">フルパス: ${escapeHtml(tag.name)}</div>` : ''}
          </div>
        </div>
        <span class="autocomplete-count">${tag.count}件</span>
      `;
      
      item.addEventListener('click', () => this.selectAutocompleteItem(tag));
      item.addEventListener('mouseenter', () => {
        this.state.index = index;
        this.updateAutocompleteActive();
      });
      
      this.dom.autocompleteEl!.appendChild(item);
    });
    
    this.dom.autocompleteEl!.style.display = 'block';
    this.updateAutocompleteActive();
  }

  /**
   * オートコンプリートを非表示
   */
  hideAutocomplete(): void {
    this.state.isVisible = false;
    this.state.index = -1;
    if (this.dom.autocompleteEl) {
      this.dom.autocompleteEl.style.display = 'none';
    }
  }

  /**
   * オートコンプリートアクティブ更新
   */
  updateAutocompleteActive(): void {
    if (!this.dom.autocompleteEl) return;
    const items = this.dom.autocompleteEl.querySelectorAll('.autocomplete-item');
    items.forEach((item, index) => {
      item.classList.toggle('active', index === this.state.index);
    });
  }

  /**
   * オートコンプリートアイテム選択
   */
  private selectAutocompleteItem(tag: any): void {
    const currentValue = this.dom.inputEl!.value;
    const hashIndex = currentValue.indexOf('#');
    
    if (hashIndex >= 0) {
      const beforeHash = currentValue.slice(0, hashIndex);
      this.dom.inputEl!.value = beforeHash + '#' + tag.name;
    } else {
      this.dom.inputEl!.value = '#' + tag.name;
    }
    
    this.hideAutocomplete();
    this.dom.inputEl!.focus();
    
    // 入力後にスペースを追加して検索できるようにする
    setTimeout(() => {
      this.dom.inputEl!.value += ' ';
      // アクティブインデックスをリセットして再レンダリング
      this.onRenderList();
      this.onUpdateActive();
    }, 0);
  }

  /**
   * 新規タグを作成
   */
  private createNewTag(tagName: string): void {
    const currentValue = this.dom.inputEl!.value;
    const hashIndex = currentValue.indexOf('#');
    
    if (hashIndex >= 0) {
      const beforeHash = currentValue.slice(0, hashIndex);
      this.dom.inputEl!.value = beforeHash + '#' + tagName;
    } else {
      this.dom.inputEl!.value = '#' + tagName;
    }
    
    this.hideAutocomplete();
    this.dom.inputEl!.focus();
    
    // 入力後にスペースを追加して検索できるようにする
    setTimeout(() => {
      this.dom.inputEl!.value += ' ';
      // アクティブインデックスをリセットして再レンダリング
      this.onRenderList();
      this.onUpdateActive();
    }, 0);
  }

  /**
   * エントリを取得する（正規化済み）
   */
  private getEntries(): any[] {
    try {
      const getSites = require('@/core/storage').getSites;
      return getSites();
    } catch {
      return [];
    }
  }
}
