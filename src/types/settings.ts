// ホットキーの型定義
export type HotkeyString = string; // 'Meta+KeyP' 形式の文字列
export type EnterOpensBehavior = 'current' | 'newtab';
export type ThemeType = 'dark' | 'light' | 'auto' | 'system';

// CSSカスタムプロパティの型定義
export type CSSCustomProperty =
  | '--overlay-bg'
  | '--panel-bg'
  | '--panel-text'
  | '--panel-shadow'
  | '--input-bg'
  | '--input-text'
  | '--input-placeholder'
  | '--border-color'
  | '--muted'
  | '--item-bg-alt'
  | '--item-active'
  | '--hint-bg'
  | '--list-scroll-thumb'
  | '--list-scroll-track'
  | '--command-badge-bg'
  | '--tag-bg'
  | '--tag-text'
  | '--tag-suggestion-bg'
  | '--autocomplete-bg'
  | '--autocomplete-border'
  | '--toast-bg'
  | '--toast-text';

// 検索設定の型定義
export interface SearchSettings {
  fuzzySearch: boolean;
  searchHistory: boolean;
  maxResults: number;
  searchTimeout: number;
}

// UI設定の型定義
export interface UISettings {
  animationDuration: number;
  showHints: boolean;
  showTags: boolean;
  maxItems: number;
  itemHeight: number;
}

// パフォーマンス設定の型定義
export interface PerformanceSettings {
  cacheSize: number;
  debounceDelay: number;
  virtualScrollThreshold: number;
  preloadFavicons: boolean;
}

// 設定インターフェース
export interface Settings {
  // 基本設定
  hotkeyPrimary: HotkeyString;
  hotkeySecondary: HotkeyString;
  enterOpens: EnterOpensBehavior;
  blocklist: string;
  theme: ThemeType;
  accentColor: string;
  autoOpenUrls: string[];
  
  // 拡張設定（オプションで後方互換性を維持）
  search?: SearchSettings;
  ui?: UISettings;
  performance?: PerformanceSettings;
  
  // 互換性のための古いプロパティ（非推奨）
  /** @deprecated search.fuzzySearch を使用してください */
  fuzzySearch?: boolean;
  /** @deprecated ui.maxItems を使用してください */
  maxResults?: number;
}

// テーマインターフェース
export type Theme = {
  [K in CSSCustomProperty]: string;
};

// 拡張テーマインターフェース
export interface ExtendedTheme extends Theme {
  name: string;
  description?: string;
  author?: string;
  version?: string;
  customProperties?: Record<string, string>;
}

// テーマコレクション
export interface Themes {
  dark: Theme;
  light: Theme;
  [key: string]: Theme;
}

// テーマ設定の型定義
export interface ThemeSettings {
  current: ThemeType;
  customThemes: Record<string, ExtendedTheme>;
  enableTransitions: boolean;
  transitionDuration: number;
}

// 設定バリデーション結果
export interface SettingsValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// 設定マイグレーションの型定義
export interface SettingsMigration {
  version: string;
  description: string;
  migrate: (oldSettings: any) => Settings;
}

// 設定エクスポート/インポートの型定義
export interface SettingsExport {
  version: string;
  timestamp: number;
  settings: Settings;
  customThemes?: Record<string, ExtendedTheme>;
}

// 設定変更イベントの型定義
export interface SettingsChangeEvent {
  key: keyof Settings;
  oldValue: any;
  newValue: any;
  timestamp: number;
}
