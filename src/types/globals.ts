import { SiteEntry } from './site';
import { Settings } from './settings';

export interface GlobalVariables {
  host: HTMLElement | null;
  root: ShadowRoot | null;
  overlayEl: HTMLDivElement | null;
  inputEl: HTMLInputElement | null;
  listEl: HTMLDivElement | null;
  hintEl: HTMLDivElement | null;
  toastEl: HTMLDivElement | null;
  hintLeftSpan: HTMLSpanElement | null;
  mgrOverlay: HTMLDivElement | null;
  mgrBox: HTMLDivElement | null;
  siteBodyEl: HTMLTableSectionElement | null;
  setOverlay: HTMLDivElement | null;
  setBox: HTMLDivElement | null;
  autocompleteEl: HTMLDivElement | null;
  
  // 状態管理
  isOpen: boolean;
  currentItems: SiteEntry[];
  activeIndex: number;
  cachedSettings: Settings | null;
  autocompleteItems: any[];
  autocompleteIndex: number;
  isAutocompleteVisible: boolean;
  
  // キャッシュ
  favCache: Record<string, string>;
  usageCache: Record<string, number>;
}

// グローバル関数の型定義
export interface GlobalFunctions {
  openPalette: () => void;
  hidePalette: () => void;
  renderList: () => void;
  updateActive: () => void;
  openItem: (item: SiteEntry, shiftPressed: boolean) => void;
  executeEntry: (entry: SiteEntry, shiftPressed: boolean, query?: string) => void;
  openManager: () => void;
  closeManager: () => void;
  renderManager: () => void;
  saveManager: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  saveSettingsFromUI: () => void;
  showToast: (message: string) => void;
  applyTheme: () => void;
  onGlobalKeydown: (e: KeyboardEvent) => void;
  onInputKey: (e: KeyboardEvent) => void;
}
