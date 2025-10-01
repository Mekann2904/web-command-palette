/**
 * DOM要素生成ファクトリ
 * DOM要素の生成とスタイル設定を共通化する
 */

export interface DOMAttributes {
  [key: string]: string | number | boolean;
}

export interface StyleProperties {
  [key: string]: string | number;
}

export class DOMFactory {
  /**
   * 基本的な要素を作成する
   */
  static createElement(
    tagName: string,
    className?: string,
    attributes?: DOMAttributes,
    styles?: StyleProperties
  ): HTMLElement {
    const element = document.createElement(tagName);
    
    if (className) {
      element.className = className;
    }
    
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          if (value) {
            element.setAttribute(key, '');
          }
        } else {
          element.setAttribute(key, String(value));
        }
      });
    }
    
    if (styles) {
      Object.entries(styles).forEach(([key, value]) => {
        element.style.setProperty(key, String(value));
      });
    }
    
    return element;
  }

  /**
   * コンテナ要素を作成する
   */
  static createContainer(
    className: string,
    children?: HTMLElement[],
    attributes?: DOMAttributes,
    styles?: StyleProperties
  ): HTMLElement {
    const container = this.createElement('div', className, attributes, styles);
    
    if (children) {
      children.forEach(child => container.appendChild(child));
    }
    
    return container;
  }

  /**
   * オートコンプリートアイテムを作成する
   */
  static createAutocompleteItem(
    content: string,
    className: string = 'autocomplete-item',
    isActive: boolean = false,
    index?: number
  ): HTMLElement {
    const item = this.createElement('div', className);
    
    if (isActive) {
      item.classList.add('active');
    }
    
    if (index !== undefined) {
      item.dataset.index = index.toString();
    }
    
    item.innerHTML = content;
    
    return item;
  }

  /**
   * ボタンを作成する
   */
  static createButton(
    text: string,
    className: string = 'btn',
    onClick?: () => void,
    attributes?: DOMAttributes,
    styles?: StyleProperties
  ): HTMLButtonElement {
    const button = this.createElement('button', className, attributes, styles) as HTMLButtonElement;
    button.textContent = text;
    
    if (onClick) {
      button.addEventListener('click', onClick);
    }
    
    return button;
  }

  /**
   * 入力フィールドを作成する
   */
  static createInput(
    type: string = 'text',
    className?: string,
    placeholder?: string,
    value?: string,
    attributes?: DOMAttributes,
    styles?: StyleProperties
  ): HTMLInputElement {
    const input = this.createElement('input', className, attributes, styles) as HTMLInputElement;
    input.type = type;
    
    if (placeholder) {
      input.placeholder = placeholder;
    }
    
    if (value) {
      input.value = value;
    }
    
    return input;
  }

  /**
   * テキストエリアを作成する
   */
  static createTextarea(
    className?: string,
    placeholder?: string,
    value?: string,
    attributes?: DOMAttributes,
    styles?: StyleProperties
  ): HTMLTextAreaElement {
    const textarea = this.createElement('textarea', className, attributes, styles) as HTMLTextAreaElement;
    
    if (placeholder) {
      textarea.placeholder = placeholder;
    }
    
    if (value) {
      textarea.value = value;
    }
    
    return textarea;
  }

  /**
   * スタイル要素を作成する
   */
  static createStyle(content: string): HTMLStyleElement {
    const style = document.createElement('style');
    style.textContent = content;
    return style;
  }

  /**
   * リンク要素を作成する
   */
  static createLink(
    text: string,
    href?: string,
    className?: string,
    onClick?: (e: MouseEvent) => void,
    attributes?: DOMAttributes,
    styles?: StyleProperties
  ): HTMLAnchorElement {
    const link = this.createElement('a', className, attributes, styles) as HTMLAnchorElement;
    link.textContent = text;
    
    if (href) {
      link.href = href;
    }
    
    if (onClick) {
      link.addEventListener('click', onClick);
    }
    
    return link;
  }

  /**
   * 画像要素を作成する
   */
  static createImage(
    src: string,
    alt: string = '',
    className?: string,
    attributes?: DOMAttributes,
    styles?: StyleProperties
  ): HTMLImageElement {
    const img = this.createElement('img', className, attributes, styles) as HTMLImageElement;
    img.src = src;
    img.alt = alt;
    return img;
  }

  /**
   * スパン要素を作成する
   */
  static createSpan(
    text: string,
    className?: string,
    attributes?: DOMAttributes,
    styles?: StyleProperties
  ): HTMLSpanElement {
    const span = this.createElement('span', className, attributes, styles) as HTMLSpanElement;
    span.textContent = text;
    return span;
  }

  /**
   * div要素を作成する
   */
  static createDiv(
    className?: string,
    children?: HTMLElement[],
    attributes?: DOMAttributes,
    styles?: StyleProperties
  ): HTMLDivElement {
    return this.createContainer(className || '', children, attributes, styles) as HTMLDivElement;
  }

  /**
   * テーブル行を作成する
   */
  static createTableRow(
    cells: string[],
    className?: string,
    attributes?: DOMAttributes,
    styles?: StyleProperties
  ): HTMLTableRowElement {
    const row = this.createElement('tr', className, attributes, styles) as HTMLTableRowElement;
    
    cells.forEach(cellText => {
      const cell = this.createElement('td');
      cell.textContent = cellText;
      row.appendChild(cell);
    });
    
    return row;
  }

  /**
   * テーブルヘッダー行を作成する
   */
  static createTableHeaderRow(
    headers: string[],
    className?: string,
    attributes?: DOMAttributes,
    styles?: StyleProperties
  ): HTMLTableRowElement {
    const row = this.createElement('tr', className, attributes, styles) as HTMLTableRowElement;
    
    headers.forEach(headerText => {
      const header = this.createElement('th');
      header.textContent = headerText;
      row.appendChild(header);
    });
    
    return row;
  }

  /**
   * リストアイテムを作成する
   */
  static createListItem(
    text: string,
    className?: string,
    attributes?: DOMAttributes,
    styles?: StyleProperties
  ): HTMLLIElement {
    const li = this.createElement('li', className, attributes, styles) as HTMLLIElement;
    li.textContent = text;
    return li;
  }

  /**
   * フラグメントを作成する
   */
  static createFragment(children?: HTMLElement[]): DocumentFragment {
    const fragment = document.createDocumentFragment();
    
    if (children) {
      children.forEach(child => fragment.appendChild(child));
    }
    
    return fragment;
  }

  /**
   * 要素をクリアする
   */
  static clearElement(element: HTMLElement): void {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  /**
   * 要素のクラスを切り替える
   */
  static toggleClass(element: HTMLElement, className: string, force?: boolean): boolean {
    return element.classList.toggle(className, force);
  }

  /**
   * 要素にクラスを追加する
   */
  static addClass(element: HTMLElement, ...classNames: string[]): void {
    element.classList.add(...classNames);
  }

  /**
   * 要素からクラスを削除する
   */
  static removeClass(element: HTMLElement, ...classNames: string[]): void {
    element.classList.remove(...classNames);
  }

  /**
   * 要素が指定されたクラスを持っているか確認する
   */
  static hasClass(element: HTMLElement, className: string): boolean {
    return element.classList.contains(className);
  }

  /**
   * 要素のスタイルを設定する
   */
  static setStyles(element: HTMLElement, styles: StyleProperties): void {
    Object.entries(styles).forEach(([property, value]) => {
      element.style.setProperty(property, String(value));
    });
  }

  /**
   * 要素の属性を設定する
   */
  static setAttributes(element: HTMLElement, attributes: DOMAttributes): void {
    Object.entries(attributes).forEach(([key, value]) => {
      if (typeof value === 'boolean') {
        if (value) {
          element.setAttribute(key, '');
        } else {
          element.removeAttribute(key);
        }
      } else {
        element.setAttribute(key, String(value));
      }
    });
  }

  /**
   * 要素を安全に削除する
   */
  static safeRemove(element: HTMLElement): void {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }

  /**
   * 複数の要素を一度に追加する
   */
  static appendChildren(parent: HTMLElement, children: HTMLElement[]): void {
    const fragment = this.createFragment(children);
    parent.appendChild(fragment);
  }

  /**
   * 要素をクローンする
   */
  static cloneElement(
    element: HTMLElement,
    deep: boolean = true
  ): HTMLElement {
    return element.cloneNode(deep) as HTMLElement;
  }
}