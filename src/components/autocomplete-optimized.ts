import { DOMElements, AutocompleteState } from '@/core/state';
import { PaletteAutocomplete } from './base';

/**
 * オートコンプリートUIを管理するクラス（最適化版）
 * 基底クラスを使用してコードの重複を削減
 */
export class Autocomplete {
  private paletteAutocomplete: PaletteAutocomplete;

  constructor(dom: DOMElements, state: AutocompleteState, onRenderList: () => void, onUpdateActive: () => void) {
    this.paletteAutocomplete = new PaletteAutocomplete(dom, state, onRenderList, onUpdateActive);
  }

  /**
   * オートコンプリートを構築
   */
  buildAutocomplete(): void {
    // 基底クラスで自動的に構築される
  }

  /**
   * オートコンプリート入力処理
   */
  handleAutocompleteInput = (): void => {
    // 基底クラスで自動的に処理される
  };

  /**
   * オートコンプリートキーボード処理
   */
  handleAutocompleteKeydown = (e: KeyboardEvent): void => {
    // 基底クラスで自動的に処理される
  };

  /**
   * オートコンプリートを表示
   */
  showAutocomplete(query: string): void {
    // 基底クラスのメソッドを呼び出す
    (this.paletteAutocomplete as any).show(query);
  }

  /**
   * オートコンプリートを非表示
   */
  hideAutocomplete(): void {
    this.paletteAutocomplete.cleanup();
  }

  /**
   * オートコンプリートアクティブ更新
   */
  updateAutocompleteActive(): void {
    // 基底クラスで自動的に処理される
  }

  /**
   * オートコンプリートアイテム選択
   */
  private selectAutocompleteItem(tag: { name: string; count: number }): void {
    // 基底クラスで自動的に処理される
  }

  /**
   * 新規タグを作成
   */
  private createNewTag(tagName: string): void {
    // 基底クラスで自動的に処理される
  }

  /**
   * エントリを取得する（正規化済み）
   */
  private getEntries(): any[] {
    try {
      const getSites = require('@/core/storage').getSites;
      return getSites();
    } catch {
      return [];
    }
  }
}