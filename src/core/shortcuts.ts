/**
 * キーボードショートカット定義
 */

// ショートカットカテゴリの型
export type ShortcutCategory = 'navigation' | 'search' | 'utility' | 'management';

// ショートカット実行結果の型
export interface ShortcutExecutionResult {
  success: boolean;
  error?: Error;
}

// ショートカット競合情報の型
export interface ShortcutConflict {
  shortcut: string;
  actions: string[];
}

// キーマッピングの型
type KeyMapping = Record<string, string>;

// カテゴリタイトルの型
type CategoryTitles = Record<ShortcutCategory, string>;

export interface ShortcutAction {
  id: string;
  name: string;
  description: string;
  keys: string[];
  handler: () => void | Promise<void>;
  category: ShortcutCategory;
}

// 定数
const KEY_MAP: KeyMapping = {
  ' ': 'Space',
  'ArrowUp': 'Up',
  'ArrowDown': 'Down',
  'ArrowLeft': 'Left',
  'ArrowRight': 'Right',
  'Escape': 'Esc'
};

const CATEGORY_TITLES: CategoryTitles = {
  navigation: '🧭 ナビゲーション',
  search: '🔍 検索',
  utility: '🛠️ ユーティリティ',
  management: '⚙️ 管理'
};

const HELP_HEADER = '=== 利用可能なショートカット ===\n\n';
const CONFLICTS_HEADER = '⚠️  衝突しているショートカット:\n';

/**
 * ショートカットマネージャー
 */
export class ShortcutManager {
  private shortcuts: Map<string, ShortcutAction> = new Map();
  private activeShortcuts: Set<string> = new Set();
  private keyToShortcutMap: Map<string, string[]> = new Map(); // キーからショートカットIDへのマップ

  /**
   * ショートカットを登録
   */
  register(shortcut: ShortcutAction): void {
    this.shortcuts.set(shortcut.id, shortcut);
    this.updateKeyToShortcutMap(shortcut);
  }

  /**
   * ショートカットを登録解除
   */
  unregister(id: string): void {
    const shortcut = this.shortcuts.get(id);
    if (shortcut) {
      this.removeShortcutFromKeyMap(shortcut);
      this.shortcuts.delete(id);
    }
  }

  /**
   * キーからショートカットへのマップを更新
   */
  private updateKeyToShortcutMap = (shortcut: ShortcutAction): void => {
    for (const key of shortcut.keys) {
      if (!this.keyToShortcutMap.has(key)) {
        this.keyToShortcutMap.set(key, []);
      }
      const shortcuts = this.keyToShortcutMap.get(key)!;
      if (!shortcuts.includes(shortcut.id)) {
        shortcuts.push(shortcut.id);
      }
    }
  };

  /**
   * キーマップからショートカットを削除
   */
  private removeShortcutFromKeyMap = (shortcut: ShortcutAction): void => {
    for (const key of shortcut.keys) {
      const shortcuts = this.keyToShortcutMap.get(key);
      if (shortcuts) {
        const index = shortcuts.indexOf(shortcut.id);
        if (index > -1) {
          shortcuts.splice(index, 1);
        }
        if (shortcuts.length === 0) {
          this.keyToShortcutMap.delete(key);
        }
      }
    }
  };

  /**
   * ショートカットを実行
   */
  async execute(id: string): Promise<ShortcutExecutionResult> {
    const shortcut = this.shortcuts.get(id);
    if (!shortcut) {
      return { success: false, error: new Error(`Shortcut not found: ${id}`) };
    }

    try {
      await shortcut.handler();
      return { success: true };
    } catch (error) {
      console.error(`[CommandPalette] Shortcut execution failed: ${id}`, error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * キーイベントを処理
   */
  handleKeydown(e: KeyboardEvent): boolean {
    // Ctrl/Cmd + キーの組み合わせをチェック
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      const key = this.normalizeKey(e);
      const comboKey = `${e.ctrlKey ? 'Ctrl' : 'Meta'}+${key}`;
      
      const shortcutIds = this.keyToShortcutMap.get(comboKey);
      if (shortcutIds && shortcutIds.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        // 最初のショートカットを実行
        this.execute(shortcutIds[0]);
        return true;
      }
    }

    return false;
  }

  /**
   * キーを正規化
   */
  private normalizeKey(e: KeyboardEvent): string {
    return KEY_MAP[e.key] || e.key;
  }

  /**
   * 利用可能なショートカットを取得
   */
  getAvailableShortcuts(): ShortcutAction[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * カテゴリ別のショートカットを取得
   */
  getShortcutsByCategory(category: ShortcutCategory): ShortcutAction[] {
    return Array.from(this.shortcuts.values()).filter(s => s.category === category);
  }

  /**
   * IDでショートカットを取得
   */
  getShortcutById(id: string): ShortcutAction | undefined {
    return this.shortcuts.get(id);
  }

  /**
   * キーでショートカットを取得
   */
  getShortcutsByKey(key: string): ShortcutAction[] {
    const shortcutIds = this.keyToShortcutMap.get(key) || [];
    return shortcutIds.map(id => this.shortcuts.get(id)).filter(Boolean) as ShortcutAction[];
  }

  /**
   * デフォルトショートカットを初期化
   */
  initializeDefaults(): void {
    this.registerNavigationShortcuts();
    this.registerSearchShortcuts();
    this.registerUtilityShortcuts();
    this.registerManagementShortcuts();
  }

  /**
   * ナビゲーション系ショートカットを登録
   */
  private registerNavigationShortcuts = (): void => {
    this.register({
      id: 'focus_input',
      name: '入力フィールドにフォーカス',
      description: '検索入力フィールドにカーソルを移動',
      keys: ['Ctrl+K', 'Meta+K'],
      handler: () => {
        const input = document.querySelector('input[type="text"]') as HTMLInputElement;
        if (input) {
          input.focus();
          input.select();
        }
      },
      category: 'navigation'
    });

    this.register({
      id: 'clear_input',
      name: '入力をクリア',
      description: '検索入力フィールドをクリア',
      keys: ['Ctrl+Shift+K', 'Meta+Shift+K'],
      handler: () => {
        const input = document.querySelector('input[type="text"]') as HTMLInputElement;
        if (input) {
          input.value = '';
          input.focus();
        }
      },
      category: 'navigation'
    });
  };

  /**
   * 検索系ショートカットを登録
   */
  private registerSearchShortcuts = (): void => {
    this.register({
      id: 'quick_search',
      name: 'クイック検索',
      description: '選択テキストで検索',
      keys: ['Ctrl+Shift+F', 'Meta+Shift+F'],
      handler: () => {
        const selection = window.getSelection()?.toString();
        if (selection) {
          const input = document.querySelector('input[type="text"]') as HTMLInputElement;
          if (input) {
            input.value = selection;
            input.focus();
            // 検索実行イベントをトリガー
            input.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'Enter',
              bubbles: true
            }));
          }
        }
      },
      category: 'search'
    });
  };

  /**
   * ユーティリティ系ショートカットを登録
   */
  private registerUtilityShortcuts = (): void => {
    this.register({
      id: 'toggle_theme',
      name: 'テーマ切替',
      description: 'ライト/ダークテーマを切り替え',
      keys: ['Ctrl+Shift+T', 'Meta+Shift+T'],
      handler: () => {
        document.documentElement.classList.toggle('dark-theme');
      },
      category: 'utility'
    });

    this.register({
      id: 'scroll_to_top',
      name: 'ページトップへスクロール',
      description: 'ページの先頭までスクロール',
      keys: ['Home'],
      handler: () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      category: 'utility'
    });

    this.register({
      id: 'scroll_to_bottom',
      name: 'ページ下部へスクロール',
      description: 'ページの末尾までスクロール',
      keys: ['End'],
      handler: () => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      },
      category: 'utility'
    });

    this.register({
      id: 'reload_page',
      name: 'ページ再読み込み',
      description: '現在のページを再読み込み',
      keys: ['F5', 'Ctrl+R', 'Meta+R'],
      handler: () => {
        location.reload();
      },
      category: 'utility'
    });
  };

  /**
   * 管理系ショートカットを登録
   */
  private registerManagementShortcuts = (): void => {
    this.register({
      id: 'open_manager',
      name: 'サイトマネージャー',
      description: 'サイトマネージャーを開く',
      keys: ['Ctrl+M', 'Meta+M'],
      handler: () => {
        // グローバル関数を呼び出し
        if ((window as any).openManager) {
          (window as any).openManager();
        }
      },
      category: 'management'
    });

    this.register({
      id: 'open_settings',
      name: '設定',
      description: '設定画面を開く',
      keys: ['Ctrl+,', 'Meta+,'],
      handler: () => {
        // グローバル関数を呼び出し
        if ((window as any).openSettings) {
          (window as any).openSettings();
        }
      },
      category: 'management'
    });
  };

  /**
   * ショートカットの競合をチェック
   */
  checkConflicts(): ShortcutConflict[] {
    const conflicts: ShortcutConflict[] = [];

    for (const [key, shortcutIds] of this.keyToShortcutMap.entries()) {
      if (shortcutIds.length > 1) {
        conflicts.push({ shortcut: key, actions: [...shortcutIds] });
      }
    }

    return conflicts;
  }

  /**
   * ショートカットのヘルプテキストを生成
   */
  generateHelpText(): string {
    let help = HELP_HEADER;

    // カテゴリ別にショートカットを表示
    for (const [category, title] of Object.entries(CATEGORY_TITLES)) {
      const shortcuts = this.getShortcutsByCategory(category as ShortcutCategory);
      if (shortcuts.length > 0) {
        help += this.generateCategoryHelp(title, shortcuts);
      }
    }

    // 競合するショートカットを表示
    const conflicts = this.checkConflicts();
    if (conflicts.length > 0) {
      help += this.generateConflictsHelp(conflicts);
    }

    return help;
  }

  /**
   * カテゴリ別のヘルプテキストを生成
   */
  private generateCategoryHelp = (title: string, shortcuts: ShortcutAction[]): string => {
    let categoryHelp = `${title}\n`;
    shortcuts.forEach(shortcut => {
      categoryHelp += `  ${shortcut.keys.join(', ')} - ${shortcut.name}\n`;
      categoryHelp += `    ${shortcut.description}\n`;
    });
    categoryHelp += '\n';
    return categoryHelp;
  };

  /**
   * 競合するショートカットのヘルプテキストを生成
   */
  private generateConflictsHelp = (conflicts: ShortcutConflict[]): string => {
    let conflictsHelp = CONFLICTS_HEADER;
    conflicts.forEach(conflict => {
      conflictsHelp += `  ${conflict.shortcut}: ${conflict.actions.join(', ')}\n`;
    });
    return conflictsHelp;
  };

  /**
   * すべてのショートカットをクリア
   */
  clearAll(): void {
    this.shortcuts.clear();
    this.activeShortcuts.clear();
    this.keyToShortcutMap.clear();
  }

  /**
   * ショートカットの統計情報を取得
   */
  getStats(): { total: number; byCategory: Record<ShortcutCategory, number> } {
    const byCategory: Record<ShortcutCategory, number> = {
      navigation: 0,
      search: 0,
      utility: 0,
      management: 0
    };

    for (const shortcut of this.shortcuts.values()) {
      byCategory[shortcut.category]++;
    }

    return {
      total: this.shortcuts.size,
      byCategory
    };
  }
}
