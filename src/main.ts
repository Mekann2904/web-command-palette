import { SiteEntry, Settings } from '@/types';
import { AppState, DOMElements, AutocompleteState, createInitialState, createInitialDOMElements, createInitialAutocompleteState } from '@/core/state';
import { Palette } from '@/components/palette';
import { Autocomplete } from '@/components/autocomplete';
import { Manager } from '@/components/manager';
import { SettingsUI } from '@/components/settings';
import { PaletteCore } from '@/core/palette';
import { KeyboardHandler } from '@/core/keyboard';
import { setupGlobalHotkey, shouldAutoOpen, setGlobalHotkeyCallback, setPaletteOpenState } from '@/core/hotkey';
import { initializeStorage, getSites, setSites, pruneUsage } from '@/core/storage';
import { addSampleData } from '@/utils/test-data';
import { defaultSettings } from '@/constants';

// GM_* APIのグローバル宣言
declare const GM_registerMenuCommand: (name: string, callback: () => void) => void;

/**
 * アプリケーションメインクラス
 */
class CommandPaletteApp {
  private state: AppState;
  private dom: DOMElements;
  private autocompleteState: AutocompleteState;
  
  private palette: Palette;
  private autocomplete: Autocomplete;
  private manager: Manager;
  private settings: SettingsUI;
  private paletteCore: PaletteCore;
  private keyboardHandler: KeyboardHandler;

  constructor() {
    // 状態の初期化
    this.state = createInitialState();
    this.dom = createInitialDOMElements();
    this.autocompleteState = createInitialAutocompleteState();

    // コンポーネントの初期化
    this.palette = new Palette(this.state, this.dom, (item, shiftPressed) => this.executeEntry(item, shiftPressed));
    this.autocomplete = new Autocomplete(
      this.dom, 
      this.autocompleteState,
      () => this.renderList(),
      () => this.updateActive()
    );
    this.manager = new Manager(this.dom, () => this.renderList());
    this.settings = new SettingsUI(this.dom, () => this.applyTheme());
    this.paletteCore = new PaletteCore();
    this.keyboardHandler = new KeyboardHandler({
      onPaletteHide: () => this.hidePalette(),
      onPaletteOpen: () => this.openPalette(),
      onRenderList: () => this.renderList(),
      onUpdateActive: () => this.updateActive(),
      onExecuteEntry: (item, shiftKey) => this.executeEntry(item, shiftKey),
      onShowAutocomplete: (tag) => this.showAutocomplete(tag),
      onHideAutocomplete: () => this.hideAutocomplete(),
      onBingSearch: () => this.runBingSearch()
    });

    // グローバルアクセス用（既存コードとの互換性）
    (window as any).toastEl = this.dom.toastEl;
  }

  /**
   * パレットを開く
   */
  openPalette(): void {
    setPaletteOpenState(true);
    this.palette.openPalette();
    this.setupEventListeners();
  }

  /**
   * パレットを閉じる
   */
  hidePalette(): void {
    setPaletteOpenState(false);
    this.palette.hidePalette();
  }

  /**
   * テーマを適用する
   */
  applyTheme(): void {
    this.palette.applyTheme();
  }

  /**
   * リストをレンダリングする
   */
  renderList(): void {
    this.palette.renderList();
  }

  /**
   * アクティブなアイテムを更新する
   */
  updateActive(): void {
    this.palette.updateActive();
  }

  /**
   * エントリを実行する
   */
  executeEntry(item: SiteEntry, shiftPressed: boolean): void {
    this.paletteCore.setInputElement(this.dom.inputEl);
    this.paletteCore.executeEntry(item, shiftPressed);
    this.hidePalette();
  }

  /**
   * Bing検索を実行する
   */
  runBingSearch(): void {
    this.paletteCore.setInputElement(this.dom.inputEl);
    this.paletteCore.runBingSearchFromInput();
    this.hidePalette();
  }

  /**
   * オートコンプリートを表示
   */
  showAutocomplete(tag: string): void {
    this.autocomplete.showAutocomplete(tag);
  }

  /**
   * オートコンプリートを非表示
   */
  hideAutocomplete(): void {
    this.autocomplete.hideAutocomplete();
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    if (!this.dom.overlayEl || !this.dom.inputEl || !this.dom.hintEl) return;

    // オーバーレイクリックで閉じる
    this.dom.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.dom.overlayEl) this.hidePalette();
    });
    
    // 入力イベント
    this.dom.inputEl.addEventListener('keydown', (e) => {
      // 入力フィールド内のキーイベントは優先的に処理
      console.log('[Debug] Input keydown:', e.key, e.target);
      this.state.activeIndex = this.keyboardHandler.onInputKey(
        e,
        this.state.currentItems,
        this.state.activeIndex,
        this.dom.inputEl!,
        this.autocompleteState.isVisible
      );
    });
    
    this.dom.inputEl.addEventListener('input', () => this.renderList());
    
    // 入力フィールドのキーイベントがグローバルイベントに妨害されないようにする
    this.dom.inputEl.addEventListener('keydown', (e) => {
      // 入力フィールド内ではすべてのキーを許可
      e.stopPropagation();
    }, true);
    
    // ヒントエリアのクリックイベント
    this.dom.hintEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.id === 'vm-open-manager') {
        this.openManager();
      } else if (target.id === 'vm-open-settings') {
        this.openSettings();
      }
    });

    // オートコンプリートの構築（初回のみ）
    if (!this.dom.autocompleteEl) {
      this.autocomplete.buildAutocomplete();
    }
  }

  /**
   * マネージャを開く
   */
  openManager(): void {
    if (!this.dom.mgrOverlay) {
      this.manager.buildManager();
    }
    this.manager.openManager();
  }

  /**
   * 設定を開く
   */
  openSettings(): void {
    if (!this.dom.setOverlay) {
      this.settings.buildSettings();
    }
    this.settings.openSettings();
  }

  /**
   * 現在のページを追加
   */
  runAddCurrent(): void {
    const title = document.title || location.hostname;
    const url = location.href;
    const existing = getSites();
    const newSite = { 
      id: `site-${Math.random().toString(36).slice(2, 10)}`, 
      type: 'site' as const, 
      name: title, 
      url: url || '', 
      tags: [] 
    };
    setSites([...existing, newSite]);
    pruneUsage(new Set([...existing.map(s => s.id), newSite.id]));
    this.paletteCore.runAddCurrent();
    this.renderList();
  }

  /**
   * URLをコピー
   */
  copyUrl(): void {
    this.paletteCore.copyUrl();
  }

  /**
   * グローバルホットキーハンドラを更新
   */
  updateHotkeyHandler = (e: KeyboardEvent): void => {
    const settings = this.getSettings();
    this.keyboardHandler.updateHotkeyHandler(e, settings, () => this.openPalette());
  };

  /**
   * 設定を取得（暫定実装）
   */
  private getSettings(): Settings {
    try {
      return { ...defaultSettings, ...(window as any).GM_getValue?.('vm_sites_palette__settings_v2', {}) };
    } catch {
      return defaultSettings;
    }
  }

  /**
   * アプリケーションを初期化する
   */
  bootstrap(): void {
    try {
      // ストレージを初期化
      initializeStorage();
      
      // 設定を取得
      const settings = this.getSettings();
      
      // グローバルホットキーコールバックを設定
      setGlobalHotkeyCallback(() => this.openPalette());
      
      // グローバルホットキーを設定
      setupGlobalHotkey(settings);
      
      // メニューを登録
      if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('サイトマネージャを開く', () => this.openManager());
        GM_registerMenuCommand('設定', () => this.openSettings());
        GM_registerMenuCommand('現在のページを追加', () => this.runAddCurrent());
        GM_registerMenuCommand('URLをコピー', () => this.copyUrl());
        GM_registerMenuCommand('サンプルデータを追加', () => addSampleData());
      }
      
      // 自動オープンをチェック
      if (shouldAutoOpen()) {
        setTimeout(() => this.openPalette(), 120);
      }
      
      // 二重ハンドラを削除（main.tsのハンドラは不要になった）
      window.removeEventListener('keydown', this.updateHotkeyHandler, true);
    } catch (error) {
      console.error('[CommandPalette] Bootstrap error:', error);
    }
  }
}

// アプリケーションを起動
const app = new CommandPaletteApp();
app.bootstrap();
