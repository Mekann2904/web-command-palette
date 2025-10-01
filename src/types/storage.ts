import { SiteEntry, SiteId } from './site';
import { Settings } from './settings';

// ストレージキーの型定義
export type StorageKey = 'sites' | 'settings' | 'favcache' | 'usage' | 'themes' | 'history';
export type StorageVersion = string; // 'v1.0.0' 形式

// ストレージデータの基本インターフェース
export interface BaseStorageData {
  version: StorageVersion;
  createdAt: number;
  updatedAt: number;
  migrated?: boolean;
}

// メインストレージデータインターフェース
export interface StorageData extends BaseStorageData {
  sites: SiteEntry[];
  settings: Settings;
  favcache: FaviconCache;
  usage: UsageCache;
  themes?: CustomThemeCache;
  history?: SearchHistoryCache;
  metadata?: StorageMetadata;
}

// ファビコンキャッシュインターフェース
export interface FaviconCache {
  [origin: string]: FaviconCacheEntry;
}

export interface FaviconCacheEntry {
  url: string;
  timestamp: number;
  etag?: string;
  lastModified?: string;
  expires?: number;
}

// 使用回数キャッシュインターフェース
export interface UsageCache {
  [siteId: string]: UsageCacheEntry;
}

export interface UsageCacheEntry {
  count: number;
  lastAccessed: number;
  accessHistory?: number[]; // 最近のアクセス時間の配列
  averageInterval?: number; // 平均アクセス間隔（ミリ秒）
}

// カスタムテーマキャッシュインターフェース
export interface CustomThemeCache {
  [themeId: string]: CustomThemeEntry;
}

export interface CustomThemeEntry {
  theme: any; // テーマオブジェクト
  createdAt: number;
  updatedAt: number;
  isBuiltIn: boolean;
}

// 検索履歴キャッシュインターフェース
export interface SearchHistoryCache {
  queries: SearchHistoryEntry[];
  maxEntries: number;
}

export interface SearchHistoryEntry {
  query: string;
  timestamp: number;
  resultCount: number;
  selectedSiteId?: SiteId;
}

// ストレージメタデータインターフェース
export interface StorageMetadata {
  totalSites: number;
  totalUsage: number;
  lastBackup?: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  dataIntegrityHash?: string;
}

// ストレージキー設定インターフェース
export interface StorageKeys {
  STORAGE_KEY: string;
  SETTINGS_KEY: string;
  FAVCACHE_KEY: string;
  USAGE_KEY: string;
  THEMES_KEY: string;
  HISTORY_KEY: string;
  METADATA_KEY: string;
  BACKUP_KEY: string;
}

// ストレージ操作結果のインターフェース
export interface StorageResult<T = any> {
  success: boolean;
  data?: T;
  error?: StorageError;
  metadata?: OperationMetadata;
}

export interface StorageError extends Error {
  code: StorageErrorCode;
  key?: string;
  operation?: StorageOperation;
}

export type StorageErrorCode =
  | 'QUOTA_EXCEEDED'
  | 'NOT_FOUND'
  | 'INVALID_DATA'
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'PARSE_ERROR'
  | 'MIGRATION_ERROR'
  | 'UNKNOWN_ERROR';

export type StorageOperation =
  | 'GET'
  | 'SET'
  | 'DELETE'
  | 'CLEAR'
  | 'MIGRATE'
  | 'BACKUP'
  | 'RESTORE';

export interface OperationMetadata {
  duration: number;
  timestamp: number;
  operation: StorageOperation;
  key?: string;
  size?: number;
}

// ストレージバックアップ関連のインターフェース
export interface StorageBackup {
  version: StorageVersion;
  timestamp: number;
  data: StorageData;
  checksum: string;
  compression?: string;
  encryption?: {
    algorithm: string;
    keyId?: string;
  };
}

export interface BackupOptions {
  includeMetadata?: boolean;
  includeCache?: boolean;
  compression?: boolean;
  encryption?: boolean;
  password?: string;
}

export interface RestoreOptions {
  mergeWithExisting?: boolean;
  preserveTimestamps?: boolean;
  validateData?: boolean;
  password?: string;
}

// ストレージマイグレーション関連のインターフェース
export interface StorageMigration {
  version: StorageVersion;
  description: string;
  up: (data: any) => Promise<StorageData>;
  down: (data: StorageData) => Promise<any>;
  dependencies?: StorageVersion[];
}

export interface MigrationResult {
  success: boolean;
  fromVersion: StorageVersion;
  toVersion: StorageVersion;
  errors?: string[];
  warnings?: string[];
  migratedItems?: string[];
}

// ストレージ統計情報のインターフェース
export interface StorageStats {
  totalSize: number;
  usedSize: number;
  availableSize: number;
  itemCounts: Record<StorageKey, number>;
  lastAccessTimes: Record<StorageKey, number>;
  cacheHitRates: Record<StorageKey, number>;
  operationCounts: Record<StorageOperation, number>;
  errorCounts: Record<StorageErrorCode, number>;
}

// ストレージイベントのインターフェース
export interface StorageEvent {
  type: StorageEventType;
  key: StorageKey;
  timestamp: number;
  oldValue?: any;
  newValue?: any;
  error?: StorageError;
}

export type StorageEventType =
  | 'CHANGE'
  | 'CLEAR'
  | 'ERROR'
  | 'MIGRATION_START'
  | 'MIGRATION_COMPLETE'
  | 'BACKUP_START'
  | 'BACKUP_COMPLETE'
  | 'RESTORE_START'
  | 'RESTORE_COMPLETE';

// ストレージ設定のインターフェース
export interface StorageConfig {
  version: StorageVersion;
  autoBackup: boolean;
  backupInterval: number; // ミリ秒
  maxBackups: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  cacheEnabled: boolean;
  cacheTTL: number; // ミリ秒
  maxCacheSize: number;
  dataValidation: boolean;
  autoMigration: boolean;
}

