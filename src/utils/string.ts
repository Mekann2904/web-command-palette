/**
 * 文字列を正規化する
 */
export const normalize = (str: string | undefined): string => {
  return (str || '').toLowerCase();
};

/**
 * HTMLをエスケープする
 */
export const escapeHtml = (str: string): string => {
  const s = str || '';
  const escapeMap: Record<string, string> = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": '&#039;'
  };
  return s.replace(/[&<>"']/g, m => escapeMap[m] || m);
};

/**
 * 正規表現をエスケープする
 */
export const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * ワイルドカードマッチング
 */
export const wildcard = (str: string, pattern: string): boolean => {
  const re = new RegExp('^' + pattern.split('*').map(x => x.replace(/[\.^$+?()|{}\[\]]/g, r => '\\' + r)).join('.*') + '$', 'i');
  return re.test(str);
};
