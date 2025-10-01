import { SiteEntry } from '@/types';

// GM_* APIのグローバル宣言
declare const GM_xmlhttpRequest: (details: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  onload?: (response: { responseText: string }) => void;
  onerror?: () => void;
}) => void;

// faviconキャッシュの設定
const FAVICON_CACHE_CONFIG = {
  MAX_SIZE: 500, // 最大キャッシュ数
  MAX_AGE: 30 * 24 * 60 * 60 * 1000, // 30日（ミリ秒）
  CLEANUP_INTERVAL: 7 * 24 * 60 * 60 * 1000 // 7日ごとにクリーンアップ
};

// 最後のクリーンアップ時刻
let lastCleanupTime = 0;

/**
 * favicon要素を作成する
 */
export const createFaviconEl = (entry: SiteEntry): HTMLElement => {
  const wrap = document.createElement('div');
  wrap.style.width = '20px';
  wrap.style.height = '20px';
  wrap.style.display = 'flex';
  wrap.style.alignItems = 'center';
  wrap.style.justifyContent = 'center';

  const img = document.createElement('img');
  img.className = 'ico';
  img.decoding = 'async';

  let origin: string | null = null;
  const url = entry.url;
  try { 
    origin = new URL(url).origin; 
  } catch { 
    origin = null; 
  }

  // グローバルからgetFavCacheを取得（循環参照を避けるため）
  const getFavCache = (): Record<string, { href: string; timestamp: number }> => {
    try {
      return (window as any).GM_getValue?.('vm_sites_palette__favcache_v1', {}) || {};
    } catch {
      return {};
    }
  };

  const setFavCache = (origin: string, href: string): void => {
    const favCache = getFavCache();
    favCache[origin] = {
      href,
      timestamp: Date.now()
    };
    
    // キャッシュサイズが制限を超えた場合はLRUで整理
    if (Object.keys(favCache).length > FAVICON_CACHE_CONFIG.MAX_SIZE) {
      pruneFavCache(favCache);
    }
    
    (window as any).GM_setValue?.('vm_sites_palette__favcache_v1', favCache);
  };

  const clearFavCacheOrigin = (origin: string | null): void => {
    if (!origin) return;
    const favCache = getFavCache();
    if (favCache[origin]) {
      delete favCache[origin];
      (window as any).GM_setValue?.('vm_sites_palette__favcache_v1', favCache);
    }
  };

  /**
   * faviconキャッシュを整理（LRUアルゴリズム）
   */
  const pruneFavCache = (cache: Record<string, { href: string; timestamp: number }>): void => {
    const now = Date.now();
    
    // 期限切れのエントリを削除
    for (const [origin, entry] of Object.entries(cache)) {
      if (now - entry.timestamp > FAVICON_CACHE_CONFIG.MAX_AGE) {
        delete cache[origin];
      }
    }
    
    // それでもサイズが大きい場合は古いものから削除
    const entries = Object.entries(cache);
    if (entries.length > FAVICON_CACHE_CONFIG.MAX_SIZE) {
      // タイムスタンプでソートして古いものから削除
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toKeep = entries.slice(-FAVICON_CACHE_CONFIG.MAX_SIZE);
      
      // キャッシュをクリアして再構築
      for (const origin of Object.keys(cache)) {
        delete cache[origin];
      }
      
      for (const [origin, entry] of toKeep) {
        cache[origin] = entry;
      }
    }
  };

  /**
   * 定期的なキャッシュクリーンアップ
   */
  const periodicCleanup = (): void => {
    const now = Date.now();
    if (now - lastCleanupTime > FAVICON_CACHE_CONFIG.CLEANUP_INTERVAL) {
      const favCache = getFavCache();
      pruneFavCache(favCache);
      (window as any).GM_setValue?.('vm_sites_palette__favcache_v1', favCache);
      lastCleanupTime = now;
    }
  };

  // 定期的なクリーンアップを実行
  periodicCleanup();
  
  const cached = origin && getFavCache()[origin] ? getFavCache()[origin].href : null;
  if (cached) {
    img.onload = () => wrap.appendChild(img);
    img.onerror = () => {
      if (origin) clearFavCacheOrigin(origin);
      trySimple();
    };
    img.src = cached;
    return wrap;
  }

  if (origin) {
    discoverFavicon(origin, (href: string | null) => {
      if (href) {
        img.onload = () => { 
          setFavCache(origin, href); 
          wrap.appendChild(img); 
        };
        img.onerror = () => { 
          if (origin) clearFavCacheOrigin(origin); 
          trySimple(); 
        };
        img.src = href;
      } else {
        trySimple();
      }
    });
  } else {
    trySimple();
  }

  function trySimple() {
    const list = (() => {
      if (!origin) return [];
      const simple = [
        '/favicon.ico',
        '/favicon.svg',
        '/favicon.png',
        '/apple-touch-icon.png',
        '/apple-touch-icon-precomposed.png'
      ].map(p => origin + p);
      const external = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(origin || '')}&sz=64`;
      return [external, ...simple];
    })();
    let i = 0;
    function next() { 
      if (i >= list.length) return fallback(); 
      img.src = list[i++]; 
    }
    img.onload = () => { 
      if (origin) setFavCache(origin, img.src); 
      wrap.appendChild(img); 
    };
    img.onerror = () => { 
      if (origin) clearFavCacheOrigin(origin); 
      next(); 
    };
    next();
  }

  function fallback() {
    const letter = document.createElement('div');
    letter.className = 'ico-letter';
    const text = (entry.name || '').trim();
    const first = text ? text[0] : (origin ? origin.replace(/^https?:\/\//,'')[0] : '?');
    letter.textContent = (first || '?').toUpperCase();
    wrap.appendChild(letter);
  }

  return wrap;
};

/**
 * faviconを発見する
 */
export const discoverFavicon = (origin: string, done: (href: string | null) => void): void => {
  const isDark = (() => {
    try { 
      return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) || 
             document.documentElement.classList.contains('dark') || 
             document.documentElement.dataset.colorMode === 'dark'; 
    } catch { 
      return false; 
    }
  })();

  GM_xmlhttpRequest({
    method: 'GET', 
    url: origin + '/',
    onload: (res: { responseText: string }) => {
      try {
        const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
        const links = Array.from(doc.querySelectorAll('link[rel~="icon" i], link[rel="shortcut icon" i], link[rel~="mask-icon" i], link[rel~="apple-touch-icon" i]')) as HTMLLinkElement[];
        
        if (!links.length) return done(null);
        
        function mediaMatch(m: string): boolean {
          try { 
            return m ? matchMedia(m).matches : true; 
          } catch { 
            return true; 
          }
        }
        
        function score(link: HTMLLinkElement): number {
          const rel = (link.getAttribute('rel') || '').toLowerCase();
          const href = link.getAttribute('href') || '';
          const type = (link.getAttribute('type') || '').toLowerCase();
          const sizes = (link.getAttribute('sizes') || '').toLowerCase();
          const media = (link.getAttribute('media') || '').trim();
          let s = 0;
          
          if (rel.includes('icon')) s += 10;
          if (href.includes('favicon')) s += 6;
          if (type.includes('svg')) s += 5;
          if (sizes.includes('32x32')) s += 3;
          if (media) s += mediaMatch(media) ? 8 : -20;
          
          if (isDark) { 
            if (/dark/i.test(href)) s += 5; 
            if (/light/i.test(href)) s -= 2; 
          } else { 
            if (/light/i.test(href)) s += 3; 
            if (/dark/i.test(href)) s -= 2; 
          }
          
          return s;
        }
        
        const best = links.map(l => ({ l, s: score(l) })).sort((a, b) => b.s - a.s)[0];
        if (!best) return done(null);
        
        const abs = new URL(best.l.getAttribute('href') || '', origin).href;
        return done(abs);
      } catch {
        done(null);
      }
    },
    onerror: () => done(null)
  });
};
