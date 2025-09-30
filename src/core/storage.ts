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
 * ストレージを初期化する
 */
export const initializeStorage = (): void => {
  if (!GM_getValue(STORAGE_KEY)) {
    GM_setValue(STORAGE_KEY, defaultSites);
  }
  if (!GM_getValue(SETTINGS_KEY)) {
    GM_setValue(SETTINGS_KEY, defaultSettings);
  }
};

/**
 * サイトを取得する
 */
export const getSites = (): SiteEntry[] => {
  const raw = GM_getValue(STORAGE_KEY, defaultSites);
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
    setSites(normalized, true);
  }
  
  return normalized;
};

/**
 * サイトを設定する
 */
export const setSites = (sites: SiteEntry[], skipNormalize = false): void => {
  const list = skipNormalize ? sites : sites.map(normalizeSite).filter(Boolean) as SiteEntry[];
  GM_setValue(STORAGE_KEY, list);
};

/**
 * 設定を取得する
 */
export const getSettings = (): Settings => {
  return { ...defaultSettings, ...GM_getValue(SETTINGS_KEY, {}) };
};

/**
 * 設定を保存する
 */
export const setSettings = (settings: Partial<Settings>): void => {
  GM_setValue(SETTINGS_KEY, { ...getSettings(), ...settings });
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
  return GM_getValue(FAVCACHE_KEY, {});
};

/**
 * faviconキャッシュを設定する
 */
export const setFavCache = (origin: string, href: string): void => {
  const favCache = getFavCache();
  favCache[origin] = href;
  GM_setValue(FAVCACHE_KEY, favCache);
};

/**
 * 指定したoriginのfaviconキャッシュをクリアする
 */
export const clearFavCacheOrigin = (origin: string): void => {
  if (!origin) return;
  const favCache = getFavCache();
  if (favCache[origin]) {
    delete favCache[origin];
    GM_setValue(FAVCACHE_KEY, favCache);
  }
};

/**
 * 使用回数キャッシュを取得する
 */
export const getUsageCache = (): Record<string, number> => {
  return GM_getValue(USAGE_KEY, {});
};

/**
 * 使用回数を設定する
 */
export const setUsage = (id: string, count: number): void => {
  const usageCache = getUsageCache();
  usageCache[id] = count;
  GM_setValue(USAGE_KEY, usageCache);
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
    GM_setValue(USAGE_KEY, next);
  }
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
