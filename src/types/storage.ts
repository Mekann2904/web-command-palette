import { SiteEntry } from './site';
import { Settings } from './settings';

export interface StorageData {
  sites: SiteEntry[];
  settings: Settings;
  favcache: FaviconCache;
  usage: UsageCache;
}

export interface FaviconCache {
  [origin: string]: string;
}

export interface UsageCache {
  [siteId: string]: number;
}

export interface StorageKeys {
  STORAGE_KEY: string;
  SETTINGS_KEY: string;
  FAVCACHE_KEY: string;
  USAGE_KEY: string;
}

// GM_* APIの型定義
export interface GMStorage {
  getValue: <T>(key: string, defaultValue?: T) => T;
  setValue: <T>(key: string, value: T) => void;
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
  onload?: (response: GMResponse) => void;
  onerror?: () => void;
}

export interface GMResponse {
  responseText: string;
  status: number;
}

export interface GMClipboard {
  setClipboard: (text: string) => void;
}
