# dist/script.user.js 複雑さ解消のための修正計画

## 概要
dist/script.user.jsは約4000行の単一ファイルであり、構造上の問題点、責務の分離不足、重複コード、可読性・保守性の問題、パフォーマンス問題、モジュール化の機会が特定されました。本計画では、既存のsrcディレクトリ構造を活かし、主に重複コードの削除と責務分離に焦点を当てた中規模のリファクタリングを行います。

## 現状分析

### 1. 構造上の問題点
- **単一ファイルへの機能集約**: 約4000行のコードが1ファイルに集約
- **関数型とオブジェクト指向の混在**: 一貫性のないコーディングスタイル
- **クラス構造**: 8つの主要クラス（VirtualScrollManager, Palette, Autocomplete, ManagerAutocomplete, Manager, SettingsUI, PaletteCore, KeyboardHandler, CommandPaletteApp）

### 2. 責務の分離不足
- **UIとロジックの密結合**: 各クラスがUI生成とビジネスロジックを混在
- **データアクセスの分散**: ストレージアクセスが複数箇所に分散
- **イベント処理の分散**: イベントリスナー設定が各クラスに分散

### 3. 重複・冗長なコード
- **イベントリスナー設定**: 25箇所のaddEventListener呼び出し
- **DOM要素取得**: 19箇所のquerySelector/querySelectorAll呼び出し
- **setTimeout使用**: 15箇所のマジックナンバー使用
- **タグソートロジック**: 複数クラスで重複

### 4. 既存のsrcディレクトリ構造の評価
- **良い点**: すでにモジュール化された構造が存在（components, core, utils, types, constants）
- **課題**: dist/script.user.jsがビルド結果であり、srcディレクトリの構造が反映されていない

## 優先順位付けされた改善項目

### 高優先度（影響が大きく、実行しやすい）
1. **イベントリスナー設定の共通化**
2. **DOM要素取得の共通化**
3. **setTimeoutの定数化**

### 中優先度（構造的改善）
4. **タグソートロジックの共通化**
5. **UI生成とイベント処理の分離**
6. **データアクセス層の統一**

### 低優先度（長期的な改善）
7. **仮想スクロールの最適化**
8. **テーマ管理の独立**

## 各改善項目の具体的な実装方法

### 1. イベントリスナー設定の共通化
**目的**: 25箇所に散在するaddEventListener呼び出しを共通化

**実装方法**:
```typescript
// src/utils/event-listeners.ts
export const EventListeners = {
  addClick: (element: Element | null, handler: () => void) => {
    element?.addEventListener('click', handler);
  },
  addKeydown: (element: Element | null, handler: (e: KeyboardEvent) => void) => {
    element?.addEventListener('keydown', handler);
  },
  addInput: (element: Element | null, handler: () => void) => {
    element?.addEventListener('input', handler);
  },
  // 他のイベントタイプも追加
};
```

**影響範囲**: 全クラスでのイベントリスナー設定
**リスク**: 低 - 既存の動作を変更しないラッパー関数

### 2. DOM要素取得の共通化
**目的**: 19箇所に散在するquerySelector呼び出しを共通化

**実装方法**:
```typescript
// src/utils/dom-selectors.ts
export const DOMSelectors = {
  byId: (parent: Element | Document, id: string) => 
    parent.querySelector(`#${id}`),
  byName: (parent: Element, name: string) => 
    parent.querySelectorAll(`[name="${name}"]`),
  byDataAttr: (parent: Element, attr: string) => 
    parent.querySelector(`[${attr}]`),
  // 設定画面用の特化セレクタ
  getSettingsElements: (setBox: Element) => ({
    closeBtn: DOMSelectors.byId(setBox, 'vs-close'),
    saveBtn: DOMSelectors.byId(setBox, 'vs-save'),
    // 他の設定要素
  }),
  // マネージャ画面用の特化セレクタ
  getManagerElements: (mgrBox: Element) => ({
    // マネージャ要素
  })
};
```

**影響範囲**: 全クラスでのDOM要素取得
**リスク**: 低 - 既存の動作を変更しないヘルパー関数

### 3. setTimeoutの定数化
**目的**: 15箇所のマジックナンバーを定数化

**実装方法**:
```typescript
// src/constants/timing.ts（既存を拡張）
export const TIMING = {
  // 既存の定数
  IMMEDIATE: 0,
  FOCUS_DELAY: 0,
  AUTO_OPEN_DELAY: 120,
  
  // 新しく追加する定数
  TOAST_HIDE_DELAY: 3000,
  INPUT_SPACE_DELAY: 0,
  AUTOCOMPLETE_HIDE_DELAY: 300,
  FOCUS_TRAP_DELAY: 0,
  OVERLAY_HIDE_DELAY: 200,
} as const;

// src/utils/timing.ts（既存を拡張）
export const TimingUtils = {
  setTimeout: (callback: () => void, delay: number) => 
    setTimeout(callback, delay),
  // 特定用途のタイマー関数
  hideToast: (callback: () => void) => 
    TimingUtils.setTimeout(callback, TIMING.TOAST_HIDE_DELAY),
  addInputSpace: (inputEl: HTMLInputElement) => 
    TimingUtils.setTimeout(() => {
      inputEl.value += ' ';
    }, TIMING.INPUT_SPACE_DELAY),
};
```

**影響範囲**: 全クラスでのsetTimeout使用
**リスク**: 低 - タイミング値を定数化するのみ

### 4. タグソートロジックの共通化
**目的**: 複数クラスで重複するタグソートロジックを共通化

**実装方法**:
```typescript
// src/utils/tag-utils.ts（既存を拡張）
export const TagUtils = {
  // 既存の関数
  sortTagsByHierarchy: (tags: string[]): string[] => {
    return tags.sort((a, b) => {
      const aDepth = (a.match(/\//g) || []).length;
      const bDepth = (b.match(/\//g) || []).length;
      if (aDepth !== bDepth) return aDepth - bDepth;
      return a.localeCompare(b);
    });
  },
  
  // 新しく追加する関数
  filterTagsByQuery: (tags: string[], query: string): string[] => {
    // タグフィルタリングロジック
  },
  countTagUsage: (entries: SiteEntry[]): Record<string, number> => {
    // タグ使用回数計算ロジック
  },
  createTagObjects: (tags: string[], counts: Record<string, number>) => {
    // タグオブジェクト生成ロジック
  }
};
```

**影響範囲**: Autocomplete, ManagerAutocomplete, Paletteクラス
**リスク**: 中 - タグ関連の動作に影響する可能性

### 5. UI生成とイベント処理の分離
**目的**: 各クラスのUI生成とイベント処理を分離

**実装方法**:
```typescript
// src/components/ui-builders.ts
export class PaletteUIBuilder {
  buildMainUI(dom: DOMElements): void {
    // メインUI構築ロジック
  }
  buildListItem(entry: SiteEntry, index: number): HTMLElement {
    // リストアイテム構築ロジック
  }
}

// src/components/event-handlers.ts
export class PaletteEventHandler {
  constructor(private dom: DOMElements, private uiBuilder: PaletteUIBuilder) {}
  
  setupMainEvents(): void {
    // メインイベント設定ロジック
  }
  setupListEvents(): void {
    // リストイベント設定ロジック
  }
}

// src/components/palette.ts（リファクタリング後）
export class Palette {
  private uiBuilder: PaletteUIBuilder;
  private eventHandler: PaletteEventHandler;
  
  constructor(state: AppState, dom: DOMElements, onExecuteEntry: Function) {
    this.uiBuilder = new PaletteUIBuilder();
    this.eventHandler = new PaletteEventHandler(dom, this.uiBuilder);
    // 他の初期化
  }
  
  createPaletteUI(): void {
    this.uiBuilder.buildMainUI(this.dom);
    this.eventHandler.setupMainEvents();
  }
}
```

**影響範囲**: 全UIコンポーネントクラス
**リスク**: 中 - UIとイベントの連携に影響する可能性

### 6. データアクセス層の統一
**目的**: 分散しているストレージアクセスを統一

**実装方法**:
```typescript
// src/services/data-service.ts
export class DataService {
  static getSites(): SiteEntry[] {
    // サイト取得ロジック（既存のgetSitesを移動）
  }
  
  static setSites(sites: SiteEntry[]): void {
    // サイト設定ロジック（既存のsetSitesを移動）
  }
  
  static getSettings(): Settings {
    // 設定取得ロジック（既存のgetSettingsを移動）
  }
  
  static setSettings(settings: Settings): void {
    // 設定保存ロジック（既存のsetSettingsを移動）
  }
}

// 各クラスでの使用例
export class Palette {
  getEntries(): SiteEntry[] {
    return DataService.getSites();
  }
}
```

**影響範囲**: 全クラスでのストレージアクセス
**リスク**: 中 - データアクセスに影響する可能性

## 変更による影響範囲とリスク評価

### 高リスク項目
- **タグソートロジックの共通化**: タグ関連の動作に影響する可能性
- **UI生成とイベント処理の分離**: UIとイベントの連携に影響する可能性
- **データアクセス層の統一**: データアクセスに影響する可能性

### 中リスク項目
- **仮想スクロールの最適化**: パフォーマンスに影響する可能性
- **テーマ管理の独立**: テーマ適用に影響する可能性

### 低リスク項目
- **イベントリスナー設定の共通化**: 既存の動作を変更しないラッパー関数
- **DOM要素取得の共通化**: 既存の動作を変更しないヘルパー関数
- **setTimeoutの定数化**: タイミング値を定数化するのみ

## 実装のステップバイステップ計画

### フェーズ1: 低リスク項目の実装（1-2週間）
1. **イベントリスナー設定の共通化**
   - src/utils/event-listeners.tsを作成
   - 各クラスでEventListenersを使用するように修正
   - テストを実施

2. **DOM要素取得の共通化**
   - src/utils/dom-selectors.tsを作成
   - 各クラスでDOMSelectorsを使用するように修正
   - テストを実施

3. **setTimeoutの定数化**
   - src/constants/timing.tsを拡張
   - src/utils/timing.tsを拡張
   - 各クラスで定数化された値を使用するように修正
   - テストを実施

### フェーズ2: 中リスク項目の実装（2-3週間）
4. **タグソートロジックの共通化**
   - src/utils/tag-utils.tsを拡張
   - Autocomplete, ManagerAutocomplete, PaletteクラスでTagUtilsを使用するように修正
   - テストを実施

5. **データアクセス層の統一**
   - src/services/data-service.tsを作成
   - 各クラスでDataServiceを使用するように修正
   - テストを実施

### フェーズ3: 高リスク項目の実装（3-4週間）
6. **UI生成とイベント処理の分離**
   - src/components/ui-builders.tsを作成
   - src/components/event-handlers.tsを作成
   - 各UIコンポーネントクラスをリファクタリング
   - テストを実施

### フェーズ4: 最適化と仕上げ（1-2週間）
7. **仮想スクロールの最適化**
   - 仮想スクロールのパフォーマンスを改善
   - テストを実施

8. **テーマ管理の独立**
   - src/components/theme-manager.tsを作成
   - テーマ適用ロジックを独立
   - テストを実施

9. **最終テストとドキュメント更新**
   - 全体テストを実施
   - ドキュメントを更新
   - コードレビューを実施

## 期待される効果

### 短期的効果
- **コードの重複が減り、保守性が向上**
- **新機能追加時の修正箇所が減少**
- **コードの意図が明確になり、可読性が向上**

### 長期的効果
- **バグの発生箇所を特定しやすくなる**
- **テストコードの記述が容易になる**
- **パフォーマンスの改善**
- **将来的な機能拡張が容易になる**

## 成功の指標
- **コード行数の削減**: 目標15-20%の削減
- **重複コードの削減**: 目標80%の重複コードを削除
- **関数の平均長の短縮**: 目標30%の短縮
- **テストカバレッジの向上**: 目標70%以上のカバレッジ
- **ビルド時間の短縮**: 目標10%の短縮

## 結論
本計画では、dist/script.user.jsの複雑さを解消するために、既存のsrcディレクトリ構造を活かし、主に重複コードの削除と責務分離に焦点を当てた中規模のリファクタリングを提案します。低リスク項目から段階的に実施することで、リスクを最小限に抑えつつ、効果的な改善を実現できます。このリファクタリングにより、コードの保守性、可読性、拡張性が大幅に向上し、将来的な機能追加やバグ修正が容易になることが期待されます。