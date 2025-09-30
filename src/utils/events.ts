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