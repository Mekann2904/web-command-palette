/**
 * キーボードショートカット定義
 */

export interface ShortcutAction {
  id: string;
  name: string;
  description: string;
  keys: string[];
  handler: () => void | Promise<void>;
  category: 'navigation' | 'search' | 'utility' | 'management';
}

/**
 * ショートカットマネージャー
 */
export class ShortcutManager {
  private shortcuts: Map<string, ShortcutAction> = new Map();
  private activeShortcuts: Set<string> = new Set();

  /**
   * ショートカットを登録
   */
  register(shortcut: ShortcutAction): void {
    this.shortcuts.set(shortcut.id, shortcut);
  }

  /**
   * ショートカットを登録解除
   */
  unregister(id: string): void {
    this.shortcuts.delete(id);
  }

  /**
   * ショートカットを実行
   */
  async execute(id: string): Promise<boolean> {
    const shortcut = this.shortcuts.get(id);
    if (!shortcut) return false;

    try {
      await shortcut.handler();
      return true;
    } catch (error) {
      console.error(`[CommandPalette] Shortcut execution failed: ${id}`, error);
      return false;
    }
  }

  /**
   * キーイベントを処理
   */
  handleKeydown(e: KeyboardEvent): boolean {
    const key = this.normalizeKey(e);
    let handled = false;

    // Ctrl/Cmd + キーの組み合わせをチェック
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      const comboKey = `${e.ctrlKey ? 'Ctrl' : 'Meta'}+${key}`;
      
      for (const shortcut of this.shortcuts.values()) {
        if (shortcut.keys.includes(comboKey)) {
          e.preventDefault();
          e.stopPropagation();
          this.execute(shortcut.id);
          handled = true;
          break;
        }
      }
    }

    return handled;
  }

  /**
   * キーを正規化
   */
  private normalizeKey(e: KeyboardEvent): string {
    // 特殊キーのマッピング
    const keyMap: Record<string, string> = {
      ' ': 'Space',
      'ArrowUp': 'Up',
      'ArrowDown': 'Down',
      'ArrowLeft': 'Left',
      'ArrowRight': 'Right',
      'Escape': 'Esc'
    };

    return keyMap[e.key] || e.key;
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
  getShortcutsByCategory(category: ShortcutAction['category']): ShortcutAction[] {
    return Array.from(this.shortcuts.values()).filter(s => s.category === category);
  }

  /**
   * デフォルトショートカットを初期化
   */
  initializeDefaults(): void {
    // ナビゲーション系
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

    // 検索系
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

    // ユーティリティ系
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

    // 管理系
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
  }

  /**
   * ショートカットの競合をチェック
   */
  checkConflicts(): Array<{ shortcut: string; actions: string[] }> {
    const conflicts: Array<{ shortcut: string; actions: string[] }> = [];
    const keyMap = new Map<string, string[]>();

    for (const shortcut of this.shortcuts.values()) {
      for (const key of shortcut.keys) {
        if (!keyMap.has(key)) {
          keyMap.set(key, [shortcut.id]);
        } else {
          keyMap.get(key)!.push(shortcut.id);
        }
      }
    }

    for (const [key, actions] of keyMap.entries()) {
      if (actions.length > 1) {
        conflicts.push({ shortcut: key, actions });
      }
    }

    return conflicts;
  }

  /**
   * ショートカットのヘルプテキストを生成
   */
  generateHelpText(): string {
    const categories = {
      navigation: '🧭 ナビゲーション',
      search: '🔍 検索',
      utility: '🛠️ ユーティリティ',
      management: '⚙️ 管理'
    };

    let help = '=== 利用可能なショートカット ===\n\n';

    for (const [category, title] of Object.entries(categories)) {
      const shortcuts = this.getShortcutsByCategory(category as ShortcutAction['category']);
      if (shortcuts.length > 0) {
        help += `${title}\n`;
        shortcuts.forEach(shortcut => {
          help += `  ${shortcut.keys.join(', ')} - ${shortcut.name}\n`;
          help += `    ${shortcut.description}\n`;
        });
        help += '\n';
      }
    }

    const conflicts = this.checkConflicts();
    if (conflicts.length > 0) {
      help += '⚠️  衝突しているショートカット:\n';
      conflicts.forEach(conflict => {
        help += `  ${conflict.shortcut}: ${conflict.actions.join(', ')}\n`;
      });
    }

    return help;
  }
}
