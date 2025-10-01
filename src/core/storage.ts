import { SiteEntry, Settings } from '@/types';
import { defaultSites, defaultSettings } from '@/constants';

// ストレージキーの定数
const STORAGE_KEYS = {
  SITES: 'vm_sites_palette__sites',
  SETTINGS: 'vm_sites_palette__settings_v2',
  FAVCACHE: 'vm_sites_palette__favcache_v1',
  USAGE: 'vm_sites_palette__usage_v1'
} as const;

// キャッシュ関連の定数
const CACHE_TTL = 5 * 60 * 1000; // 5分
const MAX_CACHE_SIZE = 1000;
const ID_PREFIX = 'site';

// GM_* APIのグローバル宣言
declare const GM_getValue: <T>(key: string, defaultValue?: T) => T;
declare const GM_setValue: (key: string, value: any) => void;

// キャッシュエントリのインターフェース
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// ストレージ操作結果のインターフェース
export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * ストレージ操作の基底クラス
 */
abstract class StorageBase {
  protected abstract getStorageKey(): string;
  private cache: Map<string, CacheEntry<any>> = new Map();

  /**
   * データを取得（キャッシュ付き）
   */
  protected get<T>(defaultValue?: T, useCache = false): T {
    const key = this.getStorageKey();
    
    if (useCache) {
      const cached = this.cache.get(key);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.data;
      }
    }
    
    const data = GM_getValue(key, defaultValue as T);
    
    if (useCache) {
      this.setCache(key, data);
    }
    
    return data;
  }
  
  /**
   * データを設定
   */
  protected set(value: any): void {
    const key = this.getStorageKey();
    GM_setValue(key, value);
    this.updateCache(key, value);
  }

  /**
   * キャッシュを設定
   */
  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // キャッシュサイズを制限
    if (this.cache.size > MAX_CACHE_SIZE) {
      this.pruneCache();
    }
  }

  /**
   * キャッシュを更新
   */
  private updateCache<T>(key: string, data: T): void {
    const existing = this.cache.get(key);
    if (existing) {
      existing.data = data;
      existing.timestamp = Date.now();
    } else {
      this.setCache(key, data);
    }
  }

  /**
   * 古いキャッシュを削除
   */
  private pruneCache(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // 古い半分を削除
    const toDelete = entries.slice(0, Math.floor(entries.length / 2));
    toDelete.forEach(([key]) => this.cache.delete(key));
  }

  /**
   * キャッシュをクリア
   */
  protected clearCache(): void {
    this.cache.clear();
  }
}

/**
 * サイトストレージクラス
 */
class SiteStorage extends StorageBase {
  protected getStorageKey(): string {
    return STORAGE_KEYS.SITES;
  }
  
  /**
   * サイトを取得する
   */
  getSites(): SiteEntry[] {
    const raw = this.get(defaultSites);
    const normalized: SiteEntry[] = [];
    let mutated = false;
    
    for (const item of raw) {
      const norm = normalizeSite(item);
      if (!norm) continue;
      if (JSON.stringify(item) !== JSON.stringify(norm)) mutated = true;
      normalized.push(norm);
    }
    
    if (!normalized.length) {
      normalized.push(...defaultSites.map(normalizeSite).filter(Boolean) as SiteEntry[]);
      mutated = true;
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
  addSite(site: Partial<SiteEntry>): StorageResult<SiteEntry> {
    try {
      const sites = this.getSites();
      const newSite = normalizeSite({ ...site, id: site.id || generateId() });
      
      if (!newSite) {
        return { success: false, error: new Error('Invalid site data') };
      }
      
      sites.push(newSite);
      this.setSites(sites, true);
      
      return { success: true, data: newSite };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * サイトを更新する
   */
  updateSite(id: string, updates: Partial<SiteEntry>): StorageResult<SiteEntry> {
    try {
      const sites = this.getSites();
      const index = sites.findIndex(site => site.id === id);
      
      if (index === -1) {
        return { success: false, error: new Error('Site not found') };
      }
      
      const updatedSite = { ...sites[index], ...updates };
      sites[index] = updatedSite;
      this.setSites(sites, true);
      
      return { success: true, data: updatedSite };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * サイトを削除する
   */
  deleteSite(id: string): StorageResult<boolean> {
    try {
      const sites = this.getSites();
      const filteredSites = sites.filter(site => site.id !== id);
      
      if (filteredSites.length === sites.length) {
        return { success: false, error: new Error('Site not found') };
      }
      
      this.setSites(filteredSites, true);
      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * サイトを検索
   */
  searchSites(query: string): SiteEntry[] {
    if (!query.trim()) return this.getSites();
    
    const normalizedQuery = query.toLowerCase().trim();
    return this.getSites().filter(site => 
      site.name.toLowerCase().includes(normalizedQuery) ||
      site.url.toLowerCase().includes(normalizedQuery) ||
      site.tags.some(tag => tag.toLowerCase().includes(normalizedQuery))
    );
  }
}

/**
 * 設定ストレージクラス
 */
class SettingsStorage extends StorageBase {
  protected getStorageKey(): string {
    return STORAGE_KEYS.SETTINGS;
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
  setSettings(settings: Partial<Settings>): StorageResult<Settings> {
    try {
      const currentSettings = this.getSettings();
      const newSettings = { ...currentSettings, ...settings };
      this.set(newSettings);
      return { success: true, data: newSettings };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * 設定をリセットする
   */
  resetSettings(): StorageResult<Settings> {
    try {
      this.set(defaultSettings);
      return { success: true, data: defaultSettings };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
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
  setCacheData<T>(cache: Record<string, T>): void {
    this.set(cache);
  }
  
  /**
   * キャッシュエントリを設定する
   */
  setCacheEntry<T>(key: string, value: T): void {
    const cache = this.getCache<T>();
    cache[key] = value;
    this.setCacheData(cache);
  }
  
  /**
   * キャッシュエントリを削除する
   */
  deleteCacheEntry(key: string): boolean {
    const cache = this.getCache();
    if (!(key in cache)) return false;
    
    delete cache[key];
    this.setCacheData(cache);
    return true;
  }
  
  /**
   * キャッシュをクリアする
   */
  clearCache(): void {
    this.set({});
  }

  /**
   * キャッシュサイズを取得
   */
  getCacheSize(): number {
    return Object.keys(this.getCache()).length;
  }
}

// ストレージインスタンスを作成
const siteStorage = new SiteStorage();
const settingsStorage = new SettingsStorage();
const favCacheStorage = new CacheStorage(STORAGE_KEYS.FAVCACHE);
const usageStorage = new CacheStorage(STORAGE_KEYS.USAGE);

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
export const addSite = (site: Partial<SiteEntry>): StorageResult<SiteEntry> => {
  return siteStorage.addSite(site);
};

/**
 * サイトを更新する
 */
export const updateSite = (id: string, updates: Partial<SiteEntry>): StorageResult<SiteEntry> => {
  return siteStorage.updateSite(id, updates);
};

/**
 * サイトを削除する
 */
export const deleteSite = (id: string): StorageResult<boolean> => {
  return siteStorage.deleteSite(id);
};

/**
 * サイトを検索する
 */
export const searchSites = (query: string): SiteEntry[] => {
  return siteStorage.searchSites(query);
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
export const setSettings = (settings: Partial<Settings>): StorageResult<Settings> => {
  return settingsStorage.setSettings(settings);
};

/**
 * 設定をリセットする
 */
export const resetSettings = (): StorageResult<Settings> => {
  return settingsStorage.resetSettings();
};

/**
 * 使用回数を増やす（アトミック操作）
 */
export const incrementUsage = (id: string): StorageResult<number> => {
  if (!id) {
    return { success: false, error: new Error('Invalid ID') };
  }
  
  // リトライカウンタと最大リトライ回数
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount < maxRetries) {
    try {
      // 現在の使用回数を取得
      const currentUsage = usageStorage.getCache<number>();
      const currentCount = currentUsage[id] || 0;
      
      // 新しい使用回数を計算
      const nextCount = currentCount + 1;
      
      // アトミックに更新（楽観的ロック）
      const updatedUsage = { ...currentUsage, [id]: nextCount };
      usageStorage.setCacheData(updatedUsage);
      
      // 更新が成功したか確認
      const verificationUsage = usageStorage.getCache<number>();
      if (verificationUsage[id] === nextCount) {
        return { success: true, data: nextCount };
      }
      
      // 競合が検出された場合、リトライ
      retryCount++;
      
      // 短い遅延を入れてからリトライ
      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 10; // 指数バックオフ
        const start = Date.now();
        while (Date.now() - start < delay) {
          // 同期的に待機
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  // 最大リトライ回数を超えた場合
  return {
    success: false,
    error: new Error('Failed to increment usage after maximum retries')
  };
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
export const clearFavCacheOrigin = (origin: string): boolean => {
  return favCacheStorage.deleteCacheEntry(origin);
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
export const pruneUsage = (validIds: Set<string>): StorageResult<number> => {
  try {
    const usageCache = getUsageCache();
    const next: Record<string, number> = {};
    let removedCount = 0;
    
    for (const [id, count] of Object.entries(usageCache)) {
      if (validIds.has(id)) {
        next[id] = count;
      } else {
        removedCount++;
      }
    }
    
    usageStorage.setCacheData(next);
    return { success: true, data: removedCount };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
};

/**
 * 使用回数キャッシュをクリアする
 */
export const clearUsageCache = (): void => {
  usageStorage.clearCache();
};

/**
 * ストレージ統計情報を取得
 */
export const getStorageStats = () => {
  return {
    sitesCount: siteStorage.getSites().length,
    favCacheSize: favCacheStorage.getCacheSize(),
    usageCacheSize: usageStorage.getCacheSize()
  };
};

/**
 * サイトエントリを正規化する
 */
function normalizeSite(entry: any): SiteEntry | null {
  if (!entry || typeof entry !== 'object') return null;
  
  const next = { ...entry };
  
  if (!next.type) next.type = 'site';
  if (!next.id) next.id = generateId();
  
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
function generateId(): string {
  return `${ID_PREFIX}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
