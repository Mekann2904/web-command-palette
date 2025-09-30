/**
 * DOM要素取得関連のユーティリティ関数
 */

/**
 * 親要素からIDで要素を取得する
 */
export const getElementById = (parent: Element | Document, id: string): HTMLElement | null => {
  return parent.querySelector(`#${id}`);
};

/**
 * 親要素からデータ属性で要素を取得する
 */
export const getElementByDataAttribute = (parent: Element, attribute: string): HTMLElement | null => {
  return parent.querySelector(`[${attribute}]`);
};

/**
 * 親要素からname属性で要素リストを取得する
 */
export const getElementsByName = (parent: Element, name: string): NodeListOf<Element> => {
  return parent.querySelectorAll(`[name="${name}"]`);
};

/**
 * 親要素からクラス名で要素リストを取得する
 */
export const getElementsByClassName = (parent: Element, className: string): NodeListOf<Element> => {
  return parent.querySelectorAll(`.${className}`);
};

/**
 * 親要素からセレクタで最初の要素を取得する
 */
export const querySelector = (parent: Element | Document, selector: string): HTMLElement | null => {
  return parent.querySelector(selector);
};

/**
 * 親要素からセレクタで要素リストを取得する
 */
export const querySelectorAll = (parent: Element | Document, selector: string): NodeListOf<Element> => {
  return parent.querySelectorAll(selector);
};

/**
 * 設定画面用のDOM要素を取得する
 */
export const getSettingsElements = (setBox: Element) => {
  return {
    closeBtn: getElementById(setBox, 'vs-close'),
    saveBtn: getElementById(setBox, 'vs-save'),
    resetBtn: getElementById(setBox, 'vs-reset'),
    clearFavBtn: getElementById(setBox, 'vs-clear-fav'),
    hotkey1Input: getElementById(setBox, 'vs-hotkey1') as HTMLInputElement,
    hotkey2Input: getElementById(setBox, 'vs-hotkey2') as HTMLInputElement,
    accentInput: getElementById(setBox, 'vs-accent') as HTMLInputElement,
    accentText: getElementById(setBox, 'vs-accent-text') as HTMLInputElement,
    blocklistInput: getElementById(setBox, 'vs-blocklist') as HTMLTextAreaElement,
    autoOpenInput: getElementById(setBox, 'vs-auto-open') as HTMLTextAreaElement,
    enterInputs: getElementsByName(setBox, 'vs-enter'),
    themeInputs: getElementsByName(setBox, 'vs-theme')
  };
};

/**
 * マネージャー画面用のDOM要素を取得する
 */
export const getManagerElements = (mgrBox: Element) => {
  return {
    addSiteBtn: getElementById(mgrBox, 'vm-add-site'),
    saveBtn: getElementById(mgrBox, 'vm-save'),
    closeBtn: getElementById(mgrBox, 'vm-close'),
    exportBtn: getElementById(mgrBox, 'vm-export'),
    importInput: getElementById(mgrBox, 'vm-import-file') as HTMLInputElement,
    importBtn: getElementById(mgrBox, 'vm-import'),
    siteBodyEl: getElementById(mgrBox, 'vm-rows-sites') as HTMLTableSectionElement
  };
};

/**
 * サイト行の入力要素を取得する
 */
export const getSiteRowInputs = (row: HTMLTableRowElement) => {
  return {
    nameInput: querySelector(row, 'input[data-field="name"]') as HTMLInputElement,
    urlInput: querySelector(row, 'input[data-field="url"]') as HTMLInputElement,
    tagsInput: querySelector(row, 'input[data-field="tags"]') as HTMLInputElement,
    upBtn: querySelector(row, '[data-up]'),
    downBtn: querySelector(row, '[data-down]'),
    delBtn: querySelector(row, '[data-del]'),
    testBtn: querySelector(row, '[data-test]')
  };
};

/**
 * アクティブなアイテム要素を取得する
 */
export const getActiveItems = (container: Element | null, selector: string): HTMLElement[] => {
  if (!container) return [];
  return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
};

/**
 * 要素が存在するかをチェックする
 */
export const elementExists = (parent: Element | Document, selector: string): boolean => {
  return parent.querySelector(selector) !== null;
};

/**
 * 要素のテキストコンテンツを安全に取得する
 */
export const getTextContent = (element: Element | null): string => {
  return element?.textContent?.trim() || '';
};

/**
 * 入力要素の値を安全に取得する
 */
export const getInputValue = (input: HTMLInputElement | null): string => {
  return input?.value?.trim() || '';
};

/**
 * テキストエリア要素の値を安全に取得する
 */
export const getTextareaValue = (textarea: HTMLTextAreaElement | null): string => {
  return textarea?.value?.trim() || '';
};