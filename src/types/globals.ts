/**
 * グローバル変数とGM APIの型定義
 */

// GM_* APIの型定義（すべてglobals.tsに集約）
export interface GMStorage {
  getValue: <T>(key: string, defaultValue?: T) => T;
  setValue: (key: string, value: any) => void;
}

export interface GMMenu {
  registerMenuCommand: (name: string, callback: () => void) => void;
}

export interface GMTabs {
  openInTab: (url: string, options?: { active?: boolean; insert?: boolean }) => void;
}

export interface GMRequest {
  xmlhttpRequest: (details: GMRequestDetails) => void;
}

export interface GMRequestDetails {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  onload?: (response: GMResponse) => void;
  onerror?: () => void;
}

export interface GMResponse {
  responseText: string;
  status: number;
  statusText: string;
}

export interface GMClipboard {
  setClipboard: (text: string) => void;
}

// グローバル変数の型定義
export interface GlobalVariables {
  host: HTMLElement | null;
  root: ShadowRoot | null;
  overlayEl: HTMLElement | null;
  boxEl: HTMLElement | null;
  inputEl: HTMLInputElement | null;
  listEl: HTMLElement | null;
  hintEl: HTMLElement | null;
  toastEl: HTMLElement | null;
  setOverlay: HTMLElement | null;
  setBox: HTMLElement | null;
  mgrOverlay: HTMLElement | null;
  mgrBox: HTMLElement | null;
  siteBodyEl: HTMLTableSectionElement | null;
  suggestionsEl: HTMLElement | null;
  autocompleteEl: HTMLElement | null;
}

// グローバル関数の型定義
export interface GlobalFunctions {
  openPalette: () => void;
  openManager: () => void;
  openSettings: () => void;
}

// ウィンドウオブジェクトの拡張
declare global {
  interface Window {
    toastEl: HTMLElement | null;
    GM_getValue: <T>(key: string, defaultValue?: T) => T;
    GM_setValue: (key: string, value: any) => void;
    GM_registerMenuCommand: (name: string, callback: () => void) => void;
    GM_xmlhttpRequest: (details: GMRequestDetails) => void;
    GM_openInTab: (url: string, options?: { active?: boolean; insert?: boolean }) => void;
    GM_setClipboard: (text: string) => void;
    openPalette?: () => void;
    openManager?: () => void;
    openSettings?: () => void;
  }
}

// GM_* APIのグローバル宣言
export declare const GM_getValue: <T>(key: string, defaultValue?: T) => T;
export declare const GM_setValue: (key: string, value: any) => void;
export declare const GM_registerMenuCommand: (name: string, callback: () => void) => void;
export declare const GM_xmlhttpRequest: (details: GMRequestDetails) => void;
export declare const GM_openInTab: (url: string, options?: { active?: boolean; insert?: boolean }) => void;
export declare const GM_setClipboard: (text: string) => void;
