import { SiteEntry, Settings } from '@/types';

/**
 * アプリケーションの状態インターフェース
 */
export interface AppState {
  isOpen: boolean;
  currentItems: SiteEntry[];
  activeIndex: number;
  cachedSettings: Settings | null;
  lastUpdated: number;
}

/**
 * DOM要素のインターフェース
 */
export interface DOMElements {
  host: HTMLElement | null;
  root: ShadowRoot | null;
  overlayEl: HTMLDivElement | null;
  inputEl: HTMLInputElement | null;
  listEl: HTMLDivElement | null;
  hintEl: HTMLDivElement | null;
  toastEl: HTMLDivElement | null;
  hintLeftSpan: HTMLSpanElement | null;
  // マネージャ関連
  mgrOverlay: HTMLDivElement | null;
  mgrBox: HTMLDivElement | null;
  siteBodyEl: HTMLTableSectionElement | null;
  // 設定関連
  setOverlay: HTMLDivElement | null;
  setBox: HTMLDivElement | null;
  // オートコンプリート関連
  autocompleteEl: HTMLDivElement | null;
  // 検索候補関連
  suggestionsEl: HTMLDivElement | null;
}

/**
 * オートコンプリートの状態インターフェース
 */
export interface AutocompleteState {
  items: any[];
  index: number;
  isVisible: boolean;
  lastUpdated: number;
}

/**
 * 状態更新の種類
 */
export type StateUpdateType =
  | 'toggle-palette'
  | 'update-items'
  | 'update-active-index'
  | 'update-settings'
  | 'reset-state';

/**
 * 状態更新アクションのインターフェース
 */
export interface StateAction {
  type: StateUpdateType;
  payload?: any;
}

/**
 * 状態管理クラス
 */
export class StateManager {
  private state: AppState;
  private listeners: Set<(state: AppState) => void> = new Set();
  private history: AppState[] = [];
  private maxHistorySize = 10;

  constructor(initialState?: AppState) {
    this.state = initialState || createInitialState();
  }

  /**
   * 現在の状態を取得
   */
  getState(): AppState {
    return { ...this.state };
  }

  /**
   * 状態を更新
   */
  updateState(action: StateAction): void {
    const previousState = { ...this.state };
    
    switch (action.type) {
      case 'toggle-palette':
        this.state.isOpen = !this.state.isOpen;
        break;
        
      case 'update-items':
        this.state.currentItems = action.payload || [];
        this.state.activeIndex = 0; // アイテム更新時にアクティブインデックスをリセット
        break;
        
      case 'update-active-index':
        this.state.activeIndex = action.payload ?? 0;
        break;
        
      case 'update-settings':
        this.state.cachedSettings = action.payload || null;
        break;
        
      case 'reset-state':
        this.state = createInitialState();
        break;
    }
    
    this.state.lastUpdated = Date.now();
    this.saveToHistory(previousState);
    this.notifyListeners();
  }

  /**
   * 状態変更を履歴に保存
   */
  private saveToHistory(previousState: AppState): void {
    this.history.push(previousState);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * 状態変更リスナーを登録
   */
  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener);
    
    // 登録時に現在の状態を通知
    listener(this.getState());
    
    // 登録解除関数を返す
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * リスナーに状態変更を通知
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.getState());
    }
  }

  /**
   * 履歴を取得
   */
  getHistory(): AppState[] {
    return [...this.history];
  }

  /**
   * 前の状態に戻る
   */
  undo(): boolean {
    if (this.history.length === 0) return false;
    
    const previousState = this.history.pop()!;
    this.state = previousState;
    this.notifyListeners();
    
    return true;
  }

  /**
   * 状態をリセット
   */
  reset(): void {
    this.updateState({ type: 'reset-state' });
  }

  /**
   * 状態が変更されたかチェック
   */
  hasChanged(): boolean {
    return this.history.length > 0;
  }
}

/**
 * DOM要素管理クラス
 */
export class DOMElementsManager {
  private elements: DOMElements;
  private cache: Map<string, Node> = new Map();

  constructor() {
    this.elements = createInitialDOMElements();
  }

  /**
   * DOM要素を取得
   */
  getElements(): DOMElements {
    return { ...this.elements };
  }

  /**
   * 特定のDOM要素を取得
   */
  getElement<K extends keyof DOMElements>(key: K): DOMElements[K] {
    return this.elements[key];
  }

  /**
   * DOM要素を設定
   */
  setElement<K extends keyof DOMElements>(key: K, element: DOMElements[K]): void {
    this.elements[key] = element;
    
    // キャッシュに保存
    if (element) {
      this.cache.set(key, element);
    } else {
      this.cache.delete(key);
    }
  }

