# サイトマネージャのタグオートコンプリート機能実装計画

## 概要
サイトマネージャのタグ入力フィールドにオートコンプリート機能を追加して、既存タグを簡単に選択できるようにする。

## 実装方針

### 1. ManagerAutocompleteクラスの作成
- 既存の`Autocomplete`クラスを参考に、サイトマネージャ専用のオートコンプリート機能を実装
- タグ入力フィールドに特化した機能を提供
- 階層タグ（例: "work/project"）のサポート

### 2. 主要機能
- 既存タグのサジェスト表示
- 部分一致検索
- 階層タグの視覚的表示
- 新規タグの作成提案
- キーボード操作対応（上下キー、Enter、Escape）
- タグの使用頻度表示

### 3. 実装詳細

#### 3.1 ManagerAutocompleteクラスの構造
```typescript
export class ManagerAutocomplete {
  private dom: DOMElements;
  private state: ManagerAutocompleteState;
  private tagInput: HTMLInputElement;
  private onTagSelect: (tag: string) => void;
  
  constructor(dom: DOMElements, tagInput: HTMLInputElement, onTagSelect: (tag: string) => void);
  
  // オートコンプリートUIの構築
  buildAutocomplete(): void;
  
  // イベントハンドラの設定
  setupEventListeners(): void;
  
  // タグ候補の表示
  showTagSuggestions(query: string): void;
  
  // タグ候補の非表示
  hideTagSuggestions(): void;
  
  // タグの選択
  selectTag(tag: string): void;
  
  // 新規タグの作成
  createNewTag(tagName: string): void;
}
```

#### 3.2 状態管理
```typescript
interface ManagerAutocompleteState {
  items: TagSuggestion[];
  index: number;
  isVisible: boolean;
}

interface TagSuggestion {
  name: string;
  count: number;
  depth: number;
  parentPath?: string;
}
```

#### 3.3 タグ入力フィールドのイベント処理
- `input`イベント: 入力内容に応じてタグ候補を更新
- `keydown`イベント: キーボード操作を処理
- `blur`イベント: フォーカスが外れた場合の処理

#### 3.4 タグ候補のフィルタリング
- 部分一致検索
- 階層タグの親子関係を考慮した検索
- 使用頻度によるソート

#### 3.5 UIデザイン
- サイトマネージャのテーマに合わせたスタイル
- 階層タグの視覚的表現（インデント、親パス表示）
- タグ使用頻度の表示

### 4. Managerクラスとの統合
- `addSiteRow`メソッドでタグ入力フィールドにオートコンプリートを適用
- 既存のタグ入力処理との互換性を維持

### 5. 実装手順
1. ManagerAutocompleteクラスの作成
2. タグ候補の取得とフィルタリング機能の実装
3. UIの構築とスタイルの適用
4. イベントハンドリングの実装
5. Managerクラスとの統合
6. テストと動作確認

## コード例

### ManagerAutocompleteクラスの基本構造
```typescript
import { DOMElements } from '@/core/state';
import { getSites } from '@/core/storage';
import { getAllTags } from '@/utils/search';
import { escapeHtml } from '@/utils/string';

export class ManagerAutocomplete {
  private dom: DOMElements;
  private state: ManagerAutocompleteState;
  private tagInput: HTMLInputElement;
  private autocompleteEl: HTMLDivElement;
  private onTagSelect: (tag: string) => void;

  constructor(dom: DOMElements, tagInput: HTMLInputElement, onTagSelect: (tag: string) => void) {
    this.dom = dom;
    this.tagInput = tagInput;
    this.onTagSelect = onTagSelect;
    this.state = {
      items: [],
      index: -1,
      isVisible: false
    };
    
    this.buildAutocomplete();
    this.setupEventListeners();
  }

  buildAutocomplete(): void {
    // オートコンプリートUIの構築
    // スタイルの適用
    // DOMへの追加
  }

  setupEventListeners(): void {
    // イベントリスナーの設定
    this.tagInput.addEventListener('input', this.handleInput);
    this.tagInput.addEventListener('keydown', this.handleKeydown);
    this.tagInput.addEventListener('blur', this.handleBlur);
  }

  handleInput = (): void => {
    // 入力内容に応じてタグ候補を表示
  };

  handleKeydown = (e: KeyboardEvent): void => {
    // キーボード操作の処理
  };

  handleBlur = (): void => {
    // フォーカスが外れた場合の処理
  };

  showTagSuggestions(query: string): void {
    // タグ候補の表示処理
  };

  hideTagSuggestions(): void {
    // タグ候補の非表示処理
  };

  selectTag(tag: string): void {
    // タグの選択処理
  };

  createNewTag(tagName: string): void {
    // 新規タグの作成処理
  }
}
```

### Managerクラスへの統合
```typescript
// addSiteRowメソッドの修正
addSiteRow(data: any): void {
  if (!this.dom.siteBodyEl) return;
  
  const tr = document.createElement('tr');
  if (data.id) tr.dataset.entryId = data.id;
  tr.innerHTML = `
    <td class="drag">⋮⋮</td>
    <td><input type="text" data-field="name" value="${escapeHtml(data.name || '')}"/></td>
    <td><input type="text" data-field="url" placeholder="https://example.com/" value="${escapeHtml(data.url || '')}"/></td>
    <td><input type="text" data-field="tags" placeholder="カンマ区切り" value="${escapeHtml((data.tags || []).join(', '))}"/></td>
    <td class="row-btns">
      <button class="btn" data-up>↑</button>
      <button class="btn" data-down>↓</button>
      <button class="btn" data-test>テスト</button>
      <button class="btn danger" data-del>削除</button>
    </td>`;

  const urlInput = tr.querySelector('input[data-field="url"]') as HTMLInputElement;
  const tagsInput = tr.querySelector('input[data-field="tags"]') as HTMLInputElement;
  
  // タグ入力フィールドにオートコンプリートを適用
  if (tagsInput) {
    new ManagerAutocomplete(this.dom, tagsInput, (tag: string) => {
      // タグ選択時の処理
      this.handleTagSelect(tagsInput, tag);
    });
  }
  
  // 既存のイベントリスナー設定
  tr.querySelector('[data-up]')?.addEventListener('click', ()=> this.moveRow(tr, -1, this.dom.siteBodyEl!));
  tr.querySelector('[data-down]')?.addEventListener('click', ()=> this.moveRow(tr, +1, this.dom.siteBodyEl!));
  tr.querySelector('[data-del]')?.addEventListener('click', ()=> { tr.remove(); });
  tr.querySelector('[data-test]')?.addEventListener('click', ()=> {
    const u = urlInput?.value.trim();
    if (u) window.open(u.includes('%s') ? u.replace(/%s/g, encodeURIComponent('test')) : u, '_blank');
  });

  this.dom.siteBodyEl.appendChild(tr);
}

handleTagSelect(input: HTMLInputElement, tag: string): void {
  // タグ選択時の処理
  const currentTags = input.value.split(/[,\s]+/).filter(Boolean);
  if (!currentTags.includes(tag)) {
    currentTags.push(tag);
    input.value = currentTags.join(', ');
  }
  input.focus();
}
```

## 期待される効果
- タグ入力の効率化
- タグ名のタイプミス削減
- 階層タグの視覚的な理解促進
- 既存タグの再利用促進
- タグ管理の全体的一貫性向上