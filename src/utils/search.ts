import { SiteEntry } from '@/types';
import { normalize } from './string';
import { getSites } from '@/core/storage';

/**
 * タグフィルタを抽出する
 */
export const extractTagFilter = (query: string): { tagFilter: string | null; textQuery: string } => {
  const trimmed = query.trim();
  if (!trimmed.startsWith('#')) return { tagFilter: null, textQuery: query };
  const parts = trimmed.split(/\s+/);
  const first = parts.shift();
  if (!first) return { tagFilter: null, textQuery: query };
  const tag = normalize(first.slice(1));
  return { tagFilter: tag || null, textQuery: parts.join(' ') };
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
  
  // デバッグ情報
  console.log('[CommandPalette] getAllTags - entries count:', entries.length);
  console.log('[CommandPalette] getAllTags - entries:', entries);
  
  entries.forEach((item, index) => {
    console.log(`[CommandPalette] Processing entry ${index}:`, {
      id: item.id,
      name: item.name,
      tags: item.tags,
      tagsType: typeof item.tags,
      tagsIsArray: Array.isArray(item.tags)
    });
    
    if (item.tags && Array.isArray(item.tags)) {
      item.tags.forEach((tag, tagIndex) => {
        console.log(`[CommandPalette] Processing tag ${tagIndex}:`, tag);
        if (tag && typeof tag === 'string' && tag.trim()) {
          const cleanTag = tag.trim();
          tagSet.add(cleanTag);
          console.log(`[CommandPalette] Added tag: "${cleanTag}"`);
        } else {
          console.log(`[CommandPalette] Skipped invalid tag:`, tag);
        }
      });
    } else {
      console.log(`[CommandPalette] Entry ${index} has no valid tags array`);
    }
  });
  
  const result = Array.from(tagSet).sort();
  console.log('[CommandPalette] getAllTags - final tags:', result);
  return result;
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
