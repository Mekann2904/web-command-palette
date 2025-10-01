import { SiteEntry, Settings } from '@/types';
import { defaultSites, defaultSettings } from '@/constants';

const STORAGE_KEY = 'vm_sites_palette__sites';
const SETTINGS_KEY = 'vm_sites_palette__settings_v2';
const FAVCACHE_KEY = 'vm_sites_palette__favcache_v1';
const USAGE_KEY = 'vm_sites_palette__usage_v1';

// GM_* APIのグローバル宣言
declare const GM_getValue: <T>(key: string, defaultValue?: T) => T;
declare const GM_setValue: (key: string, value: any) => void;

/**
 * ストレージ操作の基底クラス
 */
abstract class StorageBase {
  protected abstract getStorageKey(): string;
  
  protected get<T>(defaultValue?: T): T {
    return GM_getValue(this.getStorageKey(), defaultValue as T);
  }
  
  protected set(value: any): void {
    GM_setValue(this.getStorageKey(), value);
  }
}

/**
 * サイトストレージクラス
 */
class SiteStorage extends StorageBase {
  protected getStorageKey(): string {
    return STORAGE_KEY;
  }
  
  /**
   * サイトを取得する
   */
  getSites(): SiteEntry[] {
    const raw = this.get(defaultSites);
    const normalized = [];
    let mutated = false;
    
    for (const item of raw) {
      const norm = normalizeSite(item);
      if (!norm) continue;
      if (item !== norm) mutated = true;
      normalized.push(norm);
    }
    
    if (!normalized.length) {
      normalized.push(...defaultSites.map(normalizeSite).filter(Boolean) as SiteEntry[]);
    }
    
    if (mutated) {
      this.setSites(normalized, true);
    }
    
    return normalized;
  }

  /**
   * サイトを設定する
   */
  setSites(sites: SiteEntry[], skipNormalize = false): void {
    const list = skipNormalize ? sites : sites.map(normalizeSite).filter(Boolean) as SiteEntry[];
    this.set(list);
  }
  
  /**
   * サイトを追加する
   */
  addSite(site: Partial<SiteEntry>): SiteEntry {
    const sites = this.getSites();
    const newSite = normalizeSite({ ...site, id: site.id || generateId('site') });
    if (newSite) {
      sites.push(newSite);
      this.setSites(sites, true);
    }
    return newSite as SiteEntry;
  }
  
  /**
   * サイトを更新する
   */
  updateSite(id: string, updates: Partial<SiteEntry>): boolean {
    const sites = this.getSites();
    const index = sites.findIndex(site => site.id === id);
    
    if (index === -1) return false;
    
    sites[index] = { ...sites[index], ...updates };
    this.setSites(sites, true);
    return true;
  }
  
  /**
   * サイトを削除する
   */
  deleteSite(id: string): boolean {
    const sites = this.getSites();
    const filteredSites = sites.filter(site => site.id !== id);
    
    if (filteredSites.length === sites.length) return false;
    
    this.setSites(filteredSites, true);
    return true;
  }
}

/**
 * 設定ストレージクラス
 */
class SettingsStorage extends StorageBase {
  protected getStorageKey(): string {
    return SETTINGS_KEY;
  }
  
  /**
   * 設定を取得する
   */
  getSettings(): Settings {
    return { ...defaultSettings, ...this.get({}) };
  }

  /**
   * 設定を保存する
   */
  setSettings(settings: Partial<Settings>): void {
    this.set({ ...this.getSettings(), ...settings });
  }
  
  /**
   * 設定をリセットする
   */
  resetSettings(): void {
    this.set(defaultSettings);
  }
}

/**
 * キャッシュストレージクラス
 */
class CacheStorage extends StorageBase {
  constructor(private key: string) {
    super();
  }
  
  protected getStorageKey(): string {
    return this.key;
  }
  
  /**
   * キャッシュを取得する
   */
  getCache<T>(): Record<string, T> {
    return this.get({});
  }
  
  /**
   * キャッシュを設定する
   */
  setCache<T>(cache: Record<string, T>): void {
    this.set(cache);
  }
  
  /**
   * キャッシュエントリを設定する
   */
  setCacheEntry<T>(key: string, value: T): void {
    const cache = this.getCache<T>();
    cache[key] = value;
    this.setCache(cache);
  }
  
  /**
   * キャッシュエントリを削除する
   */
  deleteCacheEntry(key: string): boolean {
    const cache = this.getCache();
    if (!(key in cache)) return false;
    
    delete cache[key];
    this.setCache(cache);
    return true;
  }
  
  /**
   * キャッシュをクリアする
   */
  clearCache(): void {
    this.set({});
  }
}

// ストレージインスタンスを作成
const siteStorage = new SiteStorage();
const settingsStorage = new SettingsStorage();
const favCacheStorage = new CacheStorage(FAVCACHE_KEY);
const usageStorage = new CacheStorage(USAGE_KEY);

/**
 * ストレージを初期化する
 */
export const initializeStorage = (): void => {
  siteStorage.getSites(); // 初期化時に正規化を実行
  settingsStorage.getSettings(); // 初期化時にデフォルト設定を適用
};

/**
 * サイトを取得する
 */
export const getSites = (): SiteEntry[] => {
  return siteStorage.getSites();
};

/**
 * サイトを設定する
 */
export const setSites = (sites: SiteEntry[], skipNormalize = false): void => {
  siteStorage.setSites(sites, skipNormalize);
};

/**
 * サイトを追加する
 */
export const addSite = (site: Partial<SiteEntry>): SiteEntry => {
  return siteStorage.addSite(site);
};

/**
 * サイトを更新する
 */
export const updateSite = (id: string, updates: Partial<SiteEntry>): boolean => {
  return siteStorage.updateSite(id, updates);
};

/**
 * サイトを削除する
 */
export const deleteSite = (id: string): boolean => {
  return siteStorage.deleteSite(id);
};

/**
 * 設定を取得する
 */
export const getSettings = (): Settings => {
  return settingsStorage.getSettings();
};

/**
 * 設定を保存する
 */
export const setSettings = (settings: Partial<Settings>): void => {
  settingsStorage.setSettings(settings);
};

/**
 * 設定をリセットする
 */
export const resetSettings = (): void => {
  settingsStorage.resetSettings();
};

/**
 * 使用回数を増やす
 */
export const incrementUsage = (id: string): void => {
  if (!id) return;
  const usageCache = getUsageCache();
  const next = (usageCache[id] || 0) + 1;
  setUsage(id, next);
};

/**
 * faviconキャッシュを取得する
 */
export const getFavCache = (): Record<string, string> => {
  return favCacheStorage.getCache<string>();
};

/**
 * faviconキャッシュを設定する
 */
export const setFavCache = (origin: string, href: string): void => {
  favCacheStorage.setCacheEntry(origin, href);
};

/**
 * 指定したoriginのfaviconキャッシュをクリアする
 */
export const clearFavCacheOrigin = (origin: string): void => {
  favCacheStorage.deleteCacheEntry(origin);
};

/**
 * faviconキャッシュをクリアする
 */
export const clearFavCache = (): void => {
  favCacheStorage.clearCache();
};

/**
 * 使用回数キャッシュを取得する
 */
export const getUsageCache = (): Record<string, number> => {
  return usageStorage.getCache<number>();
};

/**
 * 使用回数を設定する
 */
export const setUsage = (id: string, count: number): void => {
  usageStorage.setCacheEntry(id, count);
};

/**
 * 使用回数を整理する
 */
export const pruneUsage = (validIds: Set<string>): void => {
  const usageCache = getUsageCache();
  const next: Record<string, number> = {};
  let changed = false;
  
  for (const id of Object.keys(usageCache)) {
    if (validIds.has(id)) {
      next[id] = usageCache[id];
    } else {
      changed = true;
    }
  }
  
  if (changed) {
    usageStorage.setCache(next);
  }
};

/**
 * 使用回数キャッシュをクリアする
 */
export const clearUsageCache = (): void => {
  usageStorage.clearCache();
};

/**
 * サイトエントリを正規化する
 */
function normalizeSite(entry: any): SiteEntry | null {
  if (!entry || typeof entry !== 'object') return null;
  
  const next = { ...entry };
  
  if (!next.type) next.type = 'site';
  if (!next.id) next.id = generateId('site');
  
  if (!Array.isArray(next.tags)) {
    if (typeof next.tags === 'string' && next.tags.trim()) {
      next.tags = next.tags.split(/[,\s]+/).filter(Boolean);
    } else {
      next.tags = [];
    }
  }
  
  if (next.type !== 'site') next.type = 'site';
  next.name = next.name || '';
  next.url = next.url || '';
  
  return next as SiteEntry;
}

/**
 * IDを生成する
 */
function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
