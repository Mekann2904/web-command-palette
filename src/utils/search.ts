import { SiteEntry } from '@/types';
import { normalize } from './string';
import { getSites } from '@/core/storage';

/**
 * タグフィルタを抽出する
 */
export const extractTagFilter = (query: string): { tagFilter: string | null; textQuery: string } => {
  const trimmed = query.trim();
  if (!trimmed.startsWith('#')) return { tagFilter: null, textQuery: query };
  
  // #タグ名 の形式を処理
  const hashIndex = trimmed.indexOf('#');
  const afterHash = trimmed.slice(hashIndex + 1);
  
  // #のみの場合はnullを返す
  if (afterHash === '') {
    return { tagFilter: null, textQuery: '' };
  }
  
  // スペースでタグと検索語を分離
  const spaceIndex = afterHash.indexOf(' ');
  if (spaceIndex === -1) {
    // #タグ名 のみの場合
    const tag = normalize(afterHash);
    return { tagFilter: tag || null, textQuery: '' };
  } else {
    // #タグ名 検索語 の場合
    const tag = normalize(afterHash.slice(0, spaceIndex));
    const textQuery = afterHash.slice(spaceIndex + 1).trim();
    return { tagFilter: tag || null, textQuery };
  }
};

/**
 * タグ候補を表示すべきか判定する
 */
export const shouldShowTagSuggestions = (query: string): boolean => {
  const trimmed = query.trim();
  if (!trimmed.startsWith('#')) return false;
  
  // #タグ名 の形式で、まだスペースがない場合にタグ候補を表示
  const hashIndex = trimmed.indexOf('#');
  const afterHash = trimmed.slice(hashIndex + 1);
  return !afterHash.includes(' ');
};

/**
 * すべてのタグを取得する
 */
export const getAllTags = (entries: SiteEntry[] = []): string[] => {
  // 省略時はストレージから取得
  if (!entries || entries.length === 0) {
    try {
      entries = getSites();
    } catch (_) {
      entries = [];
    }
  }
  
  const tagSet = new Set<string>();
  
  entries.forEach((item) => {
    if (item.tags && Array.isArray(item.tags)) {
      item.tags.forEach((tag) => {
        if (tag && typeof tag === 'string' && tag.trim()) {
          const cleanTag = tag.trim();
          tagSet.add(cleanTag);
        }
      });
    }
  });
  
  return Array.from(tagSet).sort();
};

/**
 * 使用回数ブーストを取得する
 */
export const getUsageBoost = (entry: SiteEntry, usageCache: Record<string, number>): number => {
  if (!entry || !entry.id) return 0;
  const count = usageCache[entry.id] || 0;
  return Math.min(8, Math.log(count + 1) * 3);
};

/**
 * エントリをスコアリングする
 */
export const scoreEntries = (entries: SiteEntry[], query: string, usageCache: Record<string, number>): { entry: SiteEntry; score: number }[] => {
  const base = entries.map(e => ({ entry: e, score: 0 }));
  if (!query) {
    base.forEach(item => { item.score = 0.0001 + getUsageBoost(item.entry, usageCache); });
  } else {
    const matcher = createFuzzyMatcher(query);
    base.forEach(item => {
      const entry = item.entry;
      const score = Math.max(
        matcher(entry.name || ''),
        matcher(entry.url || '') - 4,
        matcher((entry.tags || []).join(' ')) - 2
      );
      item.score = score === -Infinity ? -Infinity : score + getUsageBoost(item.entry, usageCache);
    });
  }

  const filtered = base.filter(item => item.score > -Infinity);
  filtered.sort((a,b) => b.score - a.score);

  return filtered;
};

/**
 * タグでエントリをフィルタリングする
 */
export const filterEntriesByTag = (entries: SiteEntry[], tagFilter: string): SiteEntry[] => {
  if (!tagFilter) return entries;
  
  const normalizedTagFilter = normalize(tagFilter);
  return entries.filter(entry => {
    if (!entry.tags || !Array.isArray(entry.tags)) return false;
    
    // 完全一致
    if (entry.tags.some(tag => normalize(tag) === normalizedTagFilter)) {
      return true;
    }
    
    // 階層タグの一致チェック
    return entry.tags.some(tag => {
      const normalizedTag = normalize(tag);
      
      // 階層タグの親タグで一致（例: "ai/tools" は "ai" で一致）
      const parts = tag.split('/');
      if (parts.some(part => normalize(part) === normalizedTagFilter)) {
        return true;
      }
      
      // 階層タグの前方一致（例: "ai" で "ai/tools" に一致）
      if (normalizedTag.startsWith(normalizedTagFilter + '/')) {
        return true;
      }
      
      return false;
    });
  });
};

/**
 * ファジーマッチャーを作成する
 */
export const createFuzzyMatcher = (query: string) => {
  const q = normalize(query);
  const chars = q.split('');
  const regex = new RegExp(chars.map(c => escapeRegex(c)).join('.*?'), 'i');
  return (text: string): number => {
    if (!text) return -Infinity;
    const lower = normalize(text);
    if (lower.includes(q)) {
      const index = lower.indexOf(q);
      return 40 - index * 1.5;
    }
    if (!regex.test(text)) return -Infinity;
    let score = 20;
    score -= lower.length * 0.02;
    if (lower.startsWith(chars[0])) score += 6;
    return score;
  };
};

/**
 * 正規表現をエスケープする
 */
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * フィルタリングとスコアリングを一度に行う
 */
export const filterAndScoreEntries = (entries: SiteEntry[], query: string, usageCache: Record<string, number>): SiteEntry[] => {
  const scored = scoreEntries(entries, query, usageCache);
  return scored.map(item => item.entry);
};
