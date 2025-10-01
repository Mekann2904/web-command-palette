// サイトエントリの型定義
export type SiteType = 'site' | 'bookmark' | 'history' | 'custom';
export type SiteId = string; // 'site-1234567890-abcdef' 形式
export type Tag = string; // タグ文字列

// URLの型定義
export type URLString = string; // 有効なURL文字列
export type URLTemplate = string; // 'https://example.com/search?q=%s' 形式のテンプレート

// サイトエントリの基本インターフェース
export interface BaseSiteEntry {
  id: SiteId;
  type: SiteType;
  name: string;
  url: URLString | URLTemplate;
  tags: Tag[];
  createdAt: number;
  updatedAt: number;
  lastAccessed?: number;
  accessCount: number;
  favicon?: string;
  description?: string;
}

// 完全なサイトエントリインターフェース
export interface SiteEntry {
  // 基本プロパティ（既存コードとの互換性のため）
  id: SiteId;
  type: SiteType;
  name: string;
  url: URLString | URLTemplate;
  tags: Tag[];
  
  // 追加プロパティ（オプションで後方互換性を維持）
  createdAt?: number;
  updatedAt?: number;
  lastAccessed?: number;
  accessCount?: number;
  favicon?: string;
  description?: string;
  
  // 拡張プロパティ
  category?: string;
  priority?: number;
  isActive?: boolean;
  metadata?: Record<string, any>;
  
  // 検索関連
  searchTerms?: string[];
  relevanceScore?: number;
  
  // UI関連
  color?: string;
  icon?: string;
  customCSS?: string;
}

// 生データ（インポート/エクスポート用）のサイトエントリ
export interface SiteEntryRaw {
  id?: string;
  type?: string;
  name: string;
  url: string;
  tags?: string | string[];
  createdAt?: number;
  updatedAt?: number;
  lastAccessed?: number;
  accessCount?: number;
  favicon?: string;
  description?: string;
  category?: string;
  priority?: number;
  isActive?: boolean;
  metadata?: Record<string, any>;
  color?: string;
  icon?: string;
  customCSS?: string;
}

// サイトエントリの作成用インターフェース
export interface CreateSiteEntry {
  name: string;
  url: URLString | URLTemplate;
  tags?: Tag[];
  description?: string;
  category?: string;
  priority?: number;
  color?: string;
  icon?: string;
  customCSS?: string;
  metadata?: Record<string, any>;
}

// サイトエントリの更新用インターフェース
export interface UpdateSiteEntry extends Partial<CreateSiteEntry> {
  lastAccessed?: number;
  accessCount?: number;
  favicon?: string;
  isActive?: boolean;
}

// オートコンプリートアイテムの基本インターフェース
export interface BaseAutocompleteItem {
  name: string;
  count: number;
  type: 'tag' | 'site' | 'category' | 'recent';
}

// タグオートコンプリートアイテム
export interface TagAutocompleteItem extends BaseAutocompleteItem {
  type: 'tag';
  tag: Tag;
  relatedTags?: Tag[];
}

// サイトオートコンプリートアイテム
export interface SiteAutocompleteItem extends BaseAutocompleteItem {
  type: 'site';
  siteId: SiteId;
  url: URLString | URLTemplate;
  favicon?: string;
}

// カテゴリオートコンプリートアイテム
export interface CategoryAutocompleteItem extends BaseAutocompleteItem {
  type: 'category';
  category: string;
  siteCount: number;
}

// 最近使用したアイテム
export interface RecentAutocompleteItem extends BaseAutocompleteItem {
  type: 'recent';
  lastAccessed: number;
  siteId: SiteId;
}

// オートコンプリートアイテムの共用体
export type AutocompleteItem =
  | TagAutocompleteItem
  | SiteAutocompleteItem
  | CategoryAutocompleteItem
  | RecentAutocompleteItem;

// サイト検索フィルターのインターフェース
export interface SiteSearchFilter {
  query?: string;
  tags?: Tag[];
  category?: string;
  type?: SiteType;
  dateRange?: {
    start: number;
    end: number;
  };
  minAccessCount?: number;
  isActive?: boolean;
}

// サイト検索結果のインターフェース
export interface SiteSearchResult {
  sites: SiteEntry[];
  totalCount: number;
  hasMore: boolean;
  facets: {
    tags: Record<Tag, number>;
    categories: Record<string, number>;
    types: Record<SiteType, number>;
  };
  query: string;
  duration: number;
}

// サイト統計情報のインターフェース
export interface SiteStats {
  totalSites: number;
  totalTags: number;
  totalCategories: number;
  mostAccessedSites: SiteEntry[];
  mostUsedTags: Array<{ tag: Tag; count: number }>;
  recentlyAdded: SiteEntry[];
  recentlyAccessed: SiteEntry[];
  accessByDay: Array<{ date: string; count: number }>;
  accessByCategory: Record<string, number>;
}

// サイトエクスポート/インポートの型定義
export interface SiteExport {
  version: string;
  timestamp: number;
  sites: SiteEntryRaw[];
  metadata?: {
    totalSites: number;
    exportedBy?: string;
    description?: string;
  };
}

// サイトバリデーション結果
export interface SiteValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  normalizedSite?: SiteEntry;
}

// サイト操作結果
export interface SiteOperationResult<T = SiteEntry> {
  success: boolean;
  data?: T;
  error?: Error;
  message?: string;
}
