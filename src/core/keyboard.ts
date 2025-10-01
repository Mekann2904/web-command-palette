import { SiteEntry, Settings } from '@/types';
import { getAllTags } from '@/utils/search';
import { showToast } from '@/utils/ui';
import { matchHotkey } from './hotkey';

// キーボードイベント処理の結果インターフェース
export interface KeyboardResult {
  activeIndex: number;
  handled: boolean;
}

// オートコンプリート処理の結果インターフェース
export interface AutocompleteResult {
  newIndex: number;
  shouldHide: boolean;
  handled: boolean;
}

// キーボードハンドラのコールバックインターフェース
export interface KeyboardHandlerCallbacks {
  onPaletteHide: () => void;
  onPaletteOpen: () => void;
  onRenderList: () => void;
  onUpdateActive: () => void;
  onExecuteEntry: (item: SiteEntry, shiftKey: boolean) => void;
  onShowAutocomplete: (tag: string) => void;
  onHideAutocomplete: () => void;
  onBingSearch: () => void;
}

// キーの定数
const NAVIGATION_KEYS = new Set(['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab']);
const BING_SEARCH_URL = 'https://www.bing.com/search?q=';

/**
 * キーボードイベント処理を管理するクラス
 */
export class KeyboardHandler {
  private callbacks: KeyboardHandlerCallbacks;

  constructor(callbacks: KeyboardHandlerCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * 入力キーボードイベントを処理する
   */
  onInputKey = (
    e: KeyboardEvent,
    currentItems: SiteEntry[],
    activeIndex: number,
    inputEl: HTMLInputElement,
    isAutocompleteVisible: boolean
  ): KeyboardResult => {
    // 日本語入力中は処理しない
    if (e.isComposing || e.keyCode === 229) {
      return { activeIndex, handled: false };
    }

    // オートコンプリート表示中の処理
    if (isAutocompleteVisible) {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.callbacks.onHideAutocomplete();
        return { activeIndex, handled: true };
      }
      return { activeIndex, handled: false };
    }

    // Meta+EnterでBing検索
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      this.callbacks.onBingSearch();
      return { activeIndex, handled: true };
    }

    // Escapeでパレットを閉じる
    if (e.key === 'Escape') {
      this.callbacks.onPaletteHide();
      return { activeIndex, handled: true };
    }

    // Tabでタグ補完
    if (e.key === 'Tab' && !e.shiftKey && inputEl.value.trim() === '') {
      e.preventDefault();
      this.handleTabCompletion(inputEl);
      return { activeIndex, handled: true };
    }

    // アイテムがない場合の処理
    if (!currentItems.length) {
      return this.handleEmptyItems(e, inputEl, activeIndex);
    }

    // ナビゲーションキーの処理
    return this.handleNavigationKeys(e, currentItems, activeIndex);
  };

  /**
   * Tabキーでのタグ補完を処理
   */
  private handleTabCompletion = (inputEl: HTMLInputElement): void => {
    const allTags = getAllTags();
    if (allTags.length > 0) {
      inputEl.value = '#' + allTags[0] + ' ';
      this.callbacks.onRenderList();
      this.callbacks.onShowAutocomplete(allTags[0]);
    }
  };

  /**
   * アイテムがない場合のキーボード処理
   */
  private handleEmptyItems = (
    e: KeyboardEvent,
    inputEl: HTMLInputElement,
    activeIndex: number
  ): KeyboardResult => {
    if (e.key === 'Enter') {
      // Meta+Enterはここでは処理しない（すでに上位で処理済み）
      if (e.metaKey) {
        return { activeIndex, handled: false };
      }
      e.preventDefault();
      const query = inputEl.value.trim();
      if (!query) {
        showToast('検索キーワードを入力してください');
        return { activeIndex, handled: true };
      }
      // Bing検索を実行
      window.open(`${BING_SEARCH_URL}${encodeURIComponent(query)}`, '_blank');
      return { activeIndex, handled: true };
    }
    return { activeIndex, handled: false };
  };

  /**
   * ナビゲーションキーの処理
   */
  private handleNavigationKeys = (
    e: KeyboardEvent,
    currentItems: SiteEntry[],
    activeIndex: number
  ): KeyboardResult => {
    let newActiveIndex = activeIndex;
    let handled = false;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        newActiveIndex = (activeIndex + 1) % currentItems.length;
        this.callbacks.onUpdateActive();
        handled = true;
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        newActiveIndex = (activeIndex - 1 + currentItems.length) % currentItems.length;
        this.callbacks.onUpdateActive();
        handled = true;
        break;
        
      case 'Enter':
        // Meta+Enterはここでは処理しない（すでに上位で処理済み）
        if (e.metaKey) {
          return { activeIndex, handled: false };
        }
        e.preventDefault();
        const item = currentItems[activeIndex];
        this.callbacks.onExecuteEntry(item, e.shiftKey);
        handled = true;
        break;
    }

    return { activeIndex: newActiveIndex, handled };
  };

  /**
   * グローバルホットキーハンドラを更新する
   */
  updateHotkeyHandler = (e: KeyboardEvent, settings: Settings, onOpenPalette: () => void): boolean => {
    if (matchHotkey(e, settings.hotkeyPrimary) || matchHotkey(e, settings.hotkeySecondary)) {
      e.preventDefault();
      e.stopPropagation();
      onOpenPalette();
      return true;
    }
    return false;
  };

  /**
   * オートコンプリートキーボード処理
   */
  handleAutocompleteKeydown = (
    e: KeyboardEvent,
    autocompleteItems: any[],
    autocompleteIndex: number,
    isVisible: boolean
  ): AutocompleteResult => {
    if (!isVisible || !autocompleteItems.length) {
      return { newIndex: autocompleteIndex, shouldHide: false, handled: false };
    }

    let newIndex = autocompleteIndex;
    let shouldHide = false;
    let handled = false;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        newIndex = (autocompleteIndex + 1) % autocompleteItems.length;
        handled = true;
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        newIndex = (autocompleteIndex - 1 + autocompleteItems.length) % autocompleteItems.length;
        handled = true;
        break;
        
      case 'Enter':
        if (autocompleteIndex >= 0) {
          e.preventDefault();
          // アイテム選択処理は呼び出し元に委ねる
          handled = true;
        }
        break;
        
      case 'Escape':
        shouldHide = true;
        handled = true;
        break;
    }

    return { newIndex, shouldHide, handled };
  };

  /**
   * キーがナビゲーションキーかチェック
   */
  static isNavigationKey = (key: string): boolean => {
    return NAVIGATION_KEYS.has(key);
  };

  /**
   * キーが修飾キーかチェック
   */
  static isModifierKey = (e: KeyboardEvent): boolean => {
    return e.ctrlKey || e.metaKey || e.altKey || e.shiftKey;
  };
}
