import { SiteEntry } from '@/types';
import { getAllTags } from '@/utils/search';
import { showToast } from '@/utils/ui';
import { matchHotkey } from './hotkey';

/**
 * キーボードイベント処理を管理するクラス
 */
export class KeyboardHandler {
  private onPaletteHide: () => void;
  private onPaletteOpen: () => void;
  private onRenderList: () => void;
  private onUpdateActive: () => void;
  private onExecuteEntry: (item: SiteEntry, shiftKey: boolean) => void;
  private onShowAutocomplete: (tag: string) => void;
  private onHideAutocomplete: () => void;
  private onBingSearch: () => void;

  constructor(handlers: {
    onPaletteHide: () => void;
    onPaletteOpen: () => void;
    onRenderList: () => void;
    onUpdateActive: () => void;
    onExecuteEntry: (item: SiteEntry, shiftKey: boolean) => void;
    onShowAutocomplete: (tag: string) => void;
    onHideAutocomplete: () => void;
    onBingSearch: () => void;
  }) {
    this.onPaletteHide = handlers.onPaletteHide;
    this.onPaletteOpen = handlers.onPaletteOpen;
    this.onRenderList = handlers.onRenderList;
    this.onUpdateActive = handlers.onUpdateActive;
    this.onExecuteEntry = handlers.onExecuteEntry;
    this.onShowAutocomplete = handlers.onShowAutocomplete;
    this.onHideAutocomplete = handlers.onHideAutocomplete;
    this.onBingSearch = handlers.onBingSearch;
  }

  /**
   * 入力キーボードイベントを処理する
   */
  onInputKey = (e: KeyboardEvent, currentItems: SiteEntry[], activeIndex: number, inputEl: HTMLInputElement, isAutocompleteVisible: boolean): number => {
    if (e.isComposing || e.keyCode === 229) {
      return activeIndex;
    }

    if (isAutocompleteVisible) {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.onHideAutocomplete();
        return activeIndex;
      }
      return activeIndex;
    }

    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      this.onBingSearch();
      return activeIndex;
    }

    if (e.key === 'Escape') { 
      this.onPaletteHide(); 
      return activeIndex; 
    }

    if (e.key === 'Tab' && !e.shiftKey && inputEl.value.trim() === '') {
      e.preventDefault();
      const allTags = getAllTags();
      if (allTags.length > 0) {
        inputEl.value = '#' + allTags[0] + ' ';
        this.onRenderList();
        this.onShowAutocomplete(allTags[0]);
      }
      return activeIndex;
    }

    if (!currentItems.length) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = inputEl.value.trim();
        if (!q) {
          showToast('検索キーワードを入力してください');
          return activeIndex;
        }
        // Bing検索を実行
        window.open(`https://www.bing.com/search?q=${encodeURIComponent(q)}`, '_blank');
      }
      return activeIndex;
    }

    let newActiveIndex = activeIndex;

    if (e.key === 'ArrowDown') { 
      e.preventDefault(); 
      newActiveIndex = (activeIndex + 1) % currentItems.length; 
      this.onUpdateActive(); 
    } else if (e.key === 'ArrowUp') { 
      e.preventDefault(); 
      newActiveIndex = (activeIndex - 1 + currentItems.length) % currentItems.length; 
      this.onUpdateActive(); 
    } else if (e.key === 'Enter') { 
      e.preventDefault(); 
      const item = currentItems[activeIndex]; 
      this.onExecuteEntry(item, e.shiftKey); 
    }

    return newActiveIndex;
  };

  /**
   * グローバルホットキーハンドラを更新する
   */
  updateHotkeyHandler = (e: KeyboardEvent, settings: any, onOpenPalette: () => void): void => {
    if (matchHotkey(e, settings.hotkeyPrimary) || matchHotkey(e, settings.hotkeySecondary)) {
      e.preventDefault();
      e.stopPropagation();
      onOpenPalette();
    }
  };

  /**
   * オートコンプリートキーボード処理
   */
  handleAutocompleteKeydown = (e: KeyboardEvent, autocompleteItems: any[], autocompleteIndex: number, isVisible: boolean): { newIndex: number; shouldHide: boolean } => {
    if (!isVisible) {
      return { newIndex: autocompleteIndex, shouldHide: false };
    }

    let newIndex = autocompleteIndex;
    let shouldHide = false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      newIndex = (autocompleteIndex + 1) % autocompleteItems.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      newIndex = (autocompleteIndex - 1 + autocompleteItems.length) % autocompleteItems.length;
    } else if (e.key === 'Enter' && autocompleteIndex >= 0) {
      e.preventDefault();
      // アイテム選択処理は呼び出し元に委ねる
    } else if (e.key === 'Escape') {
      shouldHide = true;
    }

    return { newIndex, shouldHide };
  };
}
