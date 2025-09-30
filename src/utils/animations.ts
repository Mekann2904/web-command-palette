/**
 * アニメーションユーティリティ関数
 */

/**
 * CSSトランジションを適用する
 */
export function applyTransition(
  element: HTMLElement,
  properties: Record<string, string>,
  duration: number = 200,
  easing: string = 'ease'
): Promise<void> {
  return new Promise(resolve => {
    // すでにトランジション中の場合は待機
    if (getComputedStyle(element).transitionProperty !== 'none') {
      const handler = () => {
        element.removeEventListener('transitionend', handler);
        resolve();
      };
      element.addEventListener('transitionend', handler);
      return;
    }

    // トランジションを適用
    const originalTransition = element.style.transition;
    const originalValues: Record<string, string> = {};

    // 現在の値を保存
    Object.keys(properties).forEach(prop => {
      originalValues[prop] = element.style.getPropertyValue(prop);
    });

    // トランジションを設定
    element.style.transition = `all ${duration}ms ${easing}`;
    
    // 適用後のハンドラ
    const handler = () => {
      element.removeEventListener('transitionend', handler);
      element.style.transition = originalTransition;
      resolve();
    };
    element.addEventListener('transitionend', handler);

    // プロパティを適用
    requestAnimationFrame(() => {
      Object.entries(properties).forEach(([prop, value]) => {
        element.style.setProperty(prop, value);
      });
    });
  });
}

/**
 * フェードインアニメーション
 */
export function fadeIn(element: HTMLElement, duration: number = 200): Promise<void> {
  element.style.opacity = '0';
  element.style.display = '';
  
  return applyTransition(element, { opacity: '1' }, duration);
}

/**
 * フェードアウトアニメーション
 */
export function fadeOut(element: HTMLElement, duration: number = 200): Promise<void> {
  return applyTransition(element, { opacity: '0' }, duration).then(() => {
    element.style.display = 'none';
  });
}

/**
 * スライドインアニメーション（上から）
 */
export function slideInFromTop(element: HTMLElement, duration: number = 200): Promise<void> {
  const originalTransform = element.style.transform;
  element.style.transform = 'translateY(-20px)';
  element.style.opacity = '0';
  element.style.display = '';
  
  return applyTransition(element, { 
    transform: originalTransform || 'translateY(0)', 
    opacity: '1' 
  }, duration);
}

/**
 * スケールインアニメーション
 */
export function scaleIn(element: HTMLElement, duration: number = 200): Promise<void> {
  element.style.transform = 'scale(0.9)';
  element.style.opacity = '0';
  element.style.display = '';
  
  return applyTransition(element, { 
    transform: 'scale(1)', 
    opacity: '1' 
  }, duration);
}

/**
 * バウンスアニメーション
 */
export function bounce(element: HTMLElement): Promise<void> {
  return applyTransition(element, {
    transform: 'scale(1.1)'
  }, 150).then(() => {
    return applyTransition(element, {
      transform: 'scale(1)'
    }, 150);
  });
}

/**
 * シェイクアニメーション（エラー表示用）
 */
export function shake(element: HTMLElement): Promise<void> {
  const originalTransform = element.style.transform;
  
  return applyTransition(element, {
    transform: 'translateX(-5px)'
  }, 50).then(() => {
    return applyTransition(element, {
      transform: 'translateX(5px)'
    }, 50);
  }).then(() => {
    return applyTransition(element, {
      transform: 'translateX(-5px)'
    }, 50);
  }).then(() => {
    return applyTransition(element, {
      transform: originalTransform || 'translateX(0)'
    }, 50);
  });
}

/**
 * スムーズスクロール
 */
export function smoothScrollTo(
  element: HTMLElement,
  targetY: number,
  duration: number = 300
): Promise<void> {
  return new Promise(resolve => {
    const startY = element.scrollTop;
    const distance = targetY - startY;
    const startTime = performance.now();

    function scroll(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // easeInOutCubic
      const easeProgress = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      
      element.scrollTop = startY + distance * easeProgress;
      
      if (progress < 1) {
        requestAnimationFrame(scroll);
      } else {
        resolve();
      }
    }
    
    requestAnimationFrame(scroll);
  });
}

/**
 * アニメーションをキャンセル
 */
export function cancelAnimation(element: HTMLElement): void {
  element.style.transition = 'none';
  // 強制的にリフレッシュしてトランジションをキャンセル
  element.offsetHeight;
}
