/**
 * グローバル変数とGM APIの型定義
 */

// HTTPメソッドの共用体型
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

// GM_* APIの型定義（すべてglobals.tsに集約）
export interface GMStorage {
  getValue: <T>(key: string, defaultValue?: T) => T;
  setValue: <T>(key: string, value: T) => void;
  deleteValue?: (key: string) => void;
  listValues?: () => string[];
}

export interface GMMenu {
  registerMenuCommand: (name: string, callback: () => void, accessKey?: string) => number;
  unregisterMenuCommand?: (menuCommandId: number) => void;
}

export interface GMTabs {
  openInTab: (url: string, options?: { active?: boolean; insert?: boolean; setParent?: boolean }) => void;
  getTab?: (tabId: number, callback: (tab: any) => void) => void;
  saveTab?: (tab: any) => void;
  deleteTab?: (tabId: number, callback: () => void) => void;
}

export interface GMRequest<T = any> {
  abort: () => void;
  getResponseHeader: (name: string) => string | null;
  getAllResponseHeaders: () => string;
  readyState: number;
  response: T;
  responseText: string;
  responseXML: Document | null;
  status: number;
  statusText: string;
}

export interface GMRequestFunction {
  <T = any>(details: GMRequestDetails<T>): GMRequest<T>;
}

export interface GMRequestDetails<T = any> {
  method: HTTPMethod;
  url: string;
  headers?: Record<string, string>;
  data?: string | FormData | URLSearchParams;
  timeout?: number;
  context?: any;
  responseType?: 'text' | 'arraybuffer' | 'blob' | 'json' | 'document';
  overrideMimeType?: string;
  anonymous?: boolean;
  user?: string;
  password?: string;
  onload?: (response: GMResponse<T>) => void;
  onerror?: (error: Error) => void;
  onabort?: () => void;
  onprogress?: (progress: ProgressEvent) => void;
  onreadystatechange?: (readyState: number) => void;
  ontimeout?: () => void;
}

export interface GMResponse<T = any> {
  responseText: string;
  response: T;
  status: number;
  statusText: string;
  readyState: number;
  responseHeaders: string;
  finalUrl: string;
  context?: any;
}

export interface GMClipboard {
  setClipboard: (text: string, type?: 'text/plain') => void;
  getClipboard?: (callback: (text: string) => void) => void;
}

export interface GMInfo {
  script: {
    name: string;
    description: string;
    namespace: string;
    version: string;
    author: string;
  };
  scriptMetaStr?: string;
  scriptHandler: string;
    version: string;
  platform: {
    browserName: string;
    browserVersion: string;
    os: string;
    arch?: string;
    lang: string;
  };
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

// GM_* APIの統合インターフェース
export interface GreaseMonkeyAPI extends GMStorage, GMMenu, GMTabs, GMRequestFunction {
  info: GMInfo;
  notification?: (text: string, title?: string, image?: string, onclick?: () => void) => void;
  setClipboard: (text: string, type?: 'text/plain') => void;
  getClipboard?: (callback: (text: string) => void) => void;
}

// ウィンドウオブジェクトの拡張
declare global {
  interface Window {
    // GM API
    GM_getValue: <T>(key: string, defaultValue?: T) => T;
    GM_setValue: <T>(key: string, value: T) => void;
    GM_deleteValue?: (key: string) => void;
    GM_listValues?: () => string[];
    GM_registerMenuCommand: (name: string, callback: () => void, accessKey?: string) => number;
    GM_unregisterMenuCommand?: (menuCommandId: number) => void;
    GM_xmlhttpRequest: <T = any>(details: GMRequestDetails<T>) => GMRequest<T>;
    GM_openInTab: (url: string, options?: { active?: boolean; insert?: boolean; setParent?: boolean }) => void;
    GM_setClipboard: (text: string, type?: 'text/plain') => void;
    GM_getClipboard?: (callback: (text: string) => void) => void;
    GM_notification?: (text: string, title?: string, image?: string, onclick?: () => void) => void;
    GM_info?: GMInfo;
    
    // アプリケーション関数
    openPalette?: () => void;
    openManager?: () => void;
    openSettings?: () => void;
    
    // DOM要素（後方互換性のため）
    toastEl: HTMLElement | null;
  }
}

// GM_* APIのグローバル宣言
// GM_* APIのグローバル宣言
export declare const GM_getValue: <T>(key: string, defaultValue?: T) => T;
export declare const GM_setValue: <T>(key: string, value: T) => void;
export declare const GM_deleteValue: (key: string) => void;
export declare const GM_listValues: () => string[];
export declare const GM_registerMenuCommand: (name: string, callback: () => void, accessKey?: string) => number;
export declare const GM_unregisterMenuCommand: (menuCommandId: number) => void;
export declare const GM_xmlhttpRequest: GMRequestFunction;
export declare const GM_openInTab: (url: string, options?: { active?: boolean; insert?: boolean; setParent?: boolean }) => void;
export declare const GM_setClipboard: (text: string, type?: 'text/plain') => void;
export declare const GM_getClipboard: (callback: (text: string) => void) => void;
export declare const GM_notification: (text: string, title?: string, image?: string, onclick?: () => void) => void;
export declare const GM_info: GMInfo;
