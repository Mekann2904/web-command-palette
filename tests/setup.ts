/**
 * Jestテスト環境のセットアップ
 */

// Extend Jest matchers type
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

// Mock DOM APIs
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock GM APIs
const mockGM = {
  registerMenuCommand: jest.fn(),
  openInTab: jest.fn(),
  xmlhttpRequest: jest.fn(),
  setClipboard: jest.fn(),
  setValue: jest.fn(),
  getValue: jest.fn(),
  deleteValue: jest.fn(),
  listValues: jest.fn(),
};

(global as any).GM_registerMenuCommand = mockGM.registerMenuCommand;
(global as any).GM_openInTab = mockGM.openInTab;
(global as any).GM_xmlhttpRequest = mockGM.xmlhttpRequest;
(global as any).GM_setClipboard = mockGM.setClipboard;
(global as any).GM_setValue = mockGM.setValue;
(global as any).GM_getValue = mockGM.getValue;
(global as any).GM_deleteValue = mockGM.deleteValue;
(global as any).GM_listValues = mockGM.listValues;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Add custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

export {};
