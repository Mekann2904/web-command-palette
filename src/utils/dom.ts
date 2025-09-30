import { SiteEntry } from '@/types';

// GM_* APIのグローバル宣言
declare const GM_xmlhttpRequest: (details: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  onload?: (response: { responseText: string }) => void;
  onerror?: () => void;
}) => void;

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
  const getFavCache = (): Record<string, string> => {
    try {
      return (window as any).GM_getValue?.('vm_sites_palette__favcache_v1', {}) || {};
    } catch {
      return {};
    }
  };

  const setFavCache = (origin: string, href: string): void => {
    const favCache = getFavCache();
    favCache[origin] = href;
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

  const cached = origin && getFavCache()[origin] ? getFavCache()[origin] : null;
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
