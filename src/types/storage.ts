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

