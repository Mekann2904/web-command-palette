/**
 * 最適化された定数のエクスポート
 * パフォーマンスとアクセシビリティを向上させる
 */

// 従来の定数（後方互換性のため）
export * from './defaults';
export * from './keys';

// 最適化された定数
export * from './timing-optimized';
export * from './themes-optimized';

// 内部使用のためのインポート
import {
  DEBOUNCE_TIMING,
  NETWORK_TIMING
} from './timing-optimized';

import {
  CSS_VARIABLES,
  darkTheme
} from './themes-optimized';

// 型定義
export type { 
  AnimationSpeed, 
  DebounceType, 
  InteractionType, 
  FeedbackType, 
  LayoutType, 
  NetworkType 
} from './timing-optimized';

export type { 
  ThemeType, 
  CSSVariable, 
  ColorShade 
} from './themes-optimized';

// 最適化された定数の便利なエイリアス
export { 
  ANIMATION_TIMING, 
  DEBOUNCE_TIMING, 
  INTERACTION_TIMING, 
  FEEDBACK_TIMING, 
  LAYOUT_TIMING, 
  NETWORK_TIMING, 
  PERFORMANCE, 
  ACCESSIBILITY_TIMING, 
  RESPONSIVE_TIMING, 
  DEBUG_TIMING 
} from './timing-optimized';

export { 
  TimingUtils, 
  TimingValidation 
} from './timing-optimized';

export { 
  CSS_VARIABLES, 
  COLOR_PALETTE, 
  HIGH_CONTRAST_COLORS, 
  ACCESSIBILITY, 
  THEME_PERFORMANCE, 
  darkTheme, 
  lightTheme, 
  ThemeUtils, 
  ThemeValidation 
} from './themes-optimized';

// パフォーマンス最適化のための便利な関数
export const ConstantsUtils = {
  /**
   * デバイスに応じたタイミングを取得
   */
  getDeviceOptimizedTiming() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // モバイルデバイスでは少し長めのデバウンス時間を設定
      return {
        ...DEBOUNCE_TIMING,
        INPUT: DEBOUNCE_TIMING.INPUT * 1.5 as any,
        RESIZE: DEBOUNCE_TIMING.RESIZE * 1.2 as any,
        SCROLL: DEBOUNCE_TIMING.SCROLL * 1.5 as any
      };
    }
    
    return DEBOUNCE_TIMING;
  },

  /**
   * ネットワーク状態に応じたタイミングを取得
   */
  getNetworkOptimizedTiming() {
    if (!navigator.onLine) {
      // オフライン時はタイムアウトを延長
      return {
        ...NETWORK_TIMING,
        REQUEST_TIMEOUT: NETWORK_TIMING.REQUEST_TIMEOUT * 2 as any,
        RETRY_DELAY: NETWORK_TIMING.RETRY_DELAY * 2 as any
      };
    }
    
    // 接続速度が遅い場合はタイムアウトを延長
    if ((navigator as any).connection) {
      const connection = (navigator as any).connection;
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        return {
          ...NETWORK_TIMING,
          REQUEST_TIMEOUT: NETWORK_TIMING.REQUEST_TIMEOUT * 1.5 as any,
          RETRY_DELAY: NETWORK_TIMING.RETRY_DELAY * 1.5 as any
        };
      }
    }
    
    return NETWORK_TIMING;
  },

  /**
   * パフォーマンス設定に応じたテーマを取得
   */
  getPerformanceOptimizedTheme(): 'dark' | 'light' {
    // 低パフォーマンスデバイスではライトテーマを推奨
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) {
      return 'light';
    }
    
    // バッテリー残量が少ない場合はダークテーマを推奨
    if ((navigator as any).getBattery) {
      (navigator as any).getBattery().then((battery: any) => {
        if (battery.level < 0.2) {
          return 'dark';
        }
      });
    }
    
    // システム設定を優先
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },

  /**
   * アクセシビリティ設定に応じたテーマを取得
   */
  getAccessibilityOptimizedTheme(): 'dark' | 'light' {
    // 高コントラストモードが有効な場合はダークテーマを推奨
    if (window.matchMedia && window.matchMedia('(prefers-contrast: high)').matches) {
      return 'dark';
    }
    
    // 色覚異常のユーザーにはハイコントラストなテーマを推奨
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: high-contrast)').matches) {
      return 'dark';
    }
    
    return this.getPerformanceOptimizedTheme();
  },

  /**
   * 環境に応じた最適な定数を取得
   */
  getOptimizedConstants() {
    return {
      timing: this.getDeviceOptimizedTiming(),
      network: this.getNetworkOptimizedTiming(),
      theme: this.getAccessibilityOptimizedTheme()
    };
  }
};

// 定数の検証
export const ConstantsValidation = {
  /**
   * 定数値が有効範囲内かチェック
   */
  validateTimingValue(value: number, type: string): boolean {
    const validRanges: Record<string, [number, number]> = {
      'INPUT': [50, 500],
      'RESIZE': [100, 500],
      'SCROLL': [16, 200],
      'VIRTUAL_SCROLL': [16, 50]
    };
    
    const range = validRanges[type];
    return range ? value >= range[0] && value <= range[1] : true;
  },

  /**
   * カラー値が有効かチェック
   */
  validateColorValue(color: string): boolean {
    // 簡易的な色検証（実際の実装ではライブラリを使用）
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    const rgbRegex = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/;
    const rgbaRegex = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/;
    
    return hexRegex.test(color) || rgbRegex.test(color) || rgbaRegex.test(color);
  },

  /**
   * CSS変数名が有効かチェック
   */
  validateCSSVariableName(name: string): boolean {
    const cssVarRegex = /^--[a-zA-Z0-9-_]+$/;
    return cssVarRegex.test(name);
  }
};

// 定数のマイグレーション（後方互換性のため）
export const MigrationUtils = {
  /**
   * 旧形式のタイミング定数を新しい形式に変換
   */
  migrateTimingConstants(oldConstants: Record<string, number>) {
    const migrated: any = {};
    
    // 旧形式から新形式へのマッピング
    const mapping: Record<string, string> = {
      'INPUT_DEBOUNCE': 'INPUT',
      'RESIZE_DEBOUNCE': 'RESIZE',
      'SCROLL_DEBOUNCE': 'SCROLL',
      'VIRTUAL_SCROLL_DEBOUNCE': 'VIRTUAL_SCROLL'
    };
    
    Object.entries(mapping).forEach(([oldKey, newKey]) => {
      if (oldConstants[oldKey] !== undefined) {
        migrated[newKey] = oldConstants[oldKey];
      }
    });
    
    return migrated;
  },

  /**
   * 旧形式のテーマを新しい形式に変換
   */
  migrateThemeConstants(oldTheme: Record<string, string>) {
    // 旧形式から新形式への変換ロジック
    const migrated: any = {};
    
    // CSS変数名のマッピング
    const cssVarMapping: Record<string, string> = {
      '--panel-bg': CSS_VARIABLES.PANEL_BG,
      '--panel-text': CSS_VARIABLES.PANEL_TEXT,
      '--input-bg': CSS_VARIABLES.INPUT_BG,
      '--input-text': CSS_VARIABLES.INPUT_TEXT
    };
    
    Object.entries(oldTheme).forEach(([oldKey, value]) => {
      const newKey = cssVarMapping[oldKey];
      if (newKey) {
        migrated[newKey] = value;
      }
    });
    
    return migrated;
  }
};