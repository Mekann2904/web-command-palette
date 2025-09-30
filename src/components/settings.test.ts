import { SettingsUI } from './settings';
import { DOMElements } from '@/core/state';
import { defaultSettings } from '@/constants';

// モックのDOMElementsを作成
const createMockDOMElements = (): DOMElements => ({
  host: document.createElement('div'),
  root: document.createElement('div').attachShadow({ mode: 'open' }),
  overlayEl: document.createElement('div'),
  inputEl: document.createElement('input'),
  hintEl: document.createElement('div'),
  listEl: document.createElement('div'),
  toastEl: document.createElement('div'),
  hintLeftSpan: null,
  mgrOverlay: document.createElement('div'),
  mgrBox: document.createElement('div'),
  siteBodyEl: null,
  setOverlay: document.createElement('div'),
  setBox: document.createElement('div'),
  autocompleteEl: document.createElement('div'),
  suggestionsEl: null
});

// モックのnavigator.platformを設定
const originalPlatform = navigator.platform;

describe('SettingsUI', () => {
  let settingsUI: SettingsUI;
  let mockDOM: DOMElements;

  beforeEach(() => {
    mockDOM = createMockDOMElements();
    settingsUI = new SettingsUI(mockDOM, () => {});
  });

  afterEach(() => {
    // navigator.platformを元に戻す
    Object.defineProperty(navigator, 'platform', {
      value: originalPlatform,
      writable: true
    });
  });

  describe('labelHotkey', () => {
    // privateメソッドなのでテスト用にpublicメソッドとして公開する必要がある
    // ここではテスト用に一時的にprivateアクセスを許可
    const getLabelHotkey = (instance: SettingsUI) => {
      return (instance as any).labelHotkey.bind(instance);
    };

    it('should display simple Meta+Key combination on Mac', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        writable: true
      });

      const labelHotkey = getLabelHotkey(settingsUI);
      expect(labelHotkey('Meta+KeyP')).toBe('⌘P');
    });

    it('should display simple Control+Key combination on Mac', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        writable: true
      });

      const labelHotkey = getLabelHotkey(settingsUI);
      expect(labelHotkey('Control+KeyP')).toBe('⌃P');
    });

    it('should display simple Meta+Key combination on Windows', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        writable: true
      });

      const labelHotkey = getLabelHotkey(settingsUI);
      expect(labelHotkey('Meta+KeyP')).toBe('Win+P');
    });

    it('should display simple Control+Key combination on Windows', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        writable: true
      });

      const labelHotkey = getLabelHotkey(settingsUI);
      expect(labelHotkey('Control+KeyP')).toBe('Ctrl+P');
    });

    it('should display multiple modifiers on Mac', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        writable: true
      });

      const labelHotkey = getLabelHotkey(settingsUI);
      expect(labelHotkey('Meta+Shift+KeyP')).toBe('⌘⇧P');
      expect(labelHotkey('Meta+Alt+KeyP')).toBe('⌘⌥P');
      expect(labelHotkey('Control+Alt+Shift+KeyP')).toBe('⌃⌥⇧P');
    });

    it('should display multiple modifiers on Windows', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        writable: true
      });

      const labelHotkey = getLabelHotkey(settingsUI);
      expect(labelHotkey('Meta+Shift+KeyP')).toBe('Win+Shift+P');
      expect(labelHotkey('Meta+Alt+KeyP')).toBe('Win+Alt+P');
      expect(labelHotkey('Control+Alt+Shift+KeyP')).toBe('Ctrl+Alt+Shift+P');
    });

    it('should display special keys', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        writable: true
      });

      const labelHotkey = getLabelHotkey(settingsUI);
      expect(labelHotkey('Meta+Space')).toBe('⌘Space');
      expect(labelHotkey('Meta+Enter')).toBe('⌘Enter');
      expect(labelHotkey('Meta+Escape')).toBe('⌘Esc');
      expect(labelHotkey('Meta+ArrowUp')).toBe('⌘↑');
    });

    it('should handle empty signature', () => {
      const labelHotkey = getLabelHotkey(settingsUI);
      expect(labelHotkey('')).toBe('');
    });

    it('should display invalid hotkey for modifier keys as main key', () => {
      const labelHotkey = getLabelHotkey(settingsUI);
      expect(labelHotkey('Meta+MetaLeft')).toBe('無効なホットキー');
      expect(labelHotkey('Control+ControlLeft')).toBe('無効なホットキー');
      expect(labelHotkey('Alt+AltLeft')).toBe('無効なホットキー');
      expect(labelHotkey('Shift+ShiftLeft')).toBe('無効なホットキー');
    });
  });
});