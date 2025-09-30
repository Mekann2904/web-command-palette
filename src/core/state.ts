import { SiteEntry, Settings } from '@/types';

/**
 * アプリケーションの状態インターフェース
 */
export interface AppState {
  isOpen: boolean;
  currentItems: SiteEntry[];
  activeIndex: number;
  cachedSettings: Settings | null;
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
}

/**
 * グローバル状態の初期化
 */
export const createInitialState = (): AppState => ({
  isOpen: false,
  currentItems: [],
  activeIndex: 0,
  cachedSettings: null
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
  isVisible: false
});