  /**
   * セレクタからDOM要素を検索して設定
   */
  findAndSetElement<K extends keyof DOMElements>(
    key: K,
    selector: string,
    parent: Element | Document = document
  ): boolean {
    const element = parent.querySelector(selector) as DOMElements[K];
    if (element) {
      this.setElement(key, element);
      return true;
    }
    return false;
  }

  /**
   * 複数のDOM要素を一度に設定
   */
  setElements(elements: Partial<DOMElements>): void {
    for (const [key, element] of Object.entries(elements)) {
      this.setElement(key as keyof DOMElements, element as any);
    }
  }

  /**
   * すべてのDOM要素をクリア
   */
  clear(): void {
    this.elements = createInitialDOMElements();
    this.cache.clear();
  }

  /**
   * キャッシュされた要素を取得
   */
  getCachedElement(key: string): Node | undefined {
    return this.cache.get(key);
  }

  /**
   * すべての要素が設定されているかチェック
   */
  areAllElementsSet(): boolean {
    return Object.values(this.elements).every(element => element !== null);
  }
}

/**
 * オートコンプリート状態管理クラス
 */
export class AutocompleteStateManager {
  private state: AutocompleteState;

  constructor(initialState?: AutocompleteState) {
    this.state = initialState || createInitialAutocompleteState();
  }

  /**
   * 現在の状態を取得
   */
  getState(): AutocompleteState {
    return { ...this.state };
  }

  /**
   * アイテムを更新
   */
  updateItems(items: any[]): void {
    this.state.items = items;
    this.state.index = items.length > 0 ? 0 : -1;
    this.state.lastUpdated = Date.now();
  }

  /**
   * インデックスを更新
   */
  updateIndex(index: number): void {
    this.state.index = index;
    this.state.lastUpdated = Date.now();
  }

  /**
   * 表示状態を更新
   */
  updateVisibility(isVisible: boolean): void {
    this.state.isVisible = isVisible;
    this.state.lastUpdated = Date.now();
  }

  /**
   * 表示を切り替え
   */
  toggleVisibility(): boolean {
    this.state.isVisible = !this.state.isVisible;
    this.state.lastUpdated = Date.now();
    return this.state.isVisible;
  }

  /**
   * 次のアイテムを選択
   */
  selectNext(): void {
    if (this.state.items.length === 0) return;
    this.state.index = (this.state.index + 1) % this.state.items.length;
    this.state.lastUpdated = Date.now();
  }

  /**
   * 前のアイテムを選択
   */
  selectPrevious(): void {
    if (this.state.items.length === 0) return;
    this.state.index = this.state.index <= 0 ?
      this.state.items.length - 1 :
      this.state.index - 1;
    this.state.lastUpdated = Date.now();
  }

  /**
   * 現在選択中のアイテムを取得
   */
  getSelectedItem(): any {
    return this.state.index >= 0 && this.state.index < this.state.items.length
      ? this.state.items[this.state.index]
      : null;
  }

  /**
   * 状態をリセット
   */
  reset(): void {
    this.state = createInitialAutocompleteState();
  }
}

/**
 * グローバル状態の初期化
 */
export const createInitialState = (): AppState => ({
  isOpen: false,
  currentItems: [],
  activeIndex: 0,
  cachedSettings: null,
  lastUpdated: Date.now()
});

/**
 * DOM要素の初期化
 */
export const createInitialDOMElements = (): DOMElements => ({
  host: null,
  root: null,
  overlayEl: null,
  inputEl: null,
  listEl: null,
  hintEl: null,
  toastEl: null,
  hintLeftSpan: null,
  mgrOverlay: null,
  mgrBox: null,
  siteBodyEl: null,
  setOverlay: null,
  setBox: null,
  autocompleteEl: null,
  suggestionsEl: null,
});

/**
 * オートコンプリート状態の初期化
 */
export const createInitialAutocompleteState = (): AutocompleteState => ({
  items: [],
  index: -1,
  isVisible: false,
  lastUpdated: Date.now()
});

/**
 * 状態アクションクリエーター
 */
export const StateActionCreators = {
  togglePalette: (): StateAction => ({ type: 'toggle-palette' }),
  updateItems: (items: SiteEntry[]): StateAction => ({ type: 'update-items', payload: items }),
  updateActiveIndex: (index: number): StateAction => ({ type: 'update-active-index', payload: index }),
  updateSettings: (settings: Settings): StateAction => ({ type: 'update-settings', payload: settings }),
  resetState: (): StateAction => ({ type: 'reset-state' })
};
