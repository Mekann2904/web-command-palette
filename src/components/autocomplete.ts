import { DOMElements, AutocompleteState } from '@/core/state';
import { getAllTags } from '@/utils/search';
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
    
    // 元の入力欄をコンテナに移動
    if (this.dom.inputEl && this.dom.inputEl.parentNode) {
      this.dom.inputEl.parentNode.replaceChild(container, this.dom.inputEl);
      container.appendChild(this.dom.inputEl);
      container.appendChild(this.dom.autocompleteEl);
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
      if (value.includes('#')) {
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
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
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
        // 完全一致または部分一致
        const tagLower = tag.toLowerCase();
        const queryLower = query.toLowerCase();
        
        console.log(`[CommandPalette] Filtering tag "${tag}" against query "${query}"`);
        
        // 完全一致
        if (tagLower === queryLower) {
          console.log(`[CommandPalette] Exact match: ${tag}`);
          return true;
        }
        
        // 部分一致
        if (tagLower.includes(queryLower)) {
          console.log(`[CommandPalette] Partial match: ${tag}`);
          return true;
        }
        
        // 階層タグの親タグで一致（例: "ai/deepseek" は "ai" で一致）
        const parts = tag.split('/');
        if (parts.some(part => part.toLowerCase().includes(queryLower))) {
          console.log(`[CommandPalette] Parent tag match: ${tag}`);
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
    
    const filteredTagObjects = filteredTags.map(tag => ({
      name: tag,
      count: tagCounts[tag] || 0
    }));
    
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
      
      const depth = (tag.name.match(/\//g) || []).length;
      const displayName = tag.name.split('/').pop();
      const fullPath = tag.name;
      
      item.innerHTML = `
        <span class="autocomplete-tag" style="margin-left: ${depth * 8}px">${escapeHtml(displayName || '')}</span>
        <span class="autocomplete-count">${tag.count}件</span>
        <div style="font-size: 10px; color: var(--muted); margin-top: 2px;">${escapeHtml(fullPath)}</div>
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
    
    // アクティブインデックスをリセットして再レンダリング
    this.onRenderList();
    this.onUpdateActive();
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
    
    // アクティブインデックスをリセットして再レンダリング
    this.onRenderList();
    this.onUpdateActive();
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
