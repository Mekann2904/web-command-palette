import { DOMElements } from '@/core/state';
import { getSites } from '@/core/storage';
import { getAllTags } from '@/utils/search';
import { escapeHtml } from '@/utils/string';

/**
 * マネージャーオートコンプリートの状態インターフェース
 */
interface ManagerAutocompleteState {
  items: TagSuggestion[];
  index: number;
  isVisible: boolean;
}

/**
 * タグ候補のインターフェース
 */
interface TagSuggestion {
  name: string;
  count: number;
  depth: number;
  parentPath?: string;
}

/**
 * サイトマネージャのタグ入力フィールド用オートコンプリート機能を管理するクラス
 */
export class ManagerAutocomplete {
  private dom: DOMElements;
  private state: ManagerAutocompleteState;
  private tagInput: HTMLInputElement;
  private autocompleteEl!: HTMLDivElement;
  private onTagSelect: (tag: string) => void;
  private container!: HTMLDivElement;

  constructor(dom: DOMElements, tagInput: HTMLInputElement, onTagSelect: (tag: string) => void) {
    this.dom = dom;
    this.tagInput = tagInput;
    this.onTagSelect = onTagSelect;
    this.state = {
      items: [],
      index: -1,
      isVisible: false
    };
    
    this.buildAutocomplete();
    this.setupEventListeners();
  }

  /**
   * オートコンプリートUIを構築
   */
  buildAutocomplete(): void {
    // コンテナを作成して元の入力欄を囲む
    this.container = document.createElement('div');
    this.container.className = 'tag-autocomplete-container';
    this.container.style.position = 'relative';
    
    // オートコンプリート要素を作成
    this.autocompleteEl = document.createElement('div');
    this.autocompleteEl.className = 'tag-autocomplete-list';
    this.autocompleteEl.style.display = 'none';
    
    // スタイルを追加
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
    
    // 元の入力欄をコンテナに移動
    if (this.tagInput && this.tagInput.parentNode) {
      this.tagInput.parentNode.replaceChild(this.container, this.tagInput);
      this.container.appendChild(this.tagInput);
      this.container.appendChild(this.autocompleteEl);
      
      // スタイルをルート要素に追加
      if (this.dom.root) {
        this.dom.root.appendChild(style);
      }
    }
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners(): void {
    // 入力イベント
    this.tagInput.addEventListener('input', this.handleInput);
    
    // キーボードイベント
    this.tagInput.addEventListener('keydown', this.handleKeydown);
    
    // フォーカスイベント
    this.tagInput.addEventListener('blur', this.handleBlur);
    
    // オートコンプリート内クリック時にフォーカスを奪われても閉じない
    this.autocompleteEl.addEventListener('mousedown', (e) => {
      e.preventDefault();        // 入力の blur を抑止
      this.tagInput.focus();    // フォーカスを戻す
    });
  }

  /**
   * 入力イベント処理
   */
  handleInput = (): void => {
    const value = this.tagInput.value;
    
    setTimeout(() => {
      // カンマ区切りの最後の単語を取得
      const tags = value.split(/[,\s]+/).filter(Boolean);
      const lastTag = tags[tags.length - 1] || '';
      
      if (lastTag.length > 0) {
        this.showTagSuggestions(lastTag);
      } else {
        this.hideTagSuggestions();
      }
    }, 10);
  };

  /**
   * キーボードイベント処理
   */
  handleKeydown = (e: KeyboardEvent): void => {
    if (!this.state.isVisible) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.state.index = (this.state.index + 1) % this.state.items.length;
      this.updateActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.state.index = (this.state.index - 1 + this.state.items.length) % this.state.items.length;
      this.updateActive();
    } else if (e.key === 'Enter' && this.state.index >= 0) {
      e.preventDefault();
      this.selectTag(this.state.items[this.state.index].name);
    } else if (e.key === 'Escape') {
      this.hideTagSuggestions();
    }
  };

  /**
   * フォーカスイベント処理
   */
  handleBlur = (e: FocusEvent): void => {
    const to = e.relatedTarget as Node;
    const insideAuto = to && this.autocompleteEl.contains(to);
    setTimeout(() => {
      if (!insideAuto && !this.autocompleteEl.matches(':hover')) {
        this.hideTagSuggestions();
      }
    }, 0);
  };

  /**
   * タグ候補を表示
   */
  showTagSuggestions(query: string): void {
    const entries = getSites();
    const allTags = getAllTags(entries);
    
    // タグの使用回数をカウント
    const tagCounts: Record<string, number> = {};
    entries.forEach(entry => {
      if (entry.tags) {
        entry.tags.forEach((tag: string) => {
          const normalizedTag = tag.trim();
          if (normalizedTag) {
            tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1;
          }
        });
      }
    });
    
    // クエリに基づいてタグをフィルタリング
    let filteredTags = allTags.filter(tag => {
      const tagLower = tag.toLowerCase();
      const queryLower = query.toLowerCase();
      
      // 完全一致
      if (tagLower === queryLower) return true;
      
      // 階層タグの親タグで一致
      const parts = tag.split('/');
      if (parts.some(part => part.toLowerCase() === queryLower)) return true;
      
      // 部分一致
      if (tagLower.includes(queryLower)) return true;
      
      return false;
    });
    
    // 階層の浅い順、アルファベット順にソート
    filteredTags.sort((a, b) => {
      const aDepth = (a.match(/\//g) || []).length;
      const bDepth = (b.match(/\//g) || []).length;
      if (aDepth !== bDepth) return aDepth - bDepth;
      return a.localeCompare(b);
    });
    
    // タグ候補オブジェクトに変換
    const filteredTagObjects = filteredTags.map(tag => {
      let count = tagCounts[tag] || 0;
      
      // 親タグの場合、子タグの件数も合算
      if (!tag.includes('/')) {
        Object.keys(tagCounts).forEach(childTag => {
          if (childTag.startsWith(tag + '/')) {
            count += tagCounts[childTag];
          }
        });
      }
      
      const parts = tag.split('/');
      const depth = parts.length - 1;
      const parentPath = parts.slice(0, -1).join('/');
      
      return {
        name: tag,
        count: count,
        depth: depth,
        parentPath: parentPath || undefined
      };
    });
    
    // 新規タグ作成を提案
    const showNewTagOption = !filteredTagObjects.some(item => item.name.toLowerCase() === query.toLowerCase());
    
    if (filteredTagObjects.length === 0 && !showNewTagOption) {
      this.hideTagSuggestions();
      return;
    }
    
    this.state.items = filteredTagObjects;
    if (showNewTagOption) {
      this.state.items.push({
        name: query,
        count: 0,
        depth: 0,
        parentPath: undefined
      });
    }
    this.state.index = 0;
    this.state.isVisible = true;
    
    this.renderTagSuggestions();
  }

  /**
   * タグ候補をレンダリング
   */
  renderTagSuggestions(): void {
    this.autocompleteEl.innerHTML = '';
    
    this.state.items.forEach((tag, index) => {
      const item = document.createElement('div');
      item.className = 'tag-autocomplete-item';
      item.dataset.index = index.toString();
      
      const isNewTag = tag.count === 0;
      
      if (isNewTag) {
        // 新規タグ作成オプション
        item.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0;">
            <span class="tag-autocomplete-tag tag-autocomplete-new" style="overflow: hidden; text-overflow: ellipsis;">➕ 新規タグを作成: "${escapeHtml(tag.name)}"</span>
            <div style="font-size: 10px; color: var(--muted);">Enterで作成して続行</div>
          </div>
        `;
      } else {
        // 既存タグ
        const parts = tag.name.split('/');
        const displayName = parts.pop() || '';
        
        // 階層関係を視覚的に表現
        let hierarchyDisplay = '';
        if (tag.depth > 0 && tag.parentPath) {
          hierarchyDisplay = `<span style="color: var(--muted); font-size: 11px;">${escapeHtml(tag.parentPath)}/</span>`;
        }
        
        item.innerHTML = `
          <div style="display: flex; align-items: flex-start; gap: 4px; flex: 1; min-width: 0;">
            <span style="margin-left: ${tag.depth * 12}px; color: var(--muted); font-size: 12px; flex-shrink: 0; margin-top: 2px;">${tag.depth > 0 ? '└─' : ''}</span>
            <div style="display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 4px; min-width: 0;">
                ${hierarchyDisplay}
                <span class="tag-autocomplete-tag" style="font-weight: ${tag.depth > 0 ? '400' : '500'}; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(displayName)}</span>
              </div>
              ${tag.depth > 0 ? `<div style="font-size: 10px; color: var(--muted); margin-left: ${tag.depth * 12 + 16}px; overflow: hidden; text-overflow: ellipsis;">フルパス: ${escapeHtml(tag.name)}</div>` : ''}
            </div>
          </div>
          <span class="tag-autocomplete-count">${tag.count}件</span>
        `;
      }
      
      item.addEventListener('click', () => this.selectTag(tag.name));
      item.addEventListener('mouseenter', () => {
        this.state.index = index;
        this.updateActive();
      });
      
      this.autocompleteEl.appendChild(item);
    });
    
    this.autocompleteEl.style.display = 'block';
    this.updateActive();
  }

  /**
   * タグ候補を非表示
   */
  hideTagSuggestions(): void {
    this.state.isVisible = false;
    this.state.index = -1;
    this.autocompleteEl.style.display = 'none';
  }

  /**
   * アクティブな候補を更新
   */
  updateActive(): void {
    const items = this.autocompleteEl.querySelectorAll('.tag-autocomplete-item');
    items.forEach((item, index) => {
      item.classList.toggle('active', index === this.state.index);
    });
  }

  /**
   * タグを選択
   */
  selectTag(tag: string): void {
    const currentValue = this.tagInput.value;
    const tags = currentValue.split(/[,\s]+/).filter(Boolean);
    
    // 最後のタグを置換
    if (tags.length > 0) {
      tags[tags.length - 1] = tag;
    } else {
      tags.push(tag);
    }
    
    // 入力欄を更新
    this.tagInput.value = tags.join(', ') + ', ';
    
    this.hideTagSuggestions();
    this.tagInput.focus();
    
    // コールバックを実行
    this.onTagSelect(tag);
  }
}