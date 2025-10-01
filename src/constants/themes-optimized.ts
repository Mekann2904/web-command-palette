/**
 * 最適化されたテーマ定義
 * アクセシビリティ、パフォーマンス、保守性を向上させる
 */

import { Themes } from '@/types';

// CSS変数の命名規則を統一
export const CSS_VARIABLES = {
  // レイアウト関連
  OVERLAY_BG: '--overlay-bg',
  PANEL_BG: '--panel-bg',
  PANEL_TEXT: '--panel-text',
  PANEL_SHADOW: '--panel-shadow',
  
  // 入力関連
  INPUT_BG: '--input-bg',
  INPUT_TEXT: '--input-text',
  INPUT_PLACEHOLDER: '--input-placeholder',
  
  // インタラクション関連
  ITEM_ACTIVE: '--item-active',
  ITEM_BG_ALT: '--item-bg-alt',
  BORDER_COLOR: '--border-color',
  
  // 状態関連
  MUTED: '--muted',
  HINT_BG: '--hint-bg',
  
  // スクロール関連
  LIST_SCROLL_THUMB: '--list-scroll-thumb',
  LIST_SCROLL_TRACK: '--list-scroll-track',
  
  // コンポーネント関連
  COMMAND_BADGE_BG: '--command-badge-bg',
  TAG_BG: '--tag-bg',
  TAG_TEXT: '--tag-text',
  TAG_SUGGESTION_BG: '--tag-suggestion-bg',
  
  // オートコンプリート関連
  AUTOCOMPLETE_BG: '--autocomplete-bg',
  AUTOCOMPLETE_BORDER: '--autocomplete-border',
  
  // トースト関連
  TOAST_BG: '--toast-bg',
  TOAST_TEXT: '--toast-text'
} as const;

// アクセシビリティ関連の定数
export const ACCESSIBILITY = {
  // WCAGコントラスト比要件
  MIN_CONTRAST_RATIO_NORMAL: 4.5,  // 通常テキスト
  MIN_CONTRAST_RATIO_LARGE: 3.0,  // 大きなテキスト（18pt以上）
  MIN_CONTRAST_RATIO_GRAPHICS: 3.0, // グラフィック
  
  // 色のコントラスト比
  MIN_COLOR_CONTRAST: 3.0,
  
  // フォントサイズ
  MIN_FONT_SIZE: 16, // px
  LARGE_FONT_SIZE: 18, // px
  
  // インタラクション領域
  MIN_TOUCH_TARGET_SIZE: 44, // px
  MIN_CLICK_TARGET_SIZE: 24, // px
  
  // フォーカス表示
  FOCUS_OUTLINE_WIDTH: 2, // px
  FOCUS_OUTLINE_OFFSET: 2, // px
  
  // アニメーション
  PREFER_REDUCED_MOTION: 'prefer-reduced-motion',
  ANIMATION_DURATION_MAX: 0.3 // 秒
} as const;

// パフォーマンス関連の定数
export const THEME_PERFORMANCE = {
  // CSS変数の数を制限（パフォーマンス向上）
  MAX_CSS_VARIABLES: 50,
  
  // トランジションの最適化
  TRANSITION_DURATION_FAST: 0.1, // 秒
  TRANSITION_DURATION_NORMAL: 0.2, // 秒
  TRANSITION_DURATION_SLOW: 0.3, // 秒
  
  // 変更を監視するプロパティ（パフォーマンス向上）
  WATCHED_PROPERTIES: [
    'color',
    'background-color',
    'border-color',
    'opacity',
    'transform'
  ],
  
  // will-changeの使用を制限
  MAX_WILL_CHANGE_ELEMENTS: 10,
  WILL_CHANGE_DURATION: 200 // ms
} as const;

// カラーパレット（アクセシビリティ対応）
export const COLOR_PALETTE = {
  // 基本色
  PRIMARY: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554'
  },
  
  // 中性色
  GRAY: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#030712'
  },
  
  // 状態色
  SUCCESS: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    950: '#052e16'
  },
  
  WARNING: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03'
  },
  
  ERROR: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a'
  }
} as const;

// 高コントラスト色（アクセシビリティ対応）
export const HIGH_CONTRAST_COLORS = {
  // ダークテーマ用
  DARK: {
    text: '#ffffff',
    background: '#000000',
    primary: '#60a5fa',
    secondary: '#9ca3af',
    success: '#4ade80',
    warning: '#fbbf24',
    error: '#f87171'
  },
  
  // ライトテーマ用
  LIGHT: {
    text: '#000000',
    background: '#ffffff',
    primary: '#1d4ed8',
    secondary: '#4b5563',
    success: '#16a34a',
    warning: '#d97706',
    error: '#dc2626'
  }
} as const;

// ダークテーマ（最適化版）
export const darkTheme = {
  [CSS_VARIABLES.OVERLAY_BG]: 'rgba(0, 0, 0, 0.5)', // 不透明度を上げてコントラスト向上
  [CSS_VARIABLES.PANEL_BG]: COLOR_PALETTE.GRAY[900],
  [CSS_VARIABLES.PANEL_TEXT]: COLOR_PALETTE.GRAY[50],
  [CSS_VARIABLES.PANEL_SHADOW]: '0 10px 40px rgba(0, 0, 0, 0.6)',
  
  [CSS_VARIABLES.INPUT_BG]: COLOR_PALETTE.GRAY[800],
  [CSS_VARIABLES.INPUT_TEXT]: COLOR_PALETTE.GRAY[100],
  [CSS_VARIABLES.INPUT_PLACEHOLDER]: COLOR_PALETTE.GRAY[400],
  
  [CSS_VARIABLES.BORDER_COLOR]: COLOR_PALETTE.GRAY[700],
  [CSS_VARIABLES.MUTED]: COLOR_PALETTE.GRAY[400],
  [CSS_VARIABLES.ITEM_BG_ALT]: 'rgba(255, 255, 255, 0.05)',
  [CSS_VARIABLES.ITEM_ACTIVE]: COLOR_PALETTE.GRAY[700],
  [CSS_VARIABLES.HINT_BG]: COLOR_PALETTE.GRAY[800],
  
  [CSS_VARIABLES.LIST_SCROLL_THUMB]: COLOR_PALETTE.GRAY[600],
  [CSS_VARIABLES.LIST_SCROLL_TRACK]: 'rgba(255, 255, 255, 0.1)',
  
  [CSS_VARIABLES.COMMAND_BADGE_BG]: 'rgba(255, 255, 255, 0.15)',
  [CSS_VARIABLES.TAG_BG]: 'rgba(79, 70, 229, 0.25)',
  [CSS_VARIABLES.TAG_TEXT]: COLOR_PALETTE.PRIMARY[300],
  [CSS_VARIABLES.TAG_SUGGESTION_BG]: 'rgba(79, 70, 229, 0.15)',
  
  [CSS_VARIABLES.AUTOCOMPLETE_BG]: COLOR_PALETTE.GRAY[800],
  [CSS_VARIABLES.AUTOCOMPLETE_BORDER]: COLOR_PALETTE.GRAY[700],
  
  [CSS_VARIABLES.TOAST_BG]: 'rgba(31, 41, 55, 0.95)',
  [CSS_VARIABLES.TOAST_TEXT]: COLOR_PALETTE.GRAY[50],
  
  // 高コントラストモード用
  '--high-contrast-text': HIGH_CONTRAST_COLORS.DARK.text,
  '--high-contrast-background': HIGH_CONTRAST_COLORS.DARK.background,
  '--high-contrast-border': HIGH_CONTRAST_COLORS.DARK.secondary,
  
  // アクセシビリティ用
  '--focus-outline': `2px solid ${COLOR_PALETTE.PRIMARY[500]}`,
  '--focus-outline-offset': '2px',
  
  // パフォーマンス最適化用
  '--transition-fast': `${THEME_PERFORMANCE.TRANSITION_DURATION_FAST}s ease`,
  '--transition-normal': `${THEME_PERFORMANCE.TRANSITION_DURATION_NORMAL}s ease`,
  '--transition-slow': `${THEME_PERFORMANCE.TRANSITION_DURATION_SLOW}s ease`
} as const;

// ライトテーマ（最適化版）
export const lightTheme = {
  [CSS_VARIABLES.OVERLAY_BG]: 'rgba(255, 255, 255, 0.7)', // 不透明度を上げてコントラスト向上
  [CSS_VARIABLES.PANEL_BG]: COLOR_PALETTE.GRAY[50],
  [CSS_VARIABLES.PANEL_TEXT]: COLOR_PALETTE.GRAY[900],
  [CSS_VARIABLES.PANEL_SHADOW]: '0 10px 36px rgba(0, 0, 0, 0.2)',
  
  [CSS_VARIABLES.INPUT_BG]: COLOR_PALETTE.GRAY[50],
  [CSS_VARIABLES.INPUT_TEXT]: COLOR_PALETTE.GRAY[900],
  [CSS_VARIABLES.INPUT_PLACEHOLDER]: COLOR_PALETTE.GRAY[500],
  
  [CSS_VARIABLES.BORDER_COLOR]: COLOR_PALETTE.GRAY[300],
  [CSS_VARIABLES.MUTED]: COLOR_PALETTE.GRAY[600],
  [CSS_VARIABLES.ITEM_BG_ALT]: 'rgba(0, 0, 0, 0.03)',
  [CSS_VARIABLES.ITEM_ACTIVE]: 'rgba(37, 99, 235, 0.15)',
  [CSS_VARIABLES.HINT_BG]: COLOR_PALETTE.GRAY[100],
  
  [CSS_VARIABLES.LIST_SCROLL_THUMB]: COLOR_PALETTE.PRIMARY[400],
  [CSS_VARIABLES.LIST_SCROLL_TRACK]: 'rgba(37, 99, 235, 0.1)',
  
  [CSS_VARIABLES.COMMAND_BADGE_BG]: 'rgba(37, 99, 235, 0.2)',
  [CSS_VARIABLES.TAG_BG]: 'rgba(37, 99, 235, 0.15)',
  [CSS_VARIABLES.TAG_TEXT]: COLOR_PALETTE.PRIMARY[700],
  [CSS_VARIABLES.TAG_SUGGESTION_BG]: 'rgba(37, 99, 235, 0.1)',
  
  [CSS_VARIABLES.AUTOCOMPLETE_BG]: COLOR_PALETTE.GRAY[50],
  [CSS_VARIABLES.AUTOCOMPLETE_BORDER]: COLOR_PALETTE.GRAY[300],
  
  [CSS_VARIABLES.TOAST_BG]: 'rgba(255, 255, 255, 0.95)',
  [CSS_VARIABLES.TOAST_TEXT]: COLOR_PALETTE.GRAY[900],
  
  // 高コントラストモード用
  '--high-contrast-text': HIGH_CONTRAST_COLORS.LIGHT.text,
  '--high-contrast-background': HIGH_CONTRAST_COLORS.LIGHT.background,
  '--high-contrast-border': HIGH_CONTRAST_COLORS.LIGHT.secondary,
  
  // アクセシビリティ用
  '--focus-outline': `2px solid ${COLOR_PALETTE.PRIMARY[600]}`,
  '--focus-outline-offset': '2px',
  
  // パフォーマンス最適化用
  '--transition-fast': `${THEME_PERFORMANCE.TRANSITION_DURATION_FAST}s ease`,
  '--transition-normal': `${THEME_PERFORMANCE.TRANSITION_DURATION_NORMAL}s ease`,
  '--transition-slow': `${THEME_PERFORMANCE.TRANSITION_DURATION_SLOW}s ease`
} as const;

// テーマオブジェクト（最適化版）
export const themes: Themes = {
  dark: darkTheme,
  light: lightTheme
} as const;

// テーマユーティリティ
export const ThemeUtils = {
  /**
   * テーマを適用する
   */
  applyTheme(theme: 'dark' | 'light', element: HTMLElement = document.documentElement): void {
    const themeObject = themes[theme];
    Object.entries(themeObject).forEach(([property, value]) => {
      element.style.setProperty(property, value);
    });
    
    // テーマ属性を設定
    element.setAttribute('data-theme', theme);
  },

  /**
   * 現在のテーマを取得
   */
  getCurrentTheme(): 'dark' | 'light' {
    return document.documentElement.getAttribute('data-theme') as 'dark' | 'light' || 'dark';
  },

  /**
   * システムテーマ設定を検出
   */
  getSystemTheme(): 'dark' | 'light' {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  },

  /**
   * テーマを切り替える
   */
  toggleTheme(): 'dark' | 'light' {
    const currentTheme = this.getCurrentTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
    return newTheme;
  },

  /**
   * 高コントラストモードを有効化
   */
  enableHighContrast(element: HTMLElement = document.documentElement): void {
    element.style.setProperty('--force-high-contrast', '1');
    element.setAttribute('data-high-contrast', 'true');
  },

  /**
   * 高コントラストモードを無効化
   */
  disableHighContrast(element: HTMLElement = document.documentElement): void {
    element.style.removeProperty('--force-high-contrast');
    element.removeAttribute('data-high-contrast');
  },

  /**
   * 低モーション設定を有効化
   */
  enableReducedMotion(element: HTMLElement = document.documentElement): void {
    element.style.setProperty('--reduce-motion', '1');
    element.setAttribute('data-reduced-motion', 'true');
  },

  /**
   * 低モーション設定を無効化
   */
  disableReducedMotion(element: HTMLElement = document.documentElement): void {
    element.style.removeProperty('--reduce-motion');
    element.removeAttribute('data-reduced-motion');
  },

  /**
   * テーマのカスタムカラーを設定
   */
  setAccentColor(color: string, element: HTMLElement = document.documentElement): void {
    element.style.setProperty('--accent-color', color);
  },

  /**
   * CSS変数の値を取得
   */
  getCSSVariable(variable: string, element: HTMLElement = document.documentElement): string {
    return getComputedStyle(element).getPropertyValue(variable).trim();
  },

  /**
   * コントラスト比を計算
   */
  calculateContrastRatio(color1: string, color2: string): number {
    // 簡易的なコントラスト比計算（実際の実装ではライブラリを使用）
    const getLuminance = (color: string): number => {
      // ここでは簡易的な実装
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      
      const sRGB = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      return 0.2126 * sRGB(r) + 0.7152 * sRGB(g) + 0.0722 * sRGB(b);
    };
    
    const l1 = getLuminance(color1) + 0.05;
    const l2 = getLuminance(color2) + 0.05;
    
    return (Math.max(l1, l2) / Math.min(l1, l2));
  },

  /**
   * コントラスト比が要件を満たしているかチェック
   */
  isContrastCompliant(
    textColor: string, 
    backgroundColor: string, 
    isLargeText: boolean = false
  ): boolean {
    const ratio = this.calculateContrastRatio(textColor, backgroundColor);
    const minimumRatio = isLargeText 
      ? ACCESSIBILITY.MIN_CONTRAST_RATIO_LARGE 
      : ACCESSIBILITY.MIN_CONTRAST_RATIO_NORMAL;
    
    return ratio >= minimumRatio;
  }
};

// 型定義
export type ThemeType = 'dark' | 'light';
export type CSSVariable = typeof CSS_VARIABLES[keyof typeof CSS_VARIABLES];
export type ColorShade = keyof typeof COLOR_PALETTE.PRIMARY;

// テーマ検証
export const ThemeValidation = {
  /**
   * 必須のCSS変数が定義されているかチェック
   */
  validateTheme(theme: Record<string, string>): boolean {
    const requiredVariables = Object.values(CSS_VARIABLES);
    return requiredVariables.every(variable => theme[variable] !== undefined);
  },

  /**
   * テーマがアクセシビリティ要件を満たしているかチェック
   */
  validateAccessibility(theme: Record<string, string>): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    // コントラスト比のチェック
    const textColor = theme[CSS_VARIABLES.PANEL_TEXT];
    const backgroundColor = theme[CSS_VARIABLES.PANEL_BG];
    
    if (textColor && backgroundColor) {
      const ratio = ThemeUtils.calculateContrastRatio(textColor, backgroundColor);
      if (ratio < ACCESSIBILITY.MIN_CONTRAST_RATIO_NORMAL) {
        issues.push(`コントラスト比が不足しています (${ratio.toFixed(2)} < ${ACCESSIBILITY.MIN_CONTRAST_RATIO_NORMAL})`);
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
};