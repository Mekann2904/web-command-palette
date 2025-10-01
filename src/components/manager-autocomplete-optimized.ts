import { DOMElements } from '@/core/state';
import { ManagerAutocomplete as BaseManagerAutocomplete } from './base';

/**
 * サイトマネージャのタグ入力フィールド用オートコンプリート機能を管理するクラス（最適化版）
 * 基底クラスを使用してコードの重複を削減
 */
export class ManagerAutocomplete {
  private managerAutocomplete: BaseManagerAutocomplete;

  constructor(dom: DOMElements, tagInput: HTMLInputElement, onTagSelect: (tag: string) => void) {
    this.managerAutocomplete = new BaseManagerAutocomplete(dom, tagInput, onTagSelect);
  }

  /**
   * オートコンプリートUIを構築
   */
  buildAutocomplete(): void {
    // 基底クラスで自動的に構築される
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners(): void {
    // 基底クラスで自動的に設定される
  }

  /**
   * 入力イベント処理
   */
  handleInput = (): void => {
    // 基底クラスで自動的に処理される
  };

  /**
   * キーボードイベント処理
   */
  handleKeydown = (e: KeyboardEvent): void => {
    // 基底クラスで自動的に処理される
  };

  /**
   * フォーカスイベント処理
   */
  handleBlur = (e: FocusEvent): void => {
    // 基底クラスで自動的に処理される
  };

  /**
   * タグ候補を表示
   */
  showTagSuggestions(query: string): void {
    // 基底クラスのメソッドを呼び出す
    (this.managerAutocomplete as any).show(query);
  }

  /**
   * タグ候補をレンダリング
   */
  renderTagSuggestions(): void {
    // 基底クラスで自動的に処理される
  }

  /**
   * タグ候補を非表示
   */
  hideTagSuggestions(): void {
    this.managerAutocomplete.hide();
  }

  /**
   * アクティブな候補を更新
   */
  updateActive(): void {
    // 基底クラスで自動的に処理される
  }

  /**
   * タグを選択
   */
  selectTag(tag: string): void {
    // 基底クラスで自動的に処理される
  }
}