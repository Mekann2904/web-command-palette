import { DOMElements } from '@/core/state';
import { addClickListener, addMouseEnterListener, addInputListener, addKeydownListener, setupAutocompleteEvents } from '@/utils/events';
import { setBlurCheckTimeout } from '@/utils/timing';

/**
 * オートコンプリートの状態インターフェース
 */
export interface BaseAutocompleteState {
  items: any[];
  index: number;
  isVisible: boolean;
}

/**
 * オートコンプリートアイテムのインターフェース
 */
export interface AutocompleteItem {
  name: string;
  count: number;
  depth?: number;
  parentPath?: string;
  isNew?: boolean;
}

/**
 * オートコンプリートの基底クラス
 * 共通の機能を提供し、具体的な実装はサブクラスで行う
 */
export abstract class BaseAutocomplete {
  protected dom: DOMElements;
  protected state: BaseAutocompleteState;
  protected inputElement: HTMLInputElement;
  protected container: HTMLDivElement;
  protected listElement: HTMLDivElement;
  protected onItemSelect: (item: any) => void;
  protected baseClassName: string;

  constructor(
    dom: DOMElements, 
    inputElement: HTMLInputElement, 
    onItemSelect: (item: any) => void,
    baseClassName: string = 'autocomplete'
  ) {
    this.dom = dom;
    this.inputElement = inputElement;
    this.onItemSelect = onItemSelect;
    this.baseClassName = baseClassName;
    
    this.state = {
      items: [],
      index: -1,
      isVisible: false
    };
    
    // プロパティを初期化
    this.container = document.createElement('div');
    this.listElement = document.createElement('div');
    
    this.buildAutocomplete();
    this.setupEventListeners();
  }

  /**
   * オートコンプリートUIを構築する（テンプレートメソッド）
   */
  protected buildAutocomplete(): void {
    this.container = this.createContainer();
    this.listElement = this.createListElement();
    
    // スタイルを追加
    this.addStyles();
    
    // 元の入力欄をコンテナに移動
    this.wrapInputElement();
    
    // コンテナをDOMに追加
    this.container.appendChild(this.listElement);
    
    // ルート要素に追加
    if (this.dom.root) {
      this.dom.root.appendChild(this.container);
    }
  }

  /**
   * イベントリスナーを設定する
   */
  protected setupEventListeners(): void {
    // 入力イベント
    addInputListener(this.inputElement, this.handleInput);
    
    // キーボードイベント
    addKeydownListener(this.inputElement, this.handleKeydown);
    
    // オートコンプリート用の特殊イベント設定
    setupAutocompleteEvents(this.inputElement, this.listElement, () => this.hide());
  }

  /**
   * コンテナ要素を作成する
   */
  protected createContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = `${this.baseClassName}-container`;
    container.style.position = 'relative';
    return container;
  }

  /**
   * リスト要素を作成する
   */
  protected createListElement(): HTMLDivElement {
    const listElement = document.createElement('div');
    listElement.className = `${this.baseClassName}-list`;
    listElement.style.display = 'none';
    return listElement;
  }

  /**
   * スタイルを追加する（抽象メソッド）
   */
  protected abstract addStyles(): void;

  /**
   * 元の入力欄をコンテナで囲む
   */
  protected wrapInputElement(): void {
    if (this.inputElement && this.inputElement.parentNode) {
      this.inputElement.parentNode.replaceChild(this.container, this.inputElement);
      this.container.appendChild(this.inputElement);
    }
  }

  /**
   * 入力イベントを処理する
   */
  protected handleInput = (): void => {
    const value = this.inputElement.value;
    
    // 少し遅延して処理（入力中のパフォーマンス向上）
    setTimeout(() => {
      const query = this.extractQuery(value);
      if (this.shouldShowSuggestions(query)) {
        this.show(query);
      } else {
        this.hide();
      }
    }, 10);
  };

  /**
   * キーボードイベントを処理する
   */
  protected handleKeydown = (e: KeyboardEvent): void => {
    if (!this.state.isVisible) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.state.index = (this.state.index + 1) % this.state.items.length;
        this.updateActive();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.state.index = (this.state.index - 1 + this.state.items.length) % this.state.items.length;
        this.updateActive();
        break;
      case 'Enter':
        if (this.state.index >= 0) {
          e.preventDefault();
          this.selectItem(this.state.items[this.state.index]);
        }
        break;
      case 'Escape':
        this.hide();
        break;
    }
  };

  /**
   * クエリを抽出する（抽象メソッド）
   */
  protected abstract extractQuery(value: string): string;

  /**
   * 候補を表示すべきか判定する（抽象メソッド）
   */
  protected abstract shouldShowSuggestions(query: string): boolean;

  /**
   * アイテムをフィルタリングする（抽象メソッド）
   */
  protected abstract filterItems(query: string): any[];

  /**
   * アイテムをレンダリングする（抽象メソッド）
   */
  protected abstract renderItems(items: any[]): void;

  /**
   * アイテム要素を作成する（テンプレートメソッド）
   */
  protected createItemElement(item: AutocompleteItem, index: number): HTMLElement {
    const itemElement = document.createElement('div');
    itemElement.className = `${this.baseClassName}-item`;
    itemElement.dataset.index = index.toString();
    
    // アイテムの内容を生成
    itemElement.innerHTML = this.generateItemContent(item);
    
    // イベントリスナーを追加
    addClickListener(itemElement, () => this.selectItem(item));
    addMouseEnterListener(itemElement, () => {
      this.state.index = index;
      this.updateActive();
    });
    
    return itemElement;
  }

  /**
   * アイテムの内容を生成する（抽象メソッド）
   */
  protected abstract generateItemContent(item: AutocompleteItem): string;

  /**
   * 候補を表示する
   */
  protected show(query: string): void {
    const filteredItems = this.filterItems(query);
    
    if (filteredItems.length === 0) {
      this.handleEmptyResults(query);
      return;
    }
    
    this.state.items = filteredItems;
    this.state.index = 0;
    this.state.isVisible = true;
    
    this.renderItems(filteredItems);
    this.listElement.style.display = 'block';
    this.updateActive();
  }

  /**
   * 空の結果を処理する（抽象メソッド）
   */
  protected abstract handleEmptyResults(query: string): void;

  /**
   * 候補を非表示にする
   */
  public hide(): void {
    this.state.isVisible = false;
    this.state.index = -1;
    this.listElement.style.display = 'none';
  }

  /**
   * アクティブなアイテムを更新する
   */
  protected updateActive(): void {
    const items = this.listElement.querySelectorAll(`.${this.baseClassName}-item`);
    items.forEach((item, index) => {
      item.classList.toggle('active', index === this.state.index);
    });
  }

  /**
   * アイテムを選択する
   */
  protected selectItem(item: AutocompleteItem): void {
    this.hide();
    this.inputElement.focus();
    this.onItemSelect(item);
  }

  /**
   * 入力値を更新する
   */
  protected updateInputValue(value: string): void {
    this.inputElement.value = value;
    
    // 入力後にスペースを追加して検索できるようにする
    setTimeout(() => {
      this.inputElement.value += ' ';
      this.inputElement.dispatchEvent(new Event('input'));
    }, 0);
  }

  /**
   * クリーンアップ処理
   */
  public cleanup(): void {
    this.hide();
    
    // イベントリスナーの削除はサブクラスで実装
    // DOM要素の削除
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  /**
   * 表示状態を取得
   */
  public getIsVisible(): boolean {
    return this.state.isVisible;
  }

  /**
   * 現在のアイテムを取得
   */
  public getCurrentItems(): any[] {
    return this.state.items;
  }
}