/**
 * タグソート関連のユーティリティ関数
 */

/**
 * タグを階層構造でソートする
 * スラッシュで区切られた階層の深さを優先し、同じ階層内ではアルファベット順にソートする
 */
export const sortTagsByHierarchy = (tags: string[]): string[] => {
  return tags.sort((a, b) => {
    const aDepth = (a.match(/\//g) || []).length;
    const bDepth = (b.match(/\//g) || []).length;
    
    // 階層の深さが異なる場合は浅い方を優先
    if (aDepth !== bDepth) return aDepth - bDepth;
    
    // 同じ階層の場合はアルファベット順
    return a.localeCompare(b);
  });
};

/**
 * タグの階層の深さを取得する
 */
export const getTagDepth = (tag: string): number => {
  return (tag.match(/\//g) || []).length;
};

/**
 * タグを階層の深さでグループ化する
 */
export const groupTagsByDepth = (tags: string[]): Record<number, string[]> => {
  const groups: Record<number, string[]> = {};
  
  tags.forEach(tag => {
    const depth = getTagDepth(tag);
    if (!groups[depth]) {
      groups[depth] = [];
    }
    groups[depth].push(tag);
  });
  
  // 各グループ内でアルファベット順にソート
  Object.keys(groups).forEach(depth => {
    groups[Number(depth)].sort((a, b) => a.localeCompare(b));
  });
  
  return groups;
};

/**
 * 親タグを取得する
 */
export const getParentTag = (tag: string): string | null => {
  const lastSlashIndex = tag.lastIndexOf('/');
  if (lastSlashIndex === -1) return null;
  return tag.substring(0, lastSlashIndex);
};

/**
 * 子タグの候補を取得する
 */
export const getChildTagCandidates = (tags: string[], parentTag: string): string[] => {
  return tags.filter(tag => {
    const parent = getParentTag(tag);
    return parent === parentTag;
  });
};

/**
 * タグが別のタグの子孫であるかをチェックする
 */
export const isDescendantTag = (tag: string, ancestorTag: string): boolean => {
  return tag.startsWith(ancestorTag + '/');
};

/**
 * タグのパス配列を取得する
 */
export const getTagPath = (tag: string): string[] => {
  return tag.split('/').filter(part => part.length > 0);
};

/**
 * タグの階層構造を維持したままソートする
 */
export const sortTagsHierarchically = (tags: string[]): string[] => {
  const sorted = sortTagsByHierarchy([...tags]);
  const result: string[] = [];
  const added = new Set<string>();
  
  // 階層構造を維持しながら追加
  sorted.forEach(tag => {
    if (!added.has(tag)) {
      // 親タグが存在する場合は先に追加
      const parent = getParentTag(tag);
      if (parent && !added.has(parent) && tags.includes(parent)) {
        const parentIndex = sorted.indexOf(parent);
        if (parentIndex !== -1) {
          result.push(parent);
          added.add(parent);
        }
      }
      result.push(tag);
      added.add(tag);
    }
  });
  
  return result;
};

/**
 * タグ候補オブジェクトのインターフェース
 */
export interface TagSuggestion {
  name: string;
  count: number;
  depth: number;
  parentPath?: string;
}

/**
 * タグの使用回数をカウントする
 */
export const countTagUsage = (entries: any[]): Record<string, number> => {
  const tagCounts: Record<string, number> = {};
  
  entries.forEach(entry => {
    if (entry.tags) {
      entry.tags.forEach((tag: string) => {
        const normalizedTag = tag.trim();
        if (normalizedTag) {
          tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1;
        }
      });
    }
  });
  
  return tagCounts;
};

/**
 * タグをフィルタリングする
 */
export const filterTags = (allTags: string[], query: string): string[] => {
  const queryLower = query.toLowerCase();
  
  return allTags.filter(tag => {
    const tagLower = tag.toLowerCase();
    
    // 完全一致
    if (tagLower === queryLower) return true;
    
    // 階層タグの親タグで一致
    const parts = tag.split('/');
    if (parts.some(part => part.toLowerCase() === queryLower)) return true;
    
    // 部分一致
    if (tagLower.includes(queryLower)) return true;
    
    return false;
  });
};

/**
 * 階層タグをフィルタリングする
 */
export const filterHierarchicalTags = (allTags: string[], query: string): string[] => {
  if (query.includes('/')) {
    const parts = query.split('/');
    const parentQuery = parts.slice(0, -1).join('/');
    const childQuery = parts[parts.length - 1];
    
    return allTags.filter(tag => {
      if (tag.startsWith(parentQuery + '/')) {
        const childPart = tag.slice(parentQuery.length + 1);
        return childPart.toLowerCase().includes(childQuery.toLowerCase());
      }
      return false;
    });
  } else {
    return filterTags(allTags, query);
  }
};

/**
 * タグ候補オブジェクトに変換する
 */
export const createTagSuggestions = (tags: string[], tagCounts: Record<string, number>): TagSuggestion[] => {
  return tags.map(tag => {
    let count = tagCounts[tag] || 0;
    
    // 親タグの場合、子タグの件数も合算
    if (!tag.includes('/')) {
      Object.keys(tagCounts).forEach(childTag => {
        if (childTag.startsWith(tag + '/')) {
          count += tagCounts[childTag];
        }
      });
    }
    
    const parts = tag.split('/');
    const depth = parts.length - 1;
    const parentPath = parts.slice(0, -1).join('/');
    
    return {
      name: tag,
      count: count,
      depth: depth,
      parentPath: parentPath || undefined
    };
  });
};