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