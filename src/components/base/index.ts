/**
 * コンポーネント基底クラス群
 * 共通機能を提供し、コードの重複を削減する
 */

export { BaseAutocomplete } from './base-autocomplete';
export { PaletteAutocomplete } from './palette-autocomplete';
export { ManagerAutocomplete } from './manager-autocomplete';
export { EventManager, globalEventManager } from './event-manager';
export { DOMFactory } from './dom-factory';
export { SimpleVirtualScroll } from './simple-virtual-scroll';
export { MemoryManager, memoryManager } from './memory-manager';
export { RenderOptimizer, renderOptimizer, RenderUtils } from './render-optimizer';
export { PerformanceMonitor, performanceMonitor } from './performance-monitor';

// 型のエクスポート
export type { AutocompleteItem, BaseAutocompleteState } from './base-autocomplete';
export type { EventListenerInfo } from './event-manager';
export type { DOMAttributes, StyleProperties } from './dom-factory';
export type { VirtualScrollItem, VirtualScrollOptions } from './simple-virtual-scroll';
export type { MemoryStats, MemoryThresholds } from './memory-manager';
export type { RenderBatch } from './render-optimizer';
export type { PerformanceMetrics, PerformanceReport } from './performance-monitor';