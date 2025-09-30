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
    this.dom.inputEl!.addEventListener('blur', () => {
      setTimeout(() => this.hideAutocomplete(), 300);
    });

    this.dom.autocompleteEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
  }

  /**
   * オートコンプリート入力処理
   */
  handleAutocompleteInput = (): void => {
    const value = this.dom.inputEl!.value;
    
    setTimeout(() => {
      if (value.includes(' ')) {
        this.hideAutocomplete();
        return;
      }
      
      if (value.includes('#')) {
        const afterHash = value.slice(value.indexOf('#') + 1);
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
    const allTags = getAllTags();
    const entries = this.getEntries();
    
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
      filteredTags = allTags.filter(tag => 
        tag.toLowerCase().includes(query.toLowerCase())
      );
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
      const emptyItem = document.createElement('div');
      emptyItem.className = 'autocomplete-item';
      emptyItem.textContent = '該当するタグがありません';
      emptyItem.style.color = 'var(--muted)';
      emptyItem.style.cursor = 'default';
      emptyItem.addEventListener('click', (e) => e.preventDefault());
      this.dom.autocompleteEl!.appendChild(emptyItem);
      
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
      this.dom.inputEl!.value = beforeHash + '#' + tag.name + ' ';
    } else {
      this.dom.inputEl!.value = '#' + tag.name + ' ';
    }
    
    this.hideAutocomplete();
    this.dom.inputEl!.focus();
    
    // アクティブインデックスをリセットして再レンダリング
    this.onRenderList();
    this.onUpdateActive();
  }

  /**
   * エントリを取得する（暫定実装）
   */
  private getEntries(): any[] {
    try {
      return (window as any).GM_getValue?.('vm_sites_palette__sites', []) || [];
    } catch {
      return [];
    }
  }
}
