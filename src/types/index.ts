/**
 * 型定義の統合エクスポート
 *
 * このファイルはすべての型定義を一元管理し、
 * 整理された形で外部に提供します。
 */

// ============================================================================
// 基本型定義
// ============================================================================

// サイト関連の型
export * from './site';

// 設定関連の型
export * from './settings';

// ストレージ関連の型
export * from './storage';

// グローバルAPI関連の型
export * from './globals';

// ============================================================================
// 共用体型とユーティリティ型
// ============================================================================

// 一般的な共用体型
export type Nullable<T> = T | null;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

// イベント関連の型
export type EventHandler<T = any> = (event: T) => void;
export type EventListener<T = any> = EventHandler<T>;
export type AsyncCallback<T = any> = (data: T) => Promise<void>;

// ID関連の型
export type ID = string;
export type Timestamp = number;

// ============================================================================
// 型ガードとユーティリティ関数
// ============================================================================

// 型ガード関数
export const isSiteEntry = (obj: any): obj is import('./site').SiteEntry => {
  return obj && typeof obj === 'object' &&
         typeof obj.id === 'string' &&
         typeof obj.name === 'string' &&
         typeof obj.url === 'string' &&
         Array.isArray(obj.tags);
};

export const isSettings = (obj: any): obj is import('./settings').Settings => {
  return obj && typeof obj === 'object' &&
         typeof obj.hotkeyPrimary === 'string' &&
         typeof obj.hotkeySecondary === 'string' &&
         typeof obj.theme === 'string';
};

export const isValidStorageKey = (key: string): key is import('./storage').StorageKey => {
  return ['sites', 'settings', 'favcache', 'usage', 'themes', 'history'].includes(key);
};

// ============================================================================
// 型定数と列挙型
// ============================================================================

// アプリケーションバージョン
export const APP_VERSION = '1.0.0' as const;

// ストレージバージョン
export const STORAGE_VERSION = '2.0.0' as const;

// デフォルト値
export const DEFAULT_TIMEOUT = 5000 as const;
export const MAX_RETRY_ATTEMPTS = 3 as const;

// ============================================================================
// 再エクスポートの整理（カテゴリ別）
// ============================================================================

// サイト関連
export type {
  SiteEntry,
  SiteEntryRaw,
  CreateSiteEntry,
  UpdateSiteEntry,
  AutocompleteItem,
  SiteSearchFilter,
  SiteSearchResult,
  SiteStats,
  SiteValidationResult,
  SiteOperationResult
} from './site';

// 設定関連
export type {
  Settings,
  Theme,
  ExtendedTheme,
  Themes,
  ThemeSettings,
  SettingsValidationResult,
  SettingsMigration,
  SettingsExport,
  SettingsChangeEvent
} from './settings';

// ストレージ関連
export type {
  StorageData,
  FaviconCache,
  UsageCache,
  StorageKeys,
  StorageResult,
  StorageError,
  StorageBackup,
  BackupOptions,
  RestoreOptions,
  StorageMigration,
  MigrationResult,
  StorageStats,
  StorageEvent,
  StorageConfig
} from './storage';

// グローバルAPI関連
export type {
  GMStorage,
  GMMenu,
  GMTabs,
  GMRequest,
  GMRequestDetails,
  GMResponse,
  GMClipboard,
  GMInfo,
  GreaseMonkeyAPI,
  GlobalVariables,
  GlobalFunctions
} from './globals';

// ============================================================================
// 非推奨の型（後方互換性のため）
// ============================================================================

/**
 * @deprecated 代わりに SiteEntry を使用してください
 */
export type LegacySiteEntry = import('./site').SiteEntry;

/**
 * @deprecated 代わりに Settings を使用してください
 */
export type LegacySettings = import('./settings').Settings;

/**
 * @deprecated 代わりに StorageData を使用してください
 */
export type LegacyStorageData = import('./storage').StorageData;
