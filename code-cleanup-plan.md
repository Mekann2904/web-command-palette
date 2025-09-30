# コードクリーニング計画

## 概要
現在の動作やUIは変更せず、コードの保守性と可読性を向上させることを目的としたクリーニング作業を行います。

## 主な問題点の分析

### 1. イベントリスナーの重複
- 各コンポーネントで同様のイベントリスナー設定が繰り返し記述されている
- 特にクリック、キーダウン、マウスイベントの設定パターンが重複している

### 2. DOM要素の取得パターンの重複
- querySelector/querySelectorAllの使用が全体に散在している
- 特に設定画面やマネージャー画面でのDOM要素取得が冗長

### 3. setTimeoutのマジックナンバー
- `setTimeout(..., 0)` や `setTimeout(..., 120)` などのマジックナンバーが複数箇所で使用されている
- 遅延処理の意図が不明確

### 4. タグソートロジックの重複
- `src/components/autocomplete.ts`, `src/components/manager-autocomplete.ts`, `src/components/palette.ts` で同じタグソートロジックが重複している

### 5. コンポーネントの責務の曖昧さ
- 一部のコンポーネントが複数の責務を担っている
- UI生成、イベント処理、データ管理が混在している

## クリーニング計画

### 1. イベントリスナーの共通化
**新しいユーティリティファイル**: `src/utils/events.ts`
```typescript
// イベントリスナー設定の共通化
export const addClickListener = (element: Element | null, handler: () => void) => {
  element?.addEventListener('click', handler);
};

export const addKeydownListener = (element: Element | null, handler: (e: KeyboardEvent) => void) => {
  element?.addEventListener('keydown', handler);
};

export const addInputListener = (element: Element | null, handler: () => void) => {
  element?.addEventListener('input', handler);
};

// オートコンプリート用の特殊なイベント設定
export const setupAutocompleteEvents = (inputEl: HTMLInputElement, autocompleteEl: HTMLElement, onHide: () => void) => {
  inputEl.addEventListener('blur', (e) => {
    const to = e.relatedTarget as Node;
    const insideAuto = to && autocompleteEl.contains(to);
    setTimeout(() => {
      if (!insideAuto && !autocompleteEl.matches(':hover')) {
        onHide();
      }
    }, 0);
  });

  autocompleteEl.addEventListener('mousedown', (e) => {
    e.preventDefault();
    inputEl.focus();
  });
};
```

### 2. DOM要素取得の共通化
**新しいユーティリティファイル**: `src/utils/dom-helpers.ts`
```typescript
// DOM要素取得の共通化
export const getElementById = (parent: Element | Document, id: string): HTMLElement | null => {
  return parent.querySelector(`#${id}`);
};

export const getElementByDataAttribute = (parent: Element, attribute: string): HTMLElement | null => {
  return parent.querySelector(`[${attribute}]`);
};

export const getElementsByName = (parent: Element, name: string): NodeListOf<Element> => {
  return parent.querySelectorAll(`[name="${name}"]`);
};

// 設定画面用のDOM要素取得
export const getSettingsElements = (setBox: Element) => ({
  closeBtn: getElementById(setBox, 'vs-close'),
  saveBtn: getElementById(setBox, 'vs-save'),
  resetBtn: getElementById(setBox, 'vs-reset'),
  clearFavBtn: getElementById(setBox, 'vs-clear-fav'),
  hotkey1Input: getElementById(setBox, 'vs-hotkey1') as HTMLInputElement,
  hotkey2Input: getElementById(setBox, 'vs-hotkey2') as HTMLInputElement,
  accentInput: getElementById(setBox, 'vs-accent') as HTMLInputElement,
  accentText: getElementById(setBox, 'vs-accent-text') as HTMLInputElement,
  blocklistInput: getElementById(setBox, 'vs-blocklist') as HTMLTextAreaElement,
  autoOpenInput: getElementById(setBox, 'vs-auto-open') as HTMLTextAreaElement,
  enterInputs: getElementsByName(setBox, 'vs-enter'),
  themeInputs: getElementsByName(setBox, 'vs-theme')
});
```

### 3. setTimeoutの共通化と定数化
**新しい定数ファイル**: `src/constants/timing.ts`
```typescript
// タイミング関連の定数
export const TIMING = {
  IMMEDIATE: 0,
  FOCUS_DELAY: 0,
  AUTO_OPEN_DELAY: 120,
  ANIMATION_OFFSET: 60,
  TOAST_DURATION: 3000,
  URL_REVOKE_DELAY: 2000,
  BLUR_CHECK_DELAY: 0,
  INPUT_SPACE_DELAY: 0
} as const;
```

**新しいユーティリティファイル**: `src/utils/timing.ts`
```typescript
import { TIMING } from '@/constants/timing';

// タイミング関連のユーティリティ
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const setImmediateTimeout = (callback: () => void): number => {
  return setTimeout(callback, TIMING.IMMEDIATE);
};

export const setAutoOpenTimeout = (callback: () => void): number => {
  return setTimeout(callback, TIMING.AUTO_OPEN_DELAY);
};

export const addInputSpace = (inputEl: HTMLInputElement): void => {
  setTimeout(() => {
    inputEl.value += ' ';
  }, TIMING.INPUT_SPACE_DELAY);
};
```

### 4. タグソートロジックの共通化
**新しいユーティリティファイル**: `src/utils/tag-sort.ts`
```typescript
// タグソートロジックの共通化
export const sortTagsByHierarchy = (tags: string[]): string[] => {
  return tags.sort((a, b) => {
    const aDepth = (a.match(/\//g) || []).length;
    const bDepth = (b.match(/\//g) || []).length;
    if (aDepth !== bDepth) return aDepth - bDepth;
    return a.localeCompare(b);
  });
};
```

### 5. コンポーネントの責務分離
- **UI生成**: 各コンポーネントのUI生成ロジックを別の関数に分離
- **イベント処理**: イベントハンドラを専門のクラスや関数に分離
- **データ管理**: データ操作ロジックをサービス層に分離

### 6. 命名規則の統一
- 関数名: 動詞から始める (例: `createButton`, `handleClick`)
- 変数名: 名詞を使用し、意味が明確になるようにする (例: `inputElement`, `isAutocompleteVisible`)
- 定数名: 大文字のスネークケース (例: `DEFAULT_TIMEOUT`, `ANIMATION_DURATION`)

### 7. 型定義の強化
- 任意の型 (`any`) の使用を減らし、具体的な型定義を使用
- イベントハンドラの引数や戻り値の型を明確化
- ユーティリティ関数の入出力の型を厳密に定義

### 8. 不要なコードの削除
- 使用されていないインポート文の削除
- 重複したコメントや古いコメントの整理
- デッドコードの削除

## 実行順序
1. イベントリスナーの共通化
2. DOM要素取得の共通化
3. setTimeoutの共通化と定数化
4. タグソートロジックの重複排除
5. 各コンポーネントの責務分離
6. 命名規則の統一
7. 型定義の強化
8. 不要なコードの削除

## 期待される効果
- コードの重複が減り、保守性が向上
- 新機能追加時の修正箇所が減少
- コードの意図が明確になり、可読性が向上
- バグの発生箇所を特定しやすくなる
- テストコードの記述が容易になる