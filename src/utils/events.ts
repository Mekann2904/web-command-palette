/**
 * イベントリスナー関連のユーティリティ関数
 */

/**
 * 要素にクリックイベントリスナーを追加する
 */
export const addClickListener = (element: Element | null, handler: () => void): void => {
  element?.addEventListener('click', handler);
};

/**
 * 要素にキーダウンイベントリスナーを追加する
 */
export const addKeydownListener = (element: Element | null, handler: (e: KeyboardEvent) => void): void => {
  element?.addEventListener('keydown', handler as EventListener);
};

/**
 * 要素に入力イベントリスナーを追加する
 */
export const addInputListener = (element: Element | null, handler: () => void): void => {
  element?.addEventListener('input', handler);
};

/**
 * 要素にフォーカスイベントリスナーを追加する
 */
export const addFocusListener = (element: Element | null, handler: () => void): void => {
  element?.addEventListener('focus', handler);
};

/**
 * 要素にブラーイベントリスナーを追加する
 */
export const addBlurListener = (element: Element | null, handler: (e: FocusEvent) => void): void => {
  element?.addEventListener('blur', handler as EventListener);
};

/**
 * 要素にマウスエンターイベントリスナーを追加する
 */
export const addMouseEnterListener = (element: Element | null, handler: () => void): void => {
  element?.addEventListener('mouseenter', handler);
};

/**
 * 要素にマウスダウンイベントリスナーを追加する
 */
export const addMouseDownListener = (element: Element | null, handler: (e: MouseEvent) => void): void => {
  element?.addEventListener('mousedown', handler as EventListener);
};

/**
 * オートコンプリート用の特殊なイベント設定
 * 入力フィールドとオートコンプリートリストの連携を設定する
 */
export const setupAutocompleteEvents = (
  inputEl: HTMLInputElement, 
  autocompleteEl: HTMLElement, 
  onHide: () => void
): void => {
  // 入力フィールドのフォーカスが外れた時の処理
  addBlurListener(inputEl, (e) => {
    const to = e.relatedTarget as Node;
    const insideAuto = to && autocompleteEl.contains(to);
    
    // 少し遅延して判定（フォーカス移動を待つ）
    setTimeout(() => {
      if (!insideAuto && !autocompleteEl.matches(':hover')) {
        onHide();
      }
    }, 0);
  });

  // オートコンプリート内クリック時にフォーカスを奪われても閉じないようにする
  addMouseDownListener(autocompleteEl, (e) => {
    e.preventDefault();        // 入力の blur を抑止
    inputEl.focus();          // フォーカスを戻す
  });
};

/**
 * 複数の要素に同じイベントリスナーを追加する
 */
export const addEventListenersToElements = (
  elements: NodeListOf<Element>,
  eventType: string,
  handler: (e: Event) => void
): void => {
  elements.forEach(element => {
    element.addEventListener(eventType, handler);
  });
};

/**
 * イベントリスナーを削除するユーティリティ
 */
export const removeEventListener = (
  element: Element | null,
  eventType: string,
  handler: EventListener
): void => {
  element?.removeEventListener(eventType, handler);
};

/**
 * フォーカストラップ用のインターフェース
 */
export interface FocusTrap {
  activate: () => void;
  deactivate: () => void;
  isActive: () => boolean;
}

/**
 * フォーカストラップを作成する
 * 指定されたコンテナ内にフォーカスを制限する
 */
export const createFocusTrap = (container: HTMLElement): FocusTrap => {
  let isActive = false;
  let previousActiveElement: HTMLElement | null = null;
  let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  /**
   * コンテナ内のフォーカス可能な要素を取得する
   */
  const getFocusableElements = (): HTMLElement[] => {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');

    const elements = Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
    
    // tabindex順にソート
    return elements.sort((a, b) => {
      const aIndex = parseInt(a.getAttribute('tabindex') || '0');
      const bIndex = parseInt(b.getAttribute('tabindex') || '0');
      return aIndex - bIndex;
    });
  };

  /**
   * 最初のフォーカス可能な要素にフォーカスを設定
   */
  const focusFirstElement = (): void => {
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  };

  /**
   * キーダウンイベントハンドラ
   */
  const handleKeydown = (e: KeyboardEvent): void => {
    if (e.key !== 'Tab') return;

    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) return;

    const currentElement = document.activeElement as HTMLElement;
    const currentIndex = focusableElements.indexOf(currentElement);

    let targetIndex: number;

    if (e.shiftKey) {
      // Shift+Tab: 前の要素へ
      targetIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
    } else {
      // Tab: 次の要素へ
      targetIndex = currentIndex >= focusableElements.length - 1 ? 0 : currentIndex + 1;
    }

    e.preventDefault();
    focusableElements[targetIndex].focus();
  };

  /**
   * フォーカストラップを有効化
   */
  const activate = (): void => {
    if (isActive) return;

    isActive = true;
    previousActiveElement = document.activeElement as HTMLElement;
    
    // キーダウンイベントリスナーを追加
    keydownHandler = handleKeydown;
    container.addEventListener('keydown', keydownHandler, true);
    
    // 最初の要素にフォーカス
    setTimeout(() => focusFirstElement(), 0);
  };

  /**
   * フォーカストラップを無効化
   */
  const deactivate = (): void => {
    if (!isActive) return;

    isActive = false;
    
    // キーダウンイベントリスナーを削除
    if (keydownHandler) {
      container.removeEventListener('keydown', keydownHandler, true);
      keydownHandler = null;
    }
    
    // 以前の要素にフォーカスを戻す
    if (previousActiveElement) {
      setTimeout(() => {
        if (previousActiveElement) {
          previousActiveElement.focus();
        }
      }, 0);
    }
  };

  /**
   * フォーカストラップが有効かどうかを返す
   */
  const isTrapActive = (): boolean => isActive;

  return {
    activate,
    deactivate,
    isActive: isTrapActive
  };
};

/**
 * 要素がフォーカス可能かどうかを判定する
 */
export const isFocusable = (element: Element): boolean => {
  if (!(element instanceof HTMLElement)) return false;
  
  // disabled属性があればフォーカス不可
  if (element.hasAttribute('disabled')) return false;
  
  // tabindexが-1ならフォーカス不可
  if (element.getAttribute('tabindex') === '-1') return false;
  
  // hiddenまたはdisplay:noneならフォーカス不可
  if (element.hidden || element.style.display === 'none') return false;
  
  // フォーカス可能な要素かどうかを判定
  const focusableTags = ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'];
  const isFocusableTag = focusableTags.includes(element.tagName);
  
  // aタグはhref属性が必要
  if (element.tagName === 'A' && !element.hasAttribute('href')) return false;
  
  // tabindexが明示的に設定されているか
  const hasTabIndex = element.hasAttribute('tabindex');
  
  // contenteditableがtrueか
  const isContentEditable = element.getAttribute('contenteditable') === 'true';
  
  return isFocusableTag || hasTabIndex || isContentEditable;
};