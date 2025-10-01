/**
 * セキュリティ関連のユーティリティ関数
 */

/**
 * 正規表現の複雑さを検証し、安全な正規表現に変換する
 * @param pattern 検証する正規表現パターン
 * @param maxLength パターンの最大長（デフォルト100文字）
 * @returns 安全な正規表現パターン、または安全でない場合はnull
 */
export const sanitizeRegex = (pattern: string, maxLength: number = 100): string | null => {
  // パターン長のチェック
  if (!pattern || pattern.length > maxLength) {
    return null;
  }

  // 危険な正規表現パターンのブラックリスト
  const dangerousPatterns = [
    // 原子的なグループのネスト
    /\(.*\(\(.*\)\).*\)/,
    // 再帰的なパターン
    /\(\?\((.*)\)\)/,
    // 多数の量指定子の連続
    /(\*|\+|\?|\{[\d,]+\}){5,}/,
    // 複雑な先読み/後読み
    /(\(\?=.+\)|\(\?!.+\)|\(\?<=.+\)|\(\?<!.+\)){2,}/,
    // バックトラッキングを多用するパターン
    /(.+\*|.+[^\*]\+|.+[^\+]\?){2,}/
  ];

  // 危険なパターンをチェック
  for (const dangerous of dangerousPatterns) {
    if (dangerous.test(pattern)) {
      return null;
    }
  }

  // 特殊文字をエスケープして安全なパターンを作成
  const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  return escapedPattern;
};

/**
 * 文字列をHTMLエスケープする
 * @param str エスケープする文字列
 * @returns エスケープされた文字列
 */
export const escapeHtml = (str: string): string => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

/**
 * URLの妥当性を検証する
 * @param url 検証するURL
 * @returns 有効なURLの場合はtrue、無効な場合はfalse
 */
export const isValidUrl = (url: string): boolean => {
  try {
    // URLの構文を検証
    const parsedUrl = new URL(url);
    
    // 許可されたプロトコルのみを許可
    const allowedProtocols = ['http:', 'https:', 'ftp:', 'ftps:', 'mailto:', 'tel:'];
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      return false;
    }
    
    // javascript:プロトコルを明示的に拒否
    if (parsedUrl.protocol === 'javascript:') {
      return false;
    }
    
    return true;
  } catch {
    // URLの構文が無効な場合
    return false;
  }
};

/**
 * 入力文字列の長さと内容を検証する
 * @param input 検証する入力文字列
 * @param maxLength 最大長（デフォルト1000文字）
 * @returns 有効な入力の場合はtrue、無効な場合はfalse
 */
export const validateInput = (input: string, maxLength: number = 1000): boolean => {
  if (!input || typeof input !== 'string') {
    return false;
  }
  
  if (input.length > maxLength) {
    return false;
  }
  
  // 制御文字（改行、タブを除く）をチェック
  const controlCharsRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
  if (controlCharsRegex.test(input)) {
    return false;
  }
  
  return true;
};

/**
 * 安全な正規表現を作成する
 * @param pattern 元のパターン文字列
 * @param flags 正規表現フラグ
 * @param maxLength パターンの最大長
 * @returns 安全な正規表現オブジェクト、または安全でない場合はnull
 */
export const createSafeRegex = (pattern: string, flags: string = 'i', maxLength: number = 100): RegExp | null => {
  const sanitizedPattern = sanitizeRegex(pattern, maxLength);
  if (!sanitizedPattern) {
    return null;
  }
  
  try {
    return new RegExp(sanitizedPattern, flags);
  } catch {
    return null;
  }
};