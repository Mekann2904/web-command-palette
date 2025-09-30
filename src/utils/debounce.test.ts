/**
 * debounce関数のテスト
 */

import { debounce, debounceImmediate, throttle } from './debounce';

describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should debounce function calls', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 100);

    // 複数回呼び出す
    debouncedFn();
    debouncedFn();
    debouncedFn();

    // まだ実行されていないことを確認
    expect(mockFn).not.toHaveBeenCalled();

    // 100ms進めて実行されることを確認
    jest.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should reset timer on subsequent calls', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn();
    jest.advanceTimersByTime(50);
    
    // 50ms後に再度呼び出す
    debouncedFn();
    jest.advanceTimersByTime(50);
    
    // まだ実行されていないことを確認
    expect(mockFn).not.toHaveBeenCalled();
    
    // さらに50ms進めて実行されることを確認
    jest.advanceTimersByTime(50);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});

describe('debounceImmediate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should call function immediately on first call', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounceImmediate(mockFn, 100);

    debouncedFn();
    expect(mockFn).toHaveBeenCalledTimes(1);

    // 2回目は呼び出されない
    debouncedFn();
    expect(mockFn).toHaveBeenCalledTimes(1);

    // 100ms後に再度呼び出せる
    jest.advanceTimersByTime(100);
    debouncedFn();
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});

describe('throttle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should throttle function calls', () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 100);

    // 最初の呼び出しは実行される
    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(1);

    // すぐに再度呼び出しても実行されない
    throttledFn();
    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(1);

    // 100ms後に再度呼び出せる
    jest.advanceTimersByTime(100);
    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});
