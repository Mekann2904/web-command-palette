// ==UserScript==
// @name         Command Palette (Sites Launcher) + Manager
// @namespace    mekann.toolbox
// @version      1.3.1
// @description  ⌘P / Ctrl+P でコマンドパレット。サイトは表形式で管理。設定はUIで編集（ホットキー、Enter動作、ブロックリスト）。アイコンは可能な限りファビコン自動取得。
// @author       mekann
// @match        *://*/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      *
// ==/UserScript==


(function () {
    'use strict';

    /**
     * グローバル状態の初期化
     */
    const createInitialState = () => ({
        isOpen: false,
        currentItems: [],
        activeIndex: 0,
        cachedSettings: null
    });
    /**
     * DOM要素の初期化
     */
    const createInitialDOMElements = () => ({
        host: null,
        root: null,
        overlayEl: null,
        inputEl: null,
        listEl: null,
        hintEl: null,
        toastEl: null,
        hintLeftSpan: null,
        mgrOverlay: null,
        mgrBox: null,
        siteBodyEl: null,
        setOverlay: null,
        setBox: null,
        autocompleteEl: null,
        suggestionsEl: null,
    });
    /**
     * オートコンプリート状態の初期化
     */
    const createInitialAutocompleteState = () => ({
        items: [],
        index: -1,
        isVisible: false
    });

    const defaultSites = [
        { id: 'site-github', type: 'site', name: 'GitHub', url: 'https://github.com/', tags: ['開発'] },
        { id: 'site-stackoverflow', type: 'site', name: 'Stack Overflow', url: 'https://stackoverflow.com/', tags: ['開発'] },
        { id: 'site-mdn', type: 'site', name: 'MDN Web Docs', url: 'https://developer.mozilla.org/', tags: ['開発'] },
        { id: 'site-bing', type: 'site', name: 'Bing検索', url: 'https://www.bing.com/search?q=%s', tags: ['検索'] },
        { id: 'site-youtube', type: 'site', name: 'YouTube', url: 'https://www.youtube.com/', tags: ['動画'] },
        { id: 'site-gcal', type: 'site', name: 'Google Calendar', url: 'https://calendar.google.com/', tags: ['仕事'] }
    ];
    const defaultSettings = {
        hotkeyPrimary: 'Meta+KeyP',
        hotkeySecondary: 'Control+KeyP',
        enterOpens: 'current',
        blocklist: '',
        theme: 'dark',
        accentColor: '#2563eb',
        autoOpenUrls: []
    };
    const DEFAULT_PLACEHOLDER = 'サイト名やURLで検索… Enterで開く / Shift+Enterで新規タブ';

    const themes = {
        dark: {
            '--overlay-bg': 'rgba(0,0,0,0.35)',
            '--panel-bg': '#1f2937',
            '--panel-text': '#e5e7eb',
            '--panel-shadow': '0 10px 40px rgba(0,0,0,.45)',
            '--input-bg': '#111827',
            '--input-text': '#f3f4f6',
            '--input-placeholder': '#9ca3af',
            '--border-color': '#374151',
            '--muted': '#94a3b8',
            '--item-bg-alt': 'rgba(255,255,255,.02)',
            '--item-active': '#374151',
            '--hint-bg': '#111827',
            '--list-scroll-thumb': '#4b5563',
            '--list-scroll-track': 'rgba(255,255,255,0.08)',
            '--command-badge-bg': 'rgba(255,255,255,0.12)',
            '--tag-bg': 'rgba(79,70,229,0.2)',
            '--tag-text': '#c7d2fe',
            '--tag-suggestion-bg': 'rgba(79,70,229,0.1)',
            '--autocomplete-bg': '#1f2937',
            '--autocomplete-border': '#374151',
            '--toast-bg': 'rgba(17,24,39,0.92)',
            '--toast-text': '#e5e7eb'
        },
        light: {
            '--overlay-bg': 'rgba(255,255,255,0.65)',
            '--panel-bg': '#f9fafb',
            '--panel-text': '#111827',
            '--panel-shadow': '0 10px 36px rgba(15,23,42,.18)',
            '--input-bg': '#ffffff',
            '--input-text': '#111827',
            '--input-placeholder': '#6b7280',
            '--border-color': '#d1d5db',
            '--muted': '#6b7280',
            '--item-bg-alt': 'rgba(17,24,39,0.03)',
            '--item-active': 'rgba(37,99,235,0.12)',
            '--hint-bg': '#edf2f7',
            '--list-scroll-thumb': '#94a3ff',
            '--list-scroll-track': 'rgba(37,99,235,0.08)',
            '--command-badge-bg': 'rgba(37,99,235,0.15)',
            '--tag-bg': 'rgba(37,99,235,0.12)',
            '--tag-text': '#1d4ed8',
            '--tag-suggestion-bg': 'rgba(37,99,235,0.08)',
            '--autocomplete-bg': '#ffffff',
            '--autocomplete-border': '#d1d5db',
            '--toast-bg': 'rgba(255,255,255,0.95)',
            '--toast-text': '#111827'
        }
    };

    /**
     * タイミング関連の定数
     */
    const TIMING = {
        // 即時実行
        IMMEDIATE: 0,
        // フォーカス遅延
        FOCUS_DELAY: 0,
        // 自動オープン遅延
        AUTO_OPEN_DELAY: 120,
        // アニメーションオフセット
        ANIMATION_OFFSET: 60,
        // トースト表示期間
        TOAST_DURATION: 3000,
        // トースト非表示遅延
        TOAST_HIDE_DELAY: 3000,
        // URL破棄遅延
        URL_REVOKE_DELAY: 2000,
        // ブラーチェック遅延
        BLUR_CHECK_DELAY: 0,
        // 入力スペース追加遅延
        INPUT_SPACE_DELAY: 0,
        // ドラッグ開始遅延
        DRAG_START_DELAY: 0,
        // 仮想スクロールのデバウンス時間
        VIRTUAL_SCROLL_DEBOUNCE: 16,
        // 入力デバウンス時間
        INPUT_DEBOUNCE: 150,
        // 新しく追加する定数（リファクタリング計画に基づく）
        // オートコンプリート非表示遅延
        AUTOCOMPLETE_HIDE_DELAY: 300,
        // フォーカストラップ遅延
        FOCUS_TRAP_DELAY: 0,
        // オーバーレイ非表示遅延
        OVERLAY_HIDE_DELAY: 200,
        // アニメーションフレーム遅延
        ANIMATION_FRAME_DELAY: 16,
        // ダブルクリック遅延
        DOUBLE_CLICK_DELAY: 300,
        // ホールド遅延
        HOLD_DELAY: 500,
        // リサイズデバウンス
        RESIZE_DEBOUNCE: 250,
        // スクロールデバウンス
        SCROLL_DEBOUNCE: 100,
        // キー入力遅延
        KEY_INPUT_DELAY: 50,
        // メニュー表示遅延
        MENU_SHOW_DELAY: 100,
        // メニュー非表示遅延
        MENU_HIDE_DELAY: 150
    };

    const STORAGE_KEY = 'vm_sites_palette__sites';
    const SETTINGS_KEY = 'vm_sites_palette__settings_v2';
    const FAVCACHE_KEY = 'vm_sites_palette__favcache_v1';
    const USAGE_KEY = 'vm_sites_palette__usage_v1';
    /**
     * ストレージ操作の基底クラス
     */
    class StorageBase {
        get(defaultValue) {
            return GM_getValue(this.getStorageKey(), defaultValue);
        }
        set(value) {
            GM_setValue(this.getStorageKey(), value);
        }
    }
    /**
     * サイトストレージクラス
     */
    class SiteStorage extends StorageBase {
        getStorageKey() {
            return STORAGE_KEY;
        }
        /**
         * サイトを取得する
         */
        getSites() {
            const raw = this.get(defaultSites);
            const normalized = [];
            let mutated = false;
            for (const item of raw) {
                const norm = normalizeSite(item);
                if (!norm)
                    continue;
                if (item !== norm)
                    mutated = true;
                normalized.push(norm);
            }
            if (!normalized.length) {
                normalized.push(...defaultSites.map(normalizeSite).filter(Boolean));
            }
            if (mutated) {
                this.setSites(normalized, true);
            }
            return normalized;
        }
        /**
         * サイトを設定する
         */
        setSites(sites, skipNormalize = false) {
            const list = skipNormalize ? sites : sites.map(normalizeSite).filter(Boolean);
            this.set(list);
        }
        /**
         * サイトを追加する
         */
        addSite(site) {
            const sites = this.getSites();
            const newSite = normalizeSite({ ...site, id: site.id || generateId('site') });
            if (newSite) {
                sites.push(newSite);
                this.setSites(sites, true);
            }
            return newSite;
        }
        /**
         * サイトを更新する
         */
        updateSite(id, updates) {
            const sites = this.getSites();
            const index = sites.findIndex(site => site.id === id);
            if (index === -1)
                return false;
            sites[index] = { ...sites[index], ...updates };
            this.setSites(sites, true);
            return true;
        }
        /**
         * サイトを削除する
         */
        deleteSite(id) {
            const sites = this.getSites();
            const filteredSites = sites.filter(site => site.id !== id);
            if (filteredSites.length === sites.length)
                return false;
            this.setSites(filteredSites, true);
            return true;
        }
    }
    /**
     * 設定ストレージクラス
     */
    class SettingsStorage extends StorageBase {
        getStorageKey() {
            return SETTINGS_KEY;
        }
        /**
         * 設定を取得する
         */
        getSettings() {
            return { ...defaultSettings, ...this.get({}) };
        }
        /**
         * 設定を保存する
         */
        setSettings(settings) {
            this.set({ ...this.getSettings(), ...settings });
        }
        /**
         * 設定をリセットする
         */
        resetSettings() {
            this.set(defaultSettings);
        }
    }
    /**
     * キャッシュストレージクラス
     */
    class CacheStorage extends StorageBase {
        constructor(key) {
            super();
            this.key = key;
        }
        getStorageKey() {
            return this.key;
        }
        /**
         * キャッシュを取得する
         */
        getCache() {
            return this.get({});
        }
        /**
         * キャッシュを設定する
         */
        setCache(cache) {
            this.set(cache);
        }
        /**
         * キャッシュエントリを設定する
         */
        setCacheEntry(key, value) {
            const cache = this.getCache();
            cache[key] = value;
            this.setCache(cache);
        }
        /**
         * キャッシュエントリを削除する
         */
        deleteCacheEntry(key) {
            const cache = this.getCache();
            if (!(key in cache))
                return false;
            delete cache[key];
            this.setCache(cache);
            return true;
        }
        /**
         * キャッシュをクリアする
         */
        clearCache() {
            this.set({});
        }
    }
    // ストレージインスタンスを作成
    const siteStorage = new SiteStorage();
    const settingsStorage = new SettingsStorage();
    new CacheStorage(FAVCACHE_KEY);
    const usageStorage = new CacheStorage(USAGE_KEY);
    /**
     * ストレージを初期化する
     */
    const initializeStorage = () => {
        siteStorage.getSites(); // 初期化時に正規化を実行
        settingsStorage.getSettings(); // 初期化時にデフォルト設定を適用
    };
    /**
     * サイトを取得する
     */
    const getSites = () => {
        return siteStorage.getSites();
    };
    /**
     * サイトを設定する
     */
    const setSites = (sites, skipNormalize = false) => {
        siteStorage.setSites(sites, skipNormalize);
    };
    /**
     * 設定を取得する
     */
    const getSettings = () => {
        return settingsStorage.getSettings();
    };
    /**
     * 設定を保存する
     */
    const setSettings = (settings) => {
        settingsStorage.setSettings(settings);
    };
    /**
     * 使用回数を増やす
     */
    const incrementUsage = (id) => {
        if (!id)
            return;
        const usageCache = getUsageCache();
        const next = (usageCache[id] || 0) + 1;
        setUsage(id, next);
    };
    /**
     * 使用回数キャッシュを取得する
     */
    const getUsageCache = () => {
        return usageStorage.getCache();
    };
    /**
     * 使用回数を設定する
     */
    const setUsage = (id, count) => {
        usageStorage.setCacheEntry(id, count);
    };
    /**
     * 使用回数を整理する
     */
    const pruneUsage = (validIds) => {
        const usageCache = getUsageCache();
        const next = {};
        let changed = false;
        for (const id of Object.keys(usageCache)) {
            if (validIds.has(id)) {
                next[id] = usageCache[id];
            }
            else {
                changed = true;
            }
        }
        if (changed) {
            usageStorage.setCache(next);
        }
    };
    /**
     * サイトエントリを正規化する
     */
    function normalizeSite(entry) {
        if (!entry || typeof entry !== 'object')
            return null;
        const next = { ...entry };
        if (!next.type)
            next.type = 'site';
        if (!next.id)
            next.id = generateId('site');
        if (!Array.isArray(next.tags)) {
            if (typeof next.tags === 'string' && next.tags.trim()) {
                next.tags = next.tags.split(/[,\s]+/).filter(Boolean);
            }
            else {
                next.tags = [];
            }
        }
        if (next.type !== 'site')
            next.type = 'site';
        next.name = next.name || '';
        next.url = next.url || '';
        return next;
    }
    /**
     * IDを生成する
     */
    function generateId(prefix) {
        return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
    }

    /**
     * favicon要素を作成する
     */
    const createFaviconEl = (entry) => {
        const wrap = document.createElement('div');
        wrap.style.width = '20px';
        wrap.style.height = '20px';
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.justifyContent = 'center';
        const img = document.createElement('img');
        img.className = 'ico';
        img.decoding = 'async';
        let origin = null;
        const url = entry.url;
        try {
            origin = new URL(url).origin;
        }
        catch {
            origin = null;
        }
        // グローバルからgetFavCacheを取得（循環参照を避けるため）
        const getFavCache = () => {
            try {
                return window.GM_getValue?.('vm_sites_palette__favcache_v1', {}) || {};
            }
            catch {
                return {};
            }
        };
        const setFavCache = (origin, href) => {
            const favCache = getFavCache();
            favCache[origin] = href;
            window.GM_setValue?.('vm_sites_palette__favcache_v1', favCache);
        };
        const clearFavCacheOrigin = (origin) => {
            if (!origin)
                return;
            const favCache = getFavCache();
            if (favCache[origin]) {
                delete favCache[origin];
                window.GM_setValue?.('vm_sites_palette__favcache_v1', favCache);
            }
        };
        const cached = origin && getFavCache()[origin] ? getFavCache()[origin] : null;
        if (cached) {
            img.onload = () => wrap.appendChild(img);
            img.onerror = () => {
                if (origin)
                    clearFavCacheOrigin(origin);
                trySimple();
            };
            img.src = cached;
            return wrap;
        }
        if (origin) {
            discoverFavicon(origin, (href) => {
                if (href) {
                    img.onload = () => {
                        setFavCache(origin, href);
                        wrap.appendChild(img);
                    };
                    img.onerror = () => {
                        if (origin)
                            clearFavCacheOrigin(origin);
                        trySimple();
                    };
                    img.src = href;
                }
                else {
                    trySimple();
                }
            });
        }
        else {
            trySimple();
        }
        function trySimple() {
            const list = (() => {
                if (!origin)
                    return [];
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
                if (i >= list.length)
                    return fallback();
                img.src = list[i++];
            }
            img.onload = () => {
                if (origin)
                    setFavCache(origin, img.src);
                wrap.appendChild(img);
            };
            img.onerror = () => {
                if (origin)
                    clearFavCacheOrigin(origin);
                next();
            };
            next();
        }
        function fallback() {
            const letter = document.createElement('div');
            letter.className = 'ico-letter';
            const text = (entry.name || '').trim();
            const first = text ? text[0] : (origin ? origin.replace(/^https?:\/\//, '')[0] : '?');
            letter.textContent = (first || '?').toUpperCase();
            wrap.appendChild(letter);
        }
        return wrap;
    };
    /**
     * faviconを発見する
     */
    const discoverFavicon = (origin, done) => {
        const isDark = (() => {
            try {
                return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ||
                    document.documentElement.classList.contains('dark') ||
                    document.documentElement.dataset.colorMode === 'dark';
            }
            catch {
                return false;
            }
        })();
        GM_xmlhttpRequest({
            method: 'GET',
            url: origin + '/',
            onload: (res) => {
                try {
                    const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
                    const links = Array.from(doc.querySelectorAll('link[rel~="icon" i], link[rel="shortcut icon" i], link[rel~="mask-icon" i], link[rel~="apple-touch-icon" i]'));
                    if (!links.length)
                        return done(null);
                    function mediaMatch(m) {
                        try {
                            return m ? matchMedia(m).matches : true;
                        }
                        catch {
                            return true;
                        }
                    }
                    function score(link) {
                        const rel = (link.getAttribute('rel') || '').toLowerCase();
                        const href = link.getAttribute('href') || '';
                        const type = (link.getAttribute('type') || '').toLowerCase();
                        const sizes = (link.getAttribute('sizes') || '').toLowerCase();
                        const media = (link.getAttribute('media') || '').trim();
                        let s = 0;
                        if (rel.includes('icon'))
                            s += 10;
                        if (href.includes('favicon'))
                            s += 6;
                        if (type.includes('svg'))
                            s += 5;
                        if (sizes.includes('32x32'))
                            s += 3;
                        if (media)
                            s += mediaMatch(media) ? 8 : -20;
                        if (isDark) {
                            if (/dark/i.test(href))
                                s += 5;
                            if (/light/i.test(href))
                                s -= 2;
                        }
                        else {
                            if (/light/i.test(href))
                                s += 3;
                            if (/dark/i.test(href))
                                s -= 2;
                        }
                        return s;
                    }
                    const best = links.map(l => ({ l, s: score(l) })).sort((a, b) => b.s - a.s)[0];
                    if (!best)
                        return done(null);
                    const abs = new URL(best.l.getAttribute('href') || '', origin).href;
                    return done(abs);
                }
                catch {
                    done(null);
                }
            },
            onerror: () => done(null)
        });
    };

    /**
     * 仮想スクロール用のユーティリティ
     * 大量のアイテムを効率的に表示するための仮想スクロール機能を提供
     */
    /**
     * 仮想スクロールを管理するクラス
     * パフォーマンス最適化のための改善を実装
     */
    class VirtualScrollManager {
        constructor(options) {
            this.items = [];
            this.itemHeights = new Map();
            this.itemPositions = [];
            this.totalHeight = 0;
            this.lastScrollTop = 0;
            this.scrollDirection = 'none';
            this.visibleRangeCache = new Map();
            this.maxCacheSize = 10;
            this.containerHeight = options.containerHeight;
            this.itemHeight = options.itemHeight || 40;
            this.overscan = options.overscan || 5;
            this.estimatedItemHeight = options.estimatedItemHeight || options.itemHeight || 40;
        }
        /**
         * アイテムリストを設定
         */
        setItems(items) {
            this.items = items;
            this.visibleRangeCache.clear(); // キャッシュをクリア
            this.recalculatePositions();
        }
        /**
         * アイテムの高さを更新
         */
        updateItemHeight(itemId, height) {
            const oldHeight = this.itemHeights.get(itemId) || this.estimatedItemHeight;
            this.itemHeights.set(itemId, height);
            if (Math.abs(oldHeight - height) > 1) {
                this.visibleRangeCache.clear(); // キャッシュをクリア
                this.recalculatePositions();
            }
        }
        /**
         * アイテムの位置を再計算
         * パフォーマンス最適化のため、差分計算を実装
         */
        recalculatePositions() {
            this.itemPositions = [0];
            let currentY = 0;
            for (let i = 0; i < this.items.length; i++) {
                const item = this.items[i];
                const height = this.itemHeights.get(item.id) || this.estimatedItemHeight;
                currentY += height;
                this.itemPositions.push(currentY);
            }
            this.totalHeight = currentY;
        }
        /**
         * スクロール位置に基づいて表示範囲を計算
         * パフォーマンス最適化のため、キャッシュとバイナリサーチを実装
         */
        getVisibleRange(scrollTop) {
            // スクロール方向を検出
            this.scrollDirection = scrollTop > this.lastScrollTop ? 'down' : scrollTop < this.lastScrollTop ? 'up' : 'none';
            this.lastScrollTop = scrollTop;
            // キャッシュをチェック
            const cacheKey = Math.floor(scrollTop / 10) * 10; // 10px単位でキャッシュ
            if (this.visibleRangeCache.has(cacheKey)) {
                return this.visibleRangeCache.get(cacheKey);
            }
            let startIndex = 0;
            let endIndex = 0;
            // バイナリサーチで開始位置を特定
            let left = 0;
            let right = this.itemPositions.length - 1;
            while (left <= right) {
                const mid = Math.floor((left + right) / 2);
                if (this.itemPositions[mid] <= scrollTop && this.itemPositions[mid + 1] > scrollTop) {
                    startIndex = Math.max(0, mid - this.overscan);
                    break;
                }
                else if (this.itemPositions[mid] < scrollTop) {
                    left = mid + 1;
                }
                else {
                    right = mid - 1;
                }
            }
            // 終了位置を計算
            const visibleBottom = scrollTop + this.containerHeight;
            for (let i = startIndex; i < this.itemPositions.length - 1; i++) {
                if (this.itemPositions[i] < visibleBottom) {
                    endIndex = i;
                }
                else {
                    break;
                }
            }
            endIndex = Math.min(this.items.length - 1, endIndex + this.overscan);
            const result = {
                scrollTop,
                startIndex,
                endIndex,
                offsetY: this.itemPositions[startIndex] || 0
            };
            // キャッシュに保存
            if (this.visibleRangeCache.size >= this.maxCacheSize) {
                const firstKey = this.visibleRangeCache.keys().next().value;
                if (firstKey !== undefined) {
                    this.visibleRangeCache.delete(firstKey);
                }
            }
            this.visibleRangeCache.set(cacheKey, result);
            return result;
        }
        /**
         * 表示すべきアイテムを取得
         * パフォーマンス最適化のため、メモリ割り当てを最小化
         */
        getVisibleItems(scrollTop) {
            const position = this.getVisibleRange(scrollTop);
            const visibleItems = [];
            const styleCache = {};
            for (let i = position.startIndex; i <= position.endIndex; i++) {
                if (i < this.items.length) {
                    const item = this.items[i];
                    const top = this.itemPositions[i];
                    const height = this.itemHeights.get(item.id) || this.estimatedItemHeight;
                    // スタイルオブジェクトを再利用
                    const styleKey = `${top}-${height}`;
                    let style = styleCache[styleKey];
                    if (!style) {
                        style = {
                            position: 'absolute',
                            top: `${top}px`,
                            left: '0',
                            right: '0',
                            height: `${height}px`,
                            zIndex: i
                        };
                        styleCache[styleKey] = style;
                    }
                    visibleItems.push({
                        item,
                        index: i,
                        style
                    });
                }
            }
            return visibleItems;
        }
        /**
         * 総高さを取得
         */
        getTotalHeight() {
            return this.totalHeight;
        }
        /**
         * アイテム数を取得
         */
        getItemCount() {
            return this.items.length;
        }
        /**
         * 指定されたインデックスのアイテムを取得
         */
        getItemAtIndex(index) {
            return index >= 0 && index < this.items.length ? this.items[index] : null;
        }
        /**
         * 指定されたアイテムのインデックスを取得
         */
        getItemIndex(itemId) {
            return this.items.findIndex(item => item.id === itemId);
        }
        /**
         * スクロールしてアイテムを表示
         */
        scrollToItem(itemId, container, alignment = 'start') {
            const index = this.getItemIndex(itemId);
            if (index === -1)
                return;
            const itemTop = this.itemPositions[index];
            const itemHeight = this.itemHeights.get(itemId) || this.estimatedItemHeight;
            const itemBottom = itemTop + itemHeight;
            let scrollTop;
            switch (alignment) {
                case 'start':
                    scrollTop = itemTop;
                    break;
                case 'center':
                    scrollTop = itemTop - (this.containerHeight - itemHeight) / 2;
                    break;
                case 'end':
                    scrollTop = itemBottom - this.containerHeight;
                    break;
            }
            scrollTop = Math.max(0, Math.min(scrollTop, this.totalHeight - this.containerHeight));
            container.scrollTop = scrollTop;
        }
    }
    /**
     * 仮想スクロールコンテナを作成するヘルパー関数
     */
    function createVirtualScrollContainer(options) {
        const container = document.createElement('div');
        container.style.height = `${options.containerHeight}px`;
        container.style.overflow = 'auto';
        container.style.position = 'relative';
        const content = document.createElement('div');
        content.style.position = 'relative';
        content.style.width = '100%';
        const manager = new VirtualScrollManager({
            containerHeight: options.containerHeight,
            itemHeight: options.itemHeight
        });
        container.addEventListener('scroll', () => {
            const position = manager.getVisibleRange(container.scrollTop);
            options.onScroll?.(position);
        });
        container.appendChild(content);
        return { container, content, manager };
    }

    /**
     * イベントリスナー関連のユーティリティ関数
     */
    /**
     * イベントリスナー設定の共通オブジェクト
     */
    const EventListeners = {
        /**
         * 要素にクリックイベントリスナーを追加する
         */
        addClick: (element, handler) => {
            element?.addEventListener('click', handler);
        },
        /**
         * 要素にキーダウンイベントリスナーを追加する
         */
        addKeydown: (element, handler) => {
            element?.addEventListener('keydown', handler);
        },
        /**
         * 要素に入力イベントリスナーを追加する
         */
        addInput: (element, handler) => {
            element?.addEventListener('input', handler);
        },
        /**
         * 要素にフォーカスイベントリスナーを追加する
         */
        addFocus: (element, handler) => {
            element?.addEventListener('focus', handler);
        },
        /**
         * 要素にブラーイベントリスナーを追加する
         */
        addBlur: (element, handler) => {
            element?.addEventListener('blur', handler);
        },
        /**
         * 要素にマウスエンターイベントリスナーを追加する
         */
        addMouseEnter: (element, handler) => {
            element?.addEventListener('mouseenter', handler);
        },
        /**
         * 要素にマウスダウンイベントリスナーを追加する
         */
        addMouseDown: (element, handler) => {
            element?.addEventListener('mousedown', handler);
        },
        /**
         * 要素にマウスアップイベントリスナーを追加する
         */
        addMouseUp: (element, handler) => {
            element?.addEventListener('mouseup', handler);
        },
        /**
         * 要素にマウスムーブイベントリスナーを追加する
         */
        addMouseMove: (element, handler) => {
            element?.addEventListener('mousemove', handler);
        },
        /**
         * 要素にマウスリーブイベントリスナーを追加する
         */
        addMouseLeave: (element, handler) => {
            element?.addEventListener('mouseleave', handler);
        },
        /**
         * 要素にコンテキストメニューリスナーを追加する
         */
        addContextMenu: (element, handler) => {
            element?.addEventListener('contextmenu', handler);
        },
        /**
         * 要素にホイールイベントリスナーを追加する
         */
        addWheel: (element, handler) => {
            element?.addEventListener('wheel', handler);
        },
        /**
         * 要素にサブミットイベントリスナーを追加する
         */
        addSubmit: (element, handler) => {
            element?.addEventListener('submit', handler);
        },
        /**
         * 要素にチェンジイベントリスナーを追加する
         */
        addChange: (element, handler) => {
            element?.addEventListener('change', handler);
        },
        /**
         * 要素にタッチスタートイベントリスナーを追加する
         */
        addTouchStart: (element, handler) => {
            element?.addEventListener('touchstart', handler);
        },
        /**
         * 要素にタッチムーブイベントリスナーを追加する
         */
        addTouchMove: (element, handler) => {
            element?.addEventListener('touchmove', handler);
        },
        /**
         * 要素にタッチエンドイベントリスナーを追加する
         */
        addTouchEnd: (element, handler) => {
            element?.addEventListener('touchend', handler);
        }
    };
    // 後方互換性のために個別関数もエクスポート
    /**
     * 要素にクリックイベントリスナーを追加する
     */
    const addClickListener = EventListeners.addClick;
    /**
     * 要素にキーダウンイベントリスナーを追加する
     */
    const addKeydownListener = EventListeners.addKeydown;
    /**
     * 要素に入力イベントリスナーを追加する
     */
    const addInputListener = EventListeners.addInput;
    /**
     * 要素にブラーイベントリスナーを追加する
     */
    const addBlurListener = EventListeners.addBlur;
    /**
     * 要素にマウスエンターイベントリスナーを追加する
     */
    const addMouseEnterListener = EventListeners.addMouseEnter;
    /**
     * 要素にマウスダウンイベントリスナーを追加する
     */
    const addMouseDownListener = EventListeners.addMouseDown;
    /**
     * オートコンプリート用の特殊なイベント設定
     * 入力フィールドとオートコンプリートリストの連携を設定する
     */
    const setupAutocompleteEvents = (inputEl, autocompleteEl, onHide) => {
        // 入力フィールドのフォーカスが外れた時の処理
        addBlurListener(inputEl, (e) => {
            const to = e.relatedTarget;
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
            e.preventDefault(); // 入力の blur を抑止
            inputEl.focus(); // フォーカスを戻す
        });
    };
    /**
     * フォーカストラップを作成する
     * 指定されたコンテナ内にフォーカスを制限する
     */
    const createFocusTrap = (container) => {
        let isActive = false;
        let previousActiveElement = null;
        let keydownHandler = null;
        /**
         * コンテナ内のフォーカス可能な要素を取得する
         */
        const getFocusableElements = () => {
            const focusableSelectors = [
                'button:not([disabled])',
                'input:not([disabled])',
                'select:not([disabled])',
                'textarea:not([disabled])',
                'a[href]',
                '[tabindex]:not([tabindex="-1"])',
                '[contenteditable="true"]'
            ].join(', ');
            const elements = Array.from(container.querySelectorAll(focusableSelectors));
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
        const focusFirstElement = () => {
            const focusableElements = getFocusableElements();
            if (focusableElements.length > 0) {
                focusableElements[0].focus();
            }
        };
        /**
         * キーダウンイベントハンドラ
         */
        const handleKeydown = (e) => {
            if (e.key !== 'Tab')
                return;
            const focusableElements = getFocusableElements();
            if (focusableElements.length === 0)
                return;
            const currentElement = document.activeElement;
            const currentIndex = focusableElements.indexOf(currentElement);
            let targetIndex;
            if (e.shiftKey) {
                // Shift+Tab: 前の要素へ
                targetIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
            }
            else {
                // Tab: 次の要素へ
                targetIndex = currentIndex >= focusableElements.length - 1 ? 0 : currentIndex + 1;
            }
            e.preventDefault();
            focusableElements[targetIndex].focus();
        };
        /**
         * フォーカストラップを有効化
         */
        const activate = () => {
            if (isActive)
                return;
            isActive = true;
            previousActiveElement = document.activeElement;
            // キーダウンイベントリスナーを追加
            keydownHandler = handleKeydown;
            container.addEventListener('keydown', keydownHandler, true);
            // 最初の要素にフォーカス
            setTimeout(() => focusFirstElement(), 0);
        };
        /**
         * フォーカストラップを無効化
         */
        const deactivate = () => {
            if (!isActive)
                return;
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
        const isTrapActive = () => isActive;
        return {
            activate,
            deactivate,
            isActive: isTrapActive
        };
    };

    /**
     * タイミング関連のユーティリティ関数
     */
    /**
     * タイミングユーティリティの共通オブジェクト
     */
    const TimingUtils = {
        /**
         * 指定した時間だけ遅延するPromiseを返す
         */
        delay: (ms) => {
            return new Promise(resolve => setTimeout(resolve, ms));
        },
        /**
         * 基本的なsetTimeout関数
         */
        setTimeout: (callback, delay) => {
            return setTimeout(callback, delay);
        },
        /**
         * 即時実行タイムアウトを設定する
         */
        setImmediate: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.IMMEDIATE);
        },
        /**
         * 自動オープン用の遅延タイムアウトを設定する
         */
        setAutoOpen: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.AUTO_OPEN_DELAY);
        },
        /**
         * トースト非表示用の遅延処理を実行する
         */
        hideToast: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.TOAST_HIDE_DELAY);
        },
        /**
         * 入力フィールドにスペースを追加する
         */
        addInputSpace: (inputEl) => {
            TimingUtils.setTimeout(() => {
                inputEl.value += ' ';
            }, TIMING.INPUT_SPACE_DELAY);
        },
        /**
         * ブラーチェック用の遅延処理を実行する
         */
        setBlurCheck: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.BLUR_CHECK_DELAY);
        },
        /**
         * URL破棄用の遅延処理を実行する
         */
        setUrlRevoke: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.URL_REVOKE_DELAY);
        },
        /**
         * トースト表示用の遅延処理を実行する
         */
        setToast: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.TOAST_DURATION);
        },
        /**
         * ドラッグ開始用の遅延処理を実行する
         */
        setDragStart: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.DRAG_START_DELAY);
        },
        /**
         * アニメーションオフセット用の遅延処理を実行する
         */
        setAnimationOffset: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.ANIMATION_OFFSET);
        },
        /**
         * フォーカス設定用の遅延処理を実行する
         */
        setFocus: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.FOCUS_DELAY);
        },
        /**
         * デバウンス用の遅延処理を実行する
         */
        setDebounce: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.INPUT_DEBOUNCE);
        },
        /**
         * 仮想スクロール用のデバウンス遅延処理を実行する
         */
        setVirtualScroll: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.VIRTUAL_SCROLL_DEBOUNCE);
        },
        /**
         * オートコンプリート非表示用の遅延処理を実行する
         */
        hideAutocomplete: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.AUTOCOMPLETE_HIDE_DELAY);
        },
        /**
         * フォーカストラップ用の遅延処理を実行する
         */
        setFocusTrap: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.FOCUS_TRAP_DELAY);
        },
        /**
         * オーバーレイ非表示用の遅延処理を実行する
         */
        hideOverlay: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.OVERLAY_HIDE_DELAY);
        },
        /**
         * アニメーションフレーム用の遅延処理を実行する
         */
        setAnimationFrame: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.ANIMATION_FRAME_DELAY);
        },
        /**
         * ダブルクリック用の遅延処理を実行する
         */
        setDoubleClick: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.DOUBLE_CLICK_DELAY);
        },
        /**
         * ホールド用の遅延処理を実行する
         */
        setHold: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.HOLD_DELAY);
        },
        /**
         * リサイズデバウンス用の遅延処理を実行する
         */
        setResizeDebounce: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.RESIZE_DEBOUNCE);
        },
        /**
         * スクロールデバウンス用の遅延処理を実行する
         */
        setScrollDebounce: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.SCROLL_DEBOUNCE);
        },
        /**
         * キー入力用の遅延処理を実行する
         */
        setKeyInput: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.KEY_INPUT_DELAY);
        },
        /**
         * メニュー表示用の遅延処理を実行する
         */
        showMenu: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.MENU_SHOW_DELAY);
        },
        /**
         * メニュー非表示用の遅延処理を実行する
         */
        hideMenu: (callback) => {
            return TimingUtils.setTimeout(callback, TIMING.MENU_HIDE_DELAY);
        },
        /**
         * 指定した時間だけ待機してからコールバックを実行する
         */
        waitAndExecute: (ms, callback) => {
            return TimingUtils.setTimeout(callback, ms);
        },
        /**
         * タイムアウトをクリアする安全な関数
         */
        clearSafeTimeout: (timeoutId) => {
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
            }
        }
    };
    /**
     * ブラーチェック用の遅延処理を実行する
     */
    const setBlurCheckTimeout = TimingUtils.setBlurCheck;
    /**
     * URL破棄用の遅延処理を実行する
     */
    const setUrlRevokeTimeout = TimingUtils.setUrlRevoke;
    /**
     * フォーカス設定用の遅延処理を実行する
     */
    const setFocusTimeout = TimingUtils.setFocus;

    /**
     * パレットUIの生成と管理を担当するクラス
     * UIの生成、スタイルの適用、DOM要素の作成などを行う
     */
    class PaletteUI {
        constructor(state, dom) {
            this.virtualScrollManager = null;
            this.virtualScrollContainer = null;
            this.virtualScrollContent = null;
            this.VIRTUAL_SCROLL_THRESHOLD = 50; // 50アイテム以上で仮想スクロールを有効化
            this.focusTrap = null;
            this.state = state;
            this.dom = dom;
        }
        /**
         * Shadow Rootホストを確保する
         */
        ensureRoot() {
            if (this.dom.host)
                return;
            this.dom.host = document.createElement('div');
            this.dom.host.id = 'vm-cmd-palette-host';
            this.dom.host.style.all = 'initial';
            document.documentElement.appendChild(this.dom.host);
            this.dom.root = this.dom.host.attachShadow({ mode: 'open' });
        }
        /**
         * テーマを適用する
         */
        applyTheme(settings) {
            if (!this.dom.root)
                return;
            const currentSettings = settings || this.state.cachedSettings;
            if (!currentSettings)
                return;
            const theme = currentSettings.theme === 'light' ? themes.light : themes.dark;
            const vars = { ...theme, '--accent-color': currentSettings.accentColor || '#2563eb' };
            const docStyle = this.dom.host.style;
            Object.entries(vars).forEach(([key, value]) => {
                docStyle.setProperty(key, value);
            });
        }
        /**
         * パレットUIを作成する
         */
        createPaletteUI() {
            try {
                // Rootが確保されているか確認
                if (!this.dom.root) {
                    console.error('[CommandPalette] Shadow root not available');
                    return;
                }
                const style = this.createPaletteStyles();
                this.dom.root.appendChild(style);
                // オーバーレイ要素を作成
                this.dom.overlayEl = this.createOverlayElement();
                // パネル要素を作成
                const panel = this.createPanelElement();
                if (this.dom.overlayEl) {
                    this.dom.overlayEl.appendChild(panel);
                }
                // トースト要素を作成
                this.dom.toastEl = this.createToastElement();
                // マネージャと設定のCSSを追加
                const managerStyle = this.createManagerStyles();
                this.dom.root.appendChild(managerStyle);
                // nullチェックを追加してからappendChild
                if (this.dom.root) {
                    if (this.dom.overlayEl) {
                        this.dom.root.appendChild(this.dom.overlayEl);
                    }
                    if (this.dom.toastEl) {
                        this.dom.root.appendChild(this.dom.toastEl);
                    }
                }
                // グローバルアクセス用
                if (this.dom.toastEl) {
                    window.toastEl = this.dom.toastEl;
                }
            }
            catch (error) {
                console.error('[CommandPalette] Error creating palette UI:', error);
            }
        }
        /**
         * パレットのスタイルを作成
         */
        createPaletteStyles() {
            const style = document.createElement('style');
            style.textContent = `
      :host { all: initial; }
      .overlay { position: fixed; inset: 0; background: var(--overlay-bg); display: none; z-index: 2147483647; backdrop-filter: blur(1px); opacity: 0; transition: opacity 160ms ease; }
      .overlay.visible { opacity: 1; }
      .panel { position: absolute; left: 50%; top: 16%; transform: translateX(-50%); width: min(720px, 92vw); background: var(--panel-bg); color: var(--panel-text); border-radius: 14px; box-shadow: var(--panel-shadow); overflow: hidden; font-family: ui-sans-serif, -apple-system, system-ui, Segoe UI, Roboto, 'Helvetica Neue', Arial, 'Apple Color Emoji','Segoe UI Emoji'; border: 1px solid var(--border-color); opacity: 0; transform: translate(-50%, calc(-8px)); transition: opacity 200ms ease, transform 200ms ease; }
      .overlay.visible .panel { opacity: 1; transform: translate(-50%, 0); }
      .input { width: 100%; box-sizing: border-box; padding: 14px 16px; font-size: 15px; background: var(--input-bg); color: var(--input-text); border: none; outline: none; }
      .input::placeholder { color: var(--input-placeholder); }
      .hint { padding: 6px 12px; font-size: 12px; color: var(--muted); border-top: 1px solid var(--border-color); background: var(--hint-bg); display: flex; align-items: center; justify-content: space-between; }
      .link { cursor: pointer; color: var(--accent-color); }
      .list { max-height: min(80vh, 1037px); overflow-y: auto; overflow-x: hidden; scrollbar-width: none; }
      .list::-webkit-scrollbar { width: 0; height: 0; }
      .item { display: grid; grid-template-columns: 28px 1fr auto; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer; transition: background 0.12s ease, transform 0.12s ease; }
      .item:nth-child(odd) { background: var(--item-bg-alt); }
      .item.active { background: var(--item-active); transform: translateX(2px); }
      .item .name { font-size: 14px; display: flex; align-items: center; gap: 6px; }
      .item .name .command-badge { margin-left: 0; }
      .item .url { font-size: 12px; color: var(--muted); }
      .item img.ico { width: 18px; height: 18px; border-radius: 4px; object-fit: contain; background: #fff; border: 1px solid var(--border-color); }
      .item .ico-letter { width: 18px; height: 18px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--hint-bg); color: var(--panel-text); font-size: 10px; font-weight: 600; display: flex; align-items: center; justify-content: center; text-transform: uppercase; }
      .item .tag-badges { display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; }
      .tag { display: inline-flex; align-items: center; padding: 2px 6px; background: var(--tag-bg); color: var(--tag-text); font-size: 10px; border-radius: 999px; }
      .tag::before { content: '#'; opacity: 0.7; margin-right: 2px; }
      .empty { padding: 18px 14px; color: var(--muted); font-size: 14px; }
      .kbd { display: inline-block; padding: 2px 6px; border-radius: 6px; background: var(--hint-bg); border: 1px solid var(--border-color); font-size: 12px; color: var(--input-text); }
      .command-badge { margin-left: 6px; padding: 2px 6px; border-radius: 6px; background: var(--command-badge-bg); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--panel-text); }
      .group-title { padding: 8px 16px 4px; font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
    `;
            return style;
        }
        /**
         * マネージャと設定のスタイルを作成
         */
        createManagerStyles() {
            const style = document.createElement('style');
            style.textContent = `
      /* Manager / Settings */
      .mgr-overlay, .set-overlay { position: fixed; inset: 0; background: var(--overlay-bg); display: none; z-index: 2147483647; }
      .mgr, .set { position: absolute; left: 50%; top: 8%; transform: translateX(-50%); width: min(860px, 94vw); background: var(--panel-bg); color: var(--panel-text); border-radius: 14px; box-shadow: var(--panel-shadow); font-family: ui-sans-serif, -apple-system, system-ui, Segoe UI, Roboto, 'Helvetica Neue', Arial, 'Apple Color Emoji','Segoe UI Emoji'; border: 1px solid var(--border-color); }
      .mgr header, .set header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--border-color); }
      .mgr header h3, .set header h3 { margin: 0; font-size: 16px; }
      .mgr-tabs { display: flex; gap: 8px; margin-bottom: 10px; }
      .tab-btn { flex: none; }
      .tab-btn.active { box-shadow: inset 0 0 0 2px rgba(255,255,255,0.12); }
      .mgr-tab.hidden { display: none; }
      .mgr .tbl { width: 100%; border-collapse: collapse; font-size: 14px; }
      .mgr .tbl th, .mgr .tbl td { border-bottom: 1px solid var(--border-color); padding: 8px 10px; vertical-align: top; }
      .mgr .tbl th { text-align: left; color: var(--muted); font-weight: 600; }
      .mgr input[type=text], .mgr textarea, .set input[type=text], .set textarea, .set select, .set input[type=color] { width: 100%; box-sizing: border-box; padding: 6px 8px; font-size: 14px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--input-text); border-radius: 8px; }
      .mgr textarea { resize: vertical; min-height: 56px; }
      .mgr .row-btns button { margin-right: 6px; }
      .btn { padding: 6px 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--panel-text); cursor: pointer; transition: transform 0.12s ease, box-shadow 0.12s ease; }
      .btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,0,0,0.18); }
      .btn.primary { background: var(--accent-color); border-color: var(--accent-color); color: #fff; }
      .btn.danger { background: #7f1d1d; border-color: #7f1d1d; color: #fee2e2; }
      .mgr footer, .set footer { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; }
      .muted { color: var(--muted); font-size: 12px; }
      .drag { cursor: grab; }
      .form-row { display: grid; grid-template-columns: 200px 1fr; gap: 12px; align-items: center; padding: 10px 14px; }
      .inline { display: flex; gap: 12px; align-items: center; }
      .hotkey-box { text-align: center; font-size: 14px; padding: 8px 10px; border: 1px dashed var(--border-color); border-radius: 8px; user-select: none; background: var(--input-bg); color: var(--input-text); }
      .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 11px; background: var(--command-badge-bg); color: var(--panel-text); }
      .toast { position: fixed; inset: auto 0 24px 0; display: none; justify-content: center; pointer-events: none; }
      .toast-message { background: var(--toast-bg); color: var(--toast-text); padding: 10px 16px; border-radius: 999px; box-shadow: 0 10px 20px rgba(0,0,0,0.2); animation: fade-slide 2.4s ease forwards; }
      @keyframes fade-slide {
        0% { opacity: 0; transform: translateY(18px); }
        10% { opacity: 1; transform: translateY(0); }
        90% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(12px); }
      }

      /* タグ候補 */
      .tag-suggestion {
        display: grid;
        grid-template-columns: 28px 1fr auto;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        cursor: pointer;
        transition: background 0.12s ease, transform 0.12s ease;
        background: var(--tag-suggestion-bg);
        border-bottom: 1px solid var(--border-color);
        border-radius: 0;
      }
      .tag-suggestion:first-child { border-radius: 8px 8px 0 0; }
      .tag-suggestion:last-child { border-radius: 0 0 8px 8px; border-bottom: none; }
      .tag-suggestion:hover, .tag-suggestion.active {
        background: var(--item-active);
        transform: translateX(2px);
      }
      .tag-suggestion .tag-icon {
        width: 18px;
        height: 18px;
        border-radius: 4px;
        background: var(--accent-color);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
      }
      .tag-suggestion .tag-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .tag-suggestion .tag-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--panel-text);
      }
      .tag-suggestion .tag-path {
        font-size: 11px;
        color: var(--muted);
      }
      .tag-suggestion .tag-count {
        font-size: 12px;
        color: var(--muted);
      }
      .tag-suggestion .kbd {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 6px;
        background: var(--hint-bg);
        border: 1px solid var(--border-color);
        font-size: 12px;
        color: var(--input-text);
      }
    `;
            return style;
        }
        /**
         * 仮想スクロールイベントを処理（イベントハンドラから呼び出される）
         */
        handleVirtualScroll(position) {
            // このメソッドは外部から設定されるコールバックを呼び出す
            // 実際の処理はPaletteクラスで実装される
        }
        /**
         * 仮想スクロールイベントハンドラを設定
         */
        setVirtualScrollHandler(handler) {
            this.handleVirtualScroll = handler;
        }
        /**
         * オーバーレイ要素を作成
         */
        createOverlayElement() {
            const overlay = document.createElement('div');
            overlay.className = 'overlay';
            return overlay;
        }
        /**
         * パネル要素を作成
         */
        createPanelElement() {
            const panel = document.createElement('div');
            panel.className = 'panel';
            // 入力要素を作成
            this.dom.inputEl = document.createElement('input');
            this.dom.inputEl.className = 'input';
            this.dom.inputEl.type = 'text';
            // リスト要素を作成
            this.dom.listEl = document.createElement('div');
            this.dom.listEl.className = 'list';
            // ヒント要素を作成
            this.dom.hintEl = document.createElement('div');
            this.dom.hintEl.className = 'hint';
            this.dom.hintLeftSpan = document.createElement('span');
            this.dom.hintLeftSpan.textContent = '↑↓: 移動 / Enter: 開く / Shift+Enter: 新規タブ / Tab: タグ選択 / Esc: 閉じる';
            const rightSpan = document.createElement('span');
            rightSpan.innerHTML = '<span class="link" id="vm-open-manager" tabindex="0">サイトマネージャを開く</span> · <span class="link" id="vm-open-settings" tabindex="0">設定</span> · ⌘P / Ctrl+P';
            // nullチェックを追加
            if (this.dom.hintEl && this.dom.hintLeftSpan && rightSpan) {
                this.dom.hintEl.appendChild(this.dom.hintLeftSpan);
                this.dom.hintEl.appendChild(rightSpan);
            }
            if (panel && this.dom.inputEl && this.dom.listEl && this.dom.hintEl) {
                panel.appendChild(this.dom.inputEl);
                panel.appendChild(this.dom.listEl);
                panel.appendChild(this.dom.hintEl);
            }
            return panel;
        }
        /**
         * トースト要素を作成
         */
        createToastElement() {
            const toast = document.createElement('div');
            toast.className = 'toast';
            return toast;
        }
        /**
         * 仮想スクロールをセットアップ
         */
        setupVirtualScroll() {
            if (!this.dom.listEl)
                return;
            // 既存の仮想スクロールコンテナをクリア
            if (this.virtualScrollContainer) {
                this.dom.listEl.removeChild(this.virtualScrollContainer);
                this.virtualScrollContainer = null;
                this.virtualScrollContent = null;
                this.virtualScrollManager = null;
            }
            // 仮想スクロールコンテナを作成
            const { container, content, manager } = createVirtualScrollContainer({
                containerHeight: 600, // 固定高さ
                itemHeight: 50, // 推定アイテム高さ
                onScroll: (position) => {
                    // スクロールイベントはイベントハンドラで処理
                    this.handleVirtualScroll(position);
                }
            });
            this.virtualScrollContainer = container;
            this.virtualScrollContent = content;
            this.virtualScrollManager = manager;
            // コンテナをリストに追加
            this.dom.listEl.appendChild(container);
        }
        /**
         * リストアイテム要素を作成
         */
        createListItem(entry, index) {
            const item = document.createElement('div');
            item.className = 'item';
            item.dataset.index = index.toString();
            item.dataset.id = entry.id;
            // ファビコンを作成
            const favicon = createFaviconEl(entry);
            item.appendChild(favicon);
            // 名前とURLのコンテナを作成
            const info = document.createElement('div');
            info.className = 'info';
            const name = document.createElement('div');
            name.className = 'name';
            name.textContent = entry.name;
            // コマンドバッジを追加
            if (entry.type === 'command') {
                const badge = document.createElement('span');
                badge.className = 'command-badge';
                badge.textContent = 'CMD';
                name.appendChild(badge);
            }
            const url = document.createElement('div');
            url.className = 'url';
            url.textContent = entry.url;
            info.appendChild(name);
            info.appendChild(url);
            // タグバッジを追加
            if (entry.tags && entry.tags.length > 0) {
                const tagBadges = document.createElement('div');
                tagBadges.className = 'tag-badges';
                entry.tags.forEach(tag => {
                    const tagEl = document.createElement('span');
                    tagEl.className = 'tag';
                    tagEl.textContent = tag;
                    tagBadges.appendChild(tagEl);
                });
                info.appendChild(tagBadges);
            }
            item.appendChild(info);
            return item;
        }
        /**
         * アクティブなアイテムを更新
         */
        updateActive(activeIndex) {
            if (!this.dom.listEl)
                return;
            const items = this.dom.listEl.querySelectorAll('.item');
            items.forEach((item, index) => {
                if (index === activeIndex) {
                    item.classList.add('active');
                }
                else {
                    item.classList.remove('active');
                }
            });
            // 仮想スクロールの場合はアクティブアイテムまでスクロール
            if (this.virtualScrollManager && this.virtualScrollContainer) {
                const activeItem = items[activeIndex];
                if (activeItem) {
                    const itemId = activeItem.dataset.id;
                    if (itemId) {
                        this.virtualScrollManager.scrollToItem(itemId, this.virtualScrollContainer, 'center');
                    }
                }
            }
        }
        /**
         * 仮想スクロールを使用してリストをレンダリング
         */
        renderVirtualList(scored, hasQuery) {
            if (!this.dom.listEl)
                return;
            // 仮想スクロールコンテナを初期化
            if (!this.virtualScrollManager) {
                this.setupVirtualScroll();
            }
            // 仮想スクロール用のアイテムデータに変換
            const virtualItems = scored.map((entry, index) => ({
                id: entry.id,
                data: { entry, index }
            }));
            this.virtualScrollManager.setItems(virtualItems);
            // 現在のスクロール位置で表示すべきアイテムを取得
            const scrollTop = this.virtualScrollContainer?.scrollTop || 0;
            const visibleItems = this.virtualScrollManager.getVisibleItems(scrollTop);
            // コンテンツの高さを設定
            if (this.virtualScrollContent) {
                this.virtualScrollContent.style.height = `${this.virtualScrollManager.getTotalHeight()}px`;
                this.virtualScrollContent.innerHTML = '';
                // 表示アイテムをシンプルにレンダリング（アニメーションなし）
                visibleItems.forEach(({ item, index, style }) => {
                    const { entry } = item.data;
                    const itemEl = this.createListItem(entry, index);
                    itemEl.setAttribute('style', Object.entries(style).map(([k, v]) => `${k}: ${v}`).join('; '));
                    this.virtualScrollContent.appendChild(itemEl);
                });
            }
        }
        /**
         * 通常のリストをレンダリング
         */
        renderNormalList(scored, hasQuery) {
            if (!this.dom.listEl)
                return;
            this.dom.listEl.innerHTML = '';
            if (!scored.length) {
                const empty = document.createElement('div');
                empty.className = 'empty';
                empty.textContent = hasQuery ? '一致なし' : 'サイトが登録されていません。サイトマネージャで追加してください。';
                this.dom.listEl.appendChild(empty);
                return;
            }
            // アイテムをシンプルに追加（アニメーションなし）
            scored.forEach((entry, idx) => {
                const item = this.createListItem(entry, idx);
                this.dom.listEl.appendChild(item);
            });
        }
        /**
         * フォーカストラップを有効化
         */
        activateFocusTrap() {
            if (!this.dom.overlayEl)
                return;
            this.focusTrap = createFocusTrap(this.dom.overlayEl);
            this.focusTrap.activate();
        }
        /**
         * フォーカストラップを無効化
         */
        deactivateFocusTrap() {
            if (this.focusTrap) {
                this.focusTrap.deactivate();
                this.focusTrap = null;
            }
        }
        /**
         * パレットを表示
         */
        showPalette() {
            if (!this.dom.overlayEl)
                return;
            this.dom.overlayEl.style.display = 'block';
            // CSSベースの遷移を発火
            this.dom.overlayEl.classList.add('visible');
            setFocusTimeout(() => {
                if (this.dom.inputEl) {
                    this.dom.inputEl.focus();
                }
            });
        }
        /**
         * パレットを非表示
         */
        hidePalette() {
            if (!this.dom.overlayEl)
                return;
            this.dom.overlayEl.classList.remove('visible');
            // CSSのtransition時間を踏まえて余裕を持って隠す
            setTimeout(() => {
                if (this.dom.overlayEl && !this.state.isOpen) {
                    this.dom.overlayEl.style.display = 'none';
                }
            }, 220);
        }
        /**
         * 入力フィールドをクリア
         */
        clearInput() {
            if (this.dom.inputEl) {
                this.dom.inputEl.value = '';
            }
        }
        /**
         * 入力フィールドにプレースホルダーを設定
         */
        setInputPlaceholder(placeholder) {
            if (this.dom.inputEl) {
                this.dom.inputEl.placeholder = placeholder;
            }
        }
        /**
         * 入力フィールドの値を取得
         */
        getInputValue() {
            return this.dom.inputEl?.value || '';
        }
        /**
         * 仮想スクロールマネージャーを取得
         */
        getVirtualScrollManager() {
            return this.virtualScrollManager;
        }
        /**
         * 仮想スクロールコンテナを取得
         */
        getVirtualScrollContainer() {
            return this.virtualScrollContainer;
        }
        /**
         * 仮想スクロールコンテンツを取得
         */
        getVirtualScrollContent() {
            return this.virtualScrollContent;
        }
        /**
         * 仮想スクロールしきい値を取得
         */
        getVirtualScrollThreshold() {
            return this.VIRTUAL_SCROLL_THRESHOLD;
        }
    }

    /**
     * デバウンスユーティリティ関数
     */
    /**
     * 指定された遅延時間後に関数を実行するデバウンス関数を作成
     */
    function debounce(func, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func(...args), delay);
        };
    }

    /**
     * 文字列を正規化する
     */
    const normalize = (str) => {
        return (str || '').toLowerCase();
    };
    /**
     * HTMLをエスケープする
     */
    const escapeHtml = (str) => {
        const s = str || '';
        const escapeMap = {
            '&': '&',
            '<': '<',
            '>': '>',
            '"': '"',
            "'": '&#039;'
        };
        return s.replace(/[&<>"']/g, m => escapeMap[m] || m);
    };
    /**
     * ワイルドカードマッチング
     */
    const wildcard = (str, pattern) => {
        const re = new RegExp('^' + pattern.split('*').map(x => x.replace(/[\.^$+?()|{}\[\]]/g, r => '\\' + r)).join('.*') + '$', 'i');
        return re.test(str);
    };

    /**
     * タグフィルタを抽出する
     */
    const extractTagFilter = (query) => {
        const trimmed = query.trim();
        if (!trimmed.startsWith('#'))
            return { tagFilter: null, textQuery: query };
        // #タグ名 の形式を処理
        const hashIndex = trimmed.indexOf('#');
        const afterHash = trimmed.slice(hashIndex + 1);
        // #のみの場合はnullを返す
        if (afterHash === '') {
            return { tagFilter: null, textQuery: '' };
        }
        // スペースでタグと検索語を分離
        const spaceIndex = afterHash.indexOf(' ');
        if (spaceIndex === -1) {
            // #タグ名 のみの場合
            const tag = normalize(afterHash);
            return { tagFilter: tag || null, textQuery: '' };
        }
        else {
            // #タグ名 検索語 の場合
            const tag = normalize(afterHash.slice(0, spaceIndex));
            const textQuery = afterHash.slice(spaceIndex + 1).trim();
            return { tagFilter: tag || null, textQuery };
        }
    };
    /**
     * タグ候補を表示すべきか判定する
     */
    const shouldShowTagSuggestions = (query) => {
        const trimmed = query.trim();
        if (!trimmed.startsWith('#'))
            return false;
        // #タグ名 の形式で、まだスペースがない場合にタグ候補を表示
        const hashIndex = trimmed.indexOf('#');
        const afterHash = trimmed.slice(hashIndex + 1);
        return !afterHash.includes(' ');
    };
    /**
     * すべてのタグを取得する
     */
    const getAllTags = (entries = []) => {
        // 省略時はストレージから取得
        if (!entries || entries.length === 0) {
            try {
                entries = getSites();
            }
            catch (_) {
                entries = [];
            }
        }
        const tagSet = new Set();
        entries.forEach((item) => {
            if (item.tags && Array.isArray(item.tags)) {
                item.tags.forEach((tag) => {
                    if (tag && typeof tag === 'string' && tag.trim()) {
                        const cleanTag = tag.trim();
                        tagSet.add(cleanTag);
                    }
                });
            }
        });
        return Array.from(tagSet).sort();
    };
    /**
     * 使用回数ブーストを取得する
     */
    const getUsageBoost = (entry, usageCache) => {
        if (!entry || !entry.id)
            return 0;
        const count = usageCache[entry.id] || 0;
        return Math.min(8, Math.log(count + 1) * 3);
    };
    /**
     * エントリをスコアリングする
     */
    const scoreEntries = (entries, query, usageCache) => {
        const base = entries.map(e => ({ entry: e, score: 0 }));
        if (!query) {
            base.forEach(item => { item.score = 0.0001 + getUsageBoost(item.entry, usageCache); });
        }
        else {
            const matcher = createFuzzyMatcher(query);
            base.forEach(item => {
                const entry = item.entry;
                const score = Math.max(matcher(entry.name || ''), matcher(entry.url || '') - 4, matcher((entry.tags || []).join(' ')) - 2);
                item.score = score === -Infinity ? -Infinity : score + getUsageBoost(item.entry, usageCache);
            });
        }
        const filtered = base.filter(item => item.score > -Infinity);
        filtered.sort((a, b) => b.score - a.score);
        return filtered;
    };
    /**
     * タグでエントリをフィルタリングする
     */
    const filterEntriesByTag = (entries, tagFilter) => {
        if (!tagFilter)
            return entries;
        const normalizedTagFilter = normalize(tagFilter);
        return entries.filter(entry => {
            if (!entry.tags || !Array.isArray(entry.tags))
                return false;
            // 完全一致
            if (entry.tags.some(tag => normalize(tag) === normalizedTagFilter)) {
                return true;
            }
            // 階層タグの一致チェック
            return entry.tags.some(tag => {
                const normalizedTag = normalize(tag);
                // 階層タグの親タグで一致（例: "ai/tools" は "ai" で一致）
                const parts = tag.split('/');
                if (parts.some(part => normalize(part) === normalizedTagFilter)) {
                    return true;
                }
                // 階層タグの前方一致（例: "ai" で "ai/tools" に一致）
                if (normalizedTag.startsWith(normalizedTagFilter + '/')) {
                    return true;
                }
                return false;
            });
        });
    };
    /**
     * ファジーマッチャーを作成する
     */
    const createFuzzyMatcher = (query) => {
        const q = normalize(query);
        const chars = q.split('');
        const regex = new RegExp(chars.map(c => escapeRegex(c)).join('.*?'), 'i');
        return (text) => {
            if (!text)
                return -Infinity;
            const lower = normalize(text);
            if (lower.includes(q)) {
                const index = lower.indexOf(q);
                return 40 - index * 1.5;
            }
            if (!regex.test(text))
                return -Infinity;
            let score = 20;
            score -= lower.length * 0.02;
            if (lower.startsWith(chars[0]))
                score += 6;
            return score;
        };
    };
    /**
     * 正規表現をエスケープする
     */
    const escapeRegex = (str) => {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };
    /**
     * フィルタリングとスコアリングを一度に行う
     */
    const filterAndScoreEntries = (entries, query, usageCache) => {
        const scored = scoreEntries(entries, query, usageCache);
        return scored.map(item => item.entry);
    };

    /**
     * パレットのイベント処理を担当するクラス
     * ユーザーインタラクションの処理、イベントリスナーの管理などを行う
     */
    class PaletteEventHandler {
        constructor(state, dom, onExecuteEntry, onVirtualScroll, onEscape, onOpenManager, onOpenSettings) {
            this.onRenderList = () => { };
            this.onUpdateActive = () => { };
            this.state = state;
            this.dom = dom;
            this.onExecuteEntry = onExecuteEntry;
            this.onVirtualScroll = onVirtualScroll;
            this.onEscape = onEscape;
            this.onOpenManager = onOpenManager;
            this.onOpenSettings = onOpenSettings;
            // デバウンスされたレンダリング関数を作成
            this.debouncedRenderList = debounce(() => this.performRenderList(), 150);
        }
        /**
         * イベントリスナーを設定
         */
        setupEventListeners() {
            this.setupInputEventListeners();
            this.setupListEventListeners();
            this.setupHintEventListeners();
            this.setupKeyboardEventListeners();
        }
        /**
         * 入力フィールドのイベントリスナーを設定
         */
        setupInputEventListeners() {
            if (!this.dom.inputEl)
                return;
            // 入力イベント
            this.dom.inputEl.addEventListener('input', () => {
                this.state.activeIndex = 0;
                this.renderList();
            });
            // キーダウンイベント
            EventListeners.addKeydown(this.dom.inputEl, (e) => {
                this.handleInputKeydown(e);
            });
        }
        /**
         * リストのイベントリスナーを設定
         */
        setupListEventListeners() {
            if (!this.dom.listEl)
                return;
            // マウスイベント
            this.dom.listEl.addEventListener('mouseenter', (e) => {
                const item = e.target.closest('.item');
                if (item) {
                    const index = parseInt(item.dataset.index || '0', 10);
                    if (!isNaN(index)) {
                        this.state.activeIndex = index;
                        this.updateActive();
                    }
                }
            }, true);
            // クリックイベント
            this.dom.listEl.addEventListener('click', (e) => {
                const item = e.target.closest('.item');
                if (item) {
                    const index = parseInt(item.dataset.index || '0', 10);
                    if (!isNaN(index) && this.state.currentItems) {
                        const entry = this.state.currentItems[index];
                        if (entry) {
                            this.openItem(entry, e.shiftKey);
                        }
                    }
                }
            });
            // マウスダウンイベント（フォーカス維持用）
            EventListeners.addMouseDown(this.dom.listEl, () => {
                if (this.dom.inputEl) {
                    this.dom.inputEl.focus();
                }
            });
        }
        /**
         * ヒント領域のイベントリスナーを設定
         */
        setupHintEventListeners() {
            if (!this.dom.hintEl)
                return;
            // マネージャリンク
            const managerLink = this.dom.hintEl.querySelector('#vm-open-manager');
            if (managerLink) {
                managerLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.onOpenManager();
                });
            }
            // 設定リンク
            const settingsLink = this.dom.hintEl.querySelector('#vm-open-settings');
            if (settingsLink) {
                settingsLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.onOpenSettings();
                });
            }
        }
        /**
         * キーボードイベントリスナーを設定
         */
        setupKeyboardEventListeners() {
            if (!this.dom.overlayEl)
                return;
            EventListeners.addKeydown(this.dom.overlayEl, (e) => {
                this.handleOverlayKeydown(e);
            });
        }
        /**
         * 入力フィールドのキーダウンイベントを処理
         */
        handleInputKeydown(e) {
            if (!this.state.currentItems || !this.state.currentItems.length)
                return;
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    this.state.activeIndex = Math.min(this.state.activeIndex + 1, this.state.currentItems.length - 1);
                    this.updateActive();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.state.activeIndex = Math.max(this.state.activeIndex - 1, 0);
                    this.updateActive();
                    break;
                case 'Enter':
                    e.preventDefault();
                    const item = this.state.currentItems[this.state.activeIndex];
                    if (item) {
                        this.openItem(item, e.shiftKey);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.onEscape();
                    break;
                case 'Tab':
                    e.preventDefault();
                    // タグ選択機能はオートコンプリート機能に統一されたため、ここでは何もしない
                    break;
            }
        }
        /**
         * オーバーレイのキーダウンイベントを処理
         */
        handleOverlayKeydown(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.onEscape();
            }
        }
        /**
         * リストをレンダリング（デバウンス対応）
         */
        renderList() {
            this.debouncedRenderList();
        }
        /**
         * 実際のリストレンダリング処理
         */
        performRenderList() {
            if (!this.dom.inputEl)
                return;
            const rawQuery = this.dom.inputEl.value || '';
            const { tagFilter, textQuery } = extractTagFilter(rawQuery);
            const entries = this.getEntries();
            // タグフィルタを適用
            const filtered = tagFilter ? filterEntriesByTag(entries, tagFilter) : entries;
            const scored = filterAndScoreEntries(filtered, textQuery, this.getUsageCache());
            if (scored.length) {
                if (this.state.activeIndex >= scored.length)
                    this.state.activeIndex = scored.length - 1;
                if (this.state.activeIndex < 0)
                    this.state.activeIndex = 0;
            }
            else {
                this.state.activeIndex = 0;
            }
            const hasQuery = !!(textQuery || tagFilter);
            // UIクラスにレンダリングを委譲
            this.onRenderList(scored, hasQuery);
            this.state.currentItems = scored;
            this.updateActive();
        }
        /**
         * アクティブなアイテムを更新
         */
        updateActive() {
            // UIクラスに更新を委譲
            this.onUpdateActive(this.state.activeIndex);
        }
        /**
         * アイテムを開く
         */
        openItem(item, shiftPressed) {
            this.onExecuteEntry(item, shiftPressed);
        }
        /**
         * エントリーを取得
         */
        getEntries() {
            // このメソッドは実際の実装では外部から提供される
            return [];
        }
        /**
         * 使用キャッシュを取得
         */
        getUsageCache() {
            // このメソッドは実際の実装では外部から提供される
            return {};
        }
        /**
         * 仮想スクロールイベントを処理
         */
        handleVirtualScroll(position) {
            this.onVirtualScroll(position);
        }
        /**
         * レンダリングコールバックを設定
         */
        setRenderCallback(callback) {
            this.onRenderList = callback;
        }
        /**
         * アクティブ更新コールバックを設定
         */
        setUpdateActiveCallback(callback) {
            this.onUpdateActive = callback;
        }
        /**
         * エントリー取得コールバックを設定
         */
        setGetEntriesCallback(callback) {
            this.getEntries = callback;
        }
        /**
         * 使用キャッシュ取得コールバックを設定
         */
        setGetUsageCacheCallback(callback) {
            this.getUsageCache = callback;
        }
        /**
         * イベントリスナーをクリーンアップ
         */
        cleanup() {
            // 必要に応じてイベントリスナーのクリーンアップを実装
        }
    }

    /**
     * メインパレットUIを管理するクラス
     * UI生成とイベント処理を分離したアーキテクチャを採用
     */
    class Palette {
        constructor(state, dom, onExecuteEntry, openManagerCallback, openSettingsCallback) {
            this.state = state;
            this.dom = dom;
            this.onExecuteEntry = onExecuteEntry;
            this.openManagerCallback = openManagerCallback;
            this.openSettingsCallback = openSettingsCallback;
            // UIとイベントハンドラを初期化
            this.ui = new PaletteUI(state, dom);
            this.eventHandler = new PaletteEventHandler(state, dom, onExecuteEntry, (position) => this.handleVirtualScroll(position), () => this.hidePalette(), () => this.openManager(), () => this.openSettings());
            // コールバックを設定
            this.setupCallbacks();
            // 仮想スクロールハンドラを設定
            this.ui.setVirtualScrollHandler((position) => this.handleVirtualScroll(position));
        }
        /**
         * コールバックを設定
         */
        setupCallbacks() {
            this.eventHandler.setRenderCallback((scored, hasQuery) => {
                this.renderList(scored, hasQuery);
            });
            this.eventHandler.setUpdateActiveCallback((activeIndex) => {
                this.ui.updateActive(activeIndex);
            });
            this.eventHandler.setGetEntriesCallback(() => this.getEntries());
            this.eventHandler.setGetUsageCacheCallback(() => this.getUsageCache());
        }
        /**
         * Shadow Rootホストを確保する
         */
        ensureRoot() {
            this.ui.ensureRoot();
        }
        /**
         * パレットを開く
         */
        async openPalette() {
            this.ensureRoot();
            this.state.cachedSettings = getSettings();
            this.ui.applyTheme(this.state.cachedSettings || undefined);
            this.state.isOpen = true;
            if (!this.dom.overlayEl) {
                this.ui.createPaletteUI();
                // イベントリスナーを設定
                this.eventHandler.setupEventListeners();
            }
            this.ui.showPalette();
            this.ui.clearInput();
            this.ui.setInputPlaceholder(DEFAULT_PLACEHOLDER);
            this.state.activeIndex = 0;
            this.eventHandler.renderList();
            // フォーカストラップを有効化
            this.ui.activateFocusTrap();
        }
        /**
         * パレットを閉じる
         */
        hidePalette() {
            this.state.isOpen = false;
            // フォーカストラップを無効化
            this.ui.deactivateFocusTrap();
            this.ui.hidePalette();
        }
        /**
         * テーマを適用する
         */
        applyTheme() {
            this.ui.applyTheme(this.state.cachedSettings || undefined);
        }
        /**
         * リストをレンダリング
         */
        renderList(scored, hasQuery) {
            // 仮想スクロールを使用するかどうかを判定
            const useVirtualScroll = scored.length >= this.ui.getVirtualScrollThreshold();
            if (useVirtualScroll) {
                this.ui.renderVirtualList(scored, hasQuery);
            }
            else {
                this.ui.renderNormalList(scored, hasQuery);
            }
            this.state.currentItems = scored;
            this.ui.updateActive(this.state.activeIndex);
        }
        /**
         * 仮想スクロールイベントを処理
         */
        handleVirtualScroll(position) {
            const virtualScrollManager = this.ui.getVirtualScrollManager();
            const virtualScrollContainer = this.ui.getVirtualScrollContainer();
            const virtualScrollContent = this.ui.getVirtualScrollContent();
            if (!virtualScrollManager || !virtualScrollContainer || !virtualScrollContent)
                return;
            // 現在のスクロール位置で表示すべきアイテムを取得
            const scrollTop = virtualScrollContainer.scrollTop || 0;
            const visibleItems = virtualScrollManager.getVisibleItems(scrollTop);
            // コンテンツの高さを設定
            virtualScrollContent.style.height = `${virtualScrollManager.getTotalHeight()}px`;
            virtualScrollContent.innerHTML = '';
            // 表示アイテムをレンダリング
            visibleItems.forEach(({ item, index, style }) => {
                const { entry } = item.data;
                const itemEl = this.ui.createListItem(entry, index);
                itemEl.setAttribute('style', Object.entries(style).map(([k, v]) => `${k}: ${v}`).join('; '));
                virtualScrollContent.appendChild(itemEl);
            });
        }
        /**
         * マネージャを開く
         */
        openManager() {
            this.openManagerCallback();
        }
        /**
         * 設定を開く
         */
        openSettings() {
            this.openSettingsCallback();
        }
        /**
         * エントリーを取得
         */
        getEntries() {
            return getSites();
        }
        /**
         * 使用キャッシュを取得
         */
        getUsageCache() {
            try {
                return getUsageCache();
            }
            catch (error) {
                console.error('[CommandPalette] Error getting usage cache:', error);
                return {};
            }
        }
        /**
         * アイテムを開く
         */
        openItem(item, shiftPressed) {
            this.onExecuteEntry(item, shiftPressed);
        }
        /**
         * アクティブなアイテムを更新
         */
        updateActive() {
            this.ui.updateActive(this.state.activeIndex);
        }
        /**
         * 入力フィールドの値を取得
         */
        getInputValue() {
            return this.ui.getInputValue();
        }
        /**
         * リストを再レンダリング
         */
        refreshList() {
            this.eventHandler.renderList();
        }
        /**
         * クリーンアップ
         */
        cleanup() {
            this.eventHandler.cleanup();
        }
    }

    /**
     * タグソート関連のユーティリティ関数
     */
    /**
     * タグを階層構造でソートする
     * スラッシュで区切られた階層の深さを優先し、同じ階層内ではアルファベット順にソートする
     */
    const sortTagsByHierarchy = (tags) => {
        return tags.sort((a, b) => {
            const aDepth = (a.match(/\//g) || []).length;
            const bDepth = (b.match(/\//g) || []).length;
            // 階層の深さが異なる場合は浅い方を優先
            if (aDepth !== bDepth)
                return aDepth - bDepth;
            // 同じ階層の場合はアルファベット順
            return a.localeCompare(b);
        });
    };
    /**
     * タグの使用回数をカウントする
     */
    const countTagUsage = (entries) => {
        const tagCounts = {};
        entries.forEach(entry => {
            if (entry.tags) {
                entry.tags.forEach((tag) => {
                    const normalizedTag = tag.trim();
                    if (normalizedTag) {
                        tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1;
                    }
                });
            }
        });
        return tagCounts;
    };
    /**
     * タグをフィルタリングする
     */
    const filterTags = (allTags, query) => {
        const queryLower = query.toLowerCase();
        return allTags.filter(tag => {
            const tagLower = tag.toLowerCase();
            // 完全一致
            if (tagLower === queryLower)
                return true;
            // 階層タグの親タグで一致
            const parts = tag.split('/');
            if (parts.some(part => part.toLowerCase() === queryLower))
                return true;
            // 部分一致
            if (tagLower.includes(queryLower))
                return true;
            return false;
        });
    };
    /**
     * 階層タグをフィルタリングする
     */
    const filterHierarchicalTags = (allTags, query) => {
        if (query.includes('/')) {
            const parts = query.split('/');
            const parentQuery = parts.slice(0, -1).join('/');
            const childQuery = parts[parts.length - 1];
            return allTags.filter(tag => {
                if (tag.startsWith(parentQuery + '/')) {
                    const childPart = tag.slice(parentQuery.length + 1);
                    return childPart.toLowerCase().includes(childQuery.toLowerCase());
                }
                return false;
            });
        }
        else {
            return filterTags(allTags, query);
        }
    };
    /**
     * タグ候補オブジェクトに変換する
     */
    const createTagSuggestions = (tags, tagCounts) => {
        return tags.map(tag => {
            let count = tagCounts[tag] || 0;
            // 親タグの場合、子タグの件数も合算
            if (!tag.includes('/')) {
                Object.keys(tagCounts).forEach(childTag => {
                    if (childTag.startsWith(tag + '/')) {
                        count += tagCounts[childTag];
                    }
                });
            }
            const parts = tag.split('/');
            const depth = parts.length - 1;
            const parentPath = parts.slice(0, -1).join('/');
            return {
                name: tag,
                count: count,
                depth: depth,
                parentPath: parentPath || undefined
            };
        });
    };

    /**
     * オートコンプリートUIを管理するクラス
     */
    class Autocomplete {
        constructor(dom, state, onRenderList, onUpdateActive) {
            /**
             * オートコンプリート入力処理
             */
            this.handleAutocompleteInput = () => {
                const value = this.dom.inputEl.value;
                setTimeout(() => {
                    // タグ候補を表示すべきか判定
                    if (shouldShowTagSuggestions(value)) {
                        const hashIndex = value.indexOf('#');
                        const afterHash = value.slice(hashIndex + 1);
                        this.showAutocomplete(afterHash);
                    }
                    else {
                        this.hideAutocomplete();
                    }
                }, 10);
            };
            /**
             * オートコンプリートキーボード処理
             */
            this.handleAutocompleteKeydown = (e) => {
                if (!this.state.isVisible)
                    return;
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.state.index = (this.state.index + 1) % this.state.items.length;
                    this.updateAutocompleteActive();
                }
                else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.state.index = (this.state.index - 1 + this.state.items.length) % this.state.items.length;
                    this.updateAutocompleteActive();
                }
                else if (e.key === 'Enter' && this.state.index >= 0) {
                    e.preventDefault();
                    this.selectAutocompleteItem(this.state.items[this.state.index]);
                }
                else if (e.key === 'Escape') {
                    this.hideAutocomplete();
                }
            };
            this.dom = dom;
            this.state = state;
            this.onRenderList = onRenderList;
            this.onUpdateActive = onUpdateActive;
        }
        /**
         * オートコンプリートを構築
         */
        buildAutocomplete() {
            const container = document.createElement('div');
            container.className = 'autocomplete-container';
            container.style.position = 'relative';
            this.dom.autocompleteEl = document.createElement('div');
            this.dom.autocompleteEl.className = 'autocomplete-list';
            this.dom.autocompleteEl.style.display = 'none';
            // オートコンプリートのスタイルを追加
            const style = document.createElement('style');
            style.textContent = `
      .autocomplete-container {
        position: relative;
        width: 100%;
      }
      .autocomplete-list {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--autocomplete-bg);
        border: 1px solid var(--autocomplete-border);
        border-top: none;
        border-radius: 0 0 8px 8px;
        max-height: 200px;
        overflow-y: auto;
        z-index: 2147483647;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        scrollbar-width: none;
      }
      .autocomplete-list::-webkit-scrollbar {
        width: 0;
        height: 0;
      }
      .autocomplete-item {
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
        border-bottom: 1px solid var(--autocomplete-border);
        display: flex;
        align-items: center;
        gap: 8px;
        transition: background 0.12s ease, transform 0.12s ease;
      }
      .autocomplete-item:first-child {
        border-radius: 8px 8px 0 0;
      }
      .autocomplete-item:last-child {
        border-bottom: none;
        border-radius: 0 0 8px 8px;
      }
      .autocomplete-item:hover,
      .autocomplete-item.active {
        background: var(--item-active);
        transform: translateX(2px);
      }
      .autocomplete-tag {
        flex: 1;
        color: var(--panel-text);
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .autocomplete-count {
        font-size: 12px;
        color: var(--muted);
        background: var(--hint-bg);
        padding: 2px 6px;
        border-radius: 4px;
      }
    `;
            // 元の入力欄をコンテナに移動
            if (this.dom.inputEl && this.dom.inputEl.parentNode) {
                this.dom.inputEl.parentNode.replaceChild(container, this.dom.inputEl);
                container.appendChild(this.dom.inputEl);
                container.appendChild(this.dom.autocompleteEl);
                // スタイルをルート要素に追加
                if (this.dom.root) {
                    this.dom.root.appendChild(style);
                }
            }
            // オートコンプリートのイベントリスナーを追加
            addInputListener(this.dom.inputEl, this.handleAutocompleteInput);
            addKeydownListener(this.dom.inputEl, this.handleAutocompleteKeydown);
            // blur 時、実際に外へ出たときだけ閉じる
            setupAutocompleteEvents(this.dom.inputEl, this.dom.autocompleteEl, () => this.hideAutocomplete());
        }
        /**
         * オートコンプリートを表示
         */
        showAutocomplete(query) {
            const entries = this.getEntries();
            const allTags = getAllTags(entries);
            // タグの使用回数をカウント
            const tagCounts = countTagUsage(entries);
            // タグをフィルタリング
            let filteredTags = filterHierarchicalTags(allTags, query);
            // 階層の浅い順、アルファベット順にソート
            filteredTags = sortTagsByHierarchy(filteredTags);
            // タグ候補オブジェクトに変換
            const filteredTagObjects = createTagSuggestions(filteredTags, tagCounts);
            if (filteredTagObjects.length === 0) {
                this.state.items = [];
                this.state.index = -1;
                this.state.isVisible = true;
                this.dom.autocompleteEl.innerHTML = '';
                // 新規タグ作成を提案
                const createItem = document.createElement('div');
                createItem.className = 'autocomplete-item';
                createItem.style.cursor = 'pointer';
                createItem.innerHTML = `
        <span class="autocomplete-tag" style="color: var(--accent-color);">➕ 新規タグを作成: "${escapeHtml(query)}"</span>
        <div style="font-size: 10px; color: var(--muted); margin-top: 2px;">Enterで作成して続行</div>
      `;
                createItem.addEventListener('click', () => {
                    this.createNewTag(query);
                });
                this.dom.autocompleteEl.appendChild(createItem);
                // デバッグ情報
                const debugItem = document.createElement('div');
                debugItem.className = 'autocomplete-item';
                debugItem.style.color = 'var(--muted)';
                debugItem.style.fontSize = '11px';
                debugItem.style.cursor = 'default';
                debugItem.innerHTML = `
        <div>デバッグ情報:</div>
        <div>・全タグ数: ${allTags.length}</div>
        <div>・検索クエリ: "${escapeHtml(query)}"</div>
        <div>・サイト数: ${entries.length}</div>
      `;
                debugItem.addEventListener('click', (e) => e.preventDefault());
                this.dom.autocompleteEl.appendChild(debugItem);
                this.dom.autocompleteEl.style.display = 'block';
                this.updateAutocompleteActive();
                return;
            }
            this.state.items = filteredTagObjects;
            this.state.index = 0;
            this.state.isVisible = true;
            this.dom.autocompleteEl.innerHTML = '';
            filteredTagObjects.forEach((tag, index) => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                item.dataset.index = index.toString();
                const parts = tag.name.split('/');
                const depth = parts.length - 1;
                const displayName = parts.pop() || '';
                const parentPath = parts.join('/');
                // 階層関係を視覚的に表現
                let hierarchyDisplay = '';
                if (depth > 0) {
                    // 親パスを表示
                    hierarchyDisplay = `<span style="color: var(--muted); font-size: 11px;">${escapeHtml(parentPath)}/</span>`;
                }
                item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 4px; flex: 1;">
          <span style="margin-left: ${depth * 12}px; color: var(--muted); font-size: 12px;">${depth > 0 ? '└─' : ''}</span>
          <div style="display: flex; flex-direction: column; gap: 1px; flex: 1;">
            <div style="display: flex; align-items: center; gap: 4px;">
              ${hierarchyDisplay}
              <span class="autocomplete-tag" style="font-weight: ${depth > 0 ? '400' : '500'};">${escapeHtml(displayName)}</span>
            </div>
            ${depth > 0 ? `<div style="font-size: 10px; color: var(--muted); margin-left: ${depth * 12 + 16}px;">フルパス: ${escapeHtml(tag.name)}</div>` : ''}
          </div>
        </div>
        <span class="autocomplete-count">${tag.count}件</span>
      `;
                addClickListener(item, () => this.selectAutocompleteItem(tag));
                addMouseEnterListener(item, () => {
                    this.state.index = index;
                    this.updateAutocompleteActive();
                });
                this.dom.autocompleteEl.appendChild(item);
            });
            this.dom.autocompleteEl.style.display = 'block';
            this.updateAutocompleteActive();
        }
        /**
         * オートコンプリートを非表示
         */
        hideAutocomplete() {
            this.state.isVisible = false;
            this.state.index = -1;
            if (this.dom.autocompleteEl) {
                this.dom.autocompleteEl.style.display = 'none';
            }
        }
        /**
         * オートコンプリートアクティブ更新
         */
        updateAutocompleteActive() {
            if (!this.dom.autocompleteEl)
                return;
            const items = this.dom.autocompleteEl.querySelectorAll('.autocomplete-item');
            items.forEach((item, index) => {
                item.classList.toggle('active', index === this.state.index);
            });
        }
        /**
         * オートコンプリートアイテム選択
         */
        selectAutocompleteItem(tag) {
            const currentValue = this.dom.inputEl.value;
            const hashIndex = currentValue.indexOf('#');
            if (hashIndex >= 0) {
                const beforeHash = currentValue.slice(0, hashIndex);
                this.dom.inputEl.value = beforeHash + '#' + tag.name;
            }
            else {
                this.dom.inputEl.value = '#' + tag.name;
            }
            this.hideAutocomplete();
            this.dom.inputEl.focus();
            // 入力後にスペースを追加して検索できるようにする
            setTimeout(() => {
                this.dom.inputEl.value += ' ';
                // アクティブインデックスをリセットして再レンダリング
                this.onRenderList();
                this.onUpdateActive();
            }, 0);
        }
        /**
         * 新規タグを作成
         */
        createNewTag(tagName) {
            const currentValue = this.dom.inputEl.value;
            const hashIndex = currentValue.indexOf('#');
            if (hashIndex >= 0) {
                const beforeHash = currentValue.slice(0, hashIndex);
                this.dom.inputEl.value = beforeHash + '#' + tagName;
            }
            else {
                this.dom.inputEl.value = '#' + tagName;
            }
            this.hideAutocomplete();
            this.dom.inputEl.focus();
            // 入力後にスペースを追加して検索できるようにする
            setTimeout(() => {
                this.dom.inputEl.value += ' ';
                // アクティブインデックスをリセットして再レンダリング
                this.onRenderList();
                this.onUpdateActive();
            }, 0);
        }
        /**
         * エントリを取得する（正規化済み）
         */
        getEntries() {
            try {
                const getSites = require('@/core/storage').getSites;
                return getSites();
            }
            catch {
                return [];
            }
        }
    }

    /**
     * トーストメッセージを表示する
     */
    const showToast = (message) => {
        // グローバル変数から取得
        const toastEl = window.toastEl;
        if (!toastEl)
            return;
        toastEl.innerHTML = '';
        const msg = document.createElement('div');
        msg.className = 'toast-message';
        msg.textContent = message;
        toastEl.appendChild(msg);
        toastEl.style.display = 'flex';
        setTimeout(() => {
            if (toastEl && toastEl.contains(msg)) {
                toastEl.removeChild(msg);
            }
            if (toastEl) {
                toastEl.style.display = 'none';
            }
        }, 2400);
    };

    /**
     * サイトマネージャのタグ入力フィールド用オートコンプリート機能を管理するクラス
     */
    class ManagerAutocomplete {
        constructor(dom, tagInput, onTagSelect) {
            /**
             * 入力イベント処理
             */
            this.handleInput = () => {
                const value = this.tagInput.value;
                setTimeout(() => {
                    // カンマ区切りの最後の単語を取得
                    const tags = value.split(/[,\s]+/).filter(Boolean);
                    const lastTag = tags[tags.length - 1] || '';
                    if (lastTag.length > 0) {
                        this.showTagSuggestions(lastTag);
                    }
                    else {
                        this.hideTagSuggestions();
                    }
                }, 10);
            };
            /**
             * キーボードイベント処理
             */
            this.handleKeydown = (e) => {
                if (!this.state.isVisible)
                    return;
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.state.index = (this.state.index + 1) % this.state.items.length;
                    this.updateActive();
                }
                else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.state.index = (this.state.index - 1 + this.state.items.length) % this.state.items.length;
                    this.updateActive();
                }
                else if (e.key === 'Enter' && this.state.index >= 0) {
                    e.preventDefault();
                    this.selectTag(this.state.items[this.state.index].name);
                }
                else if (e.key === 'Escape') {
                    this.hideTagSuggestions();
                }
            };
            /**
             * フォーカスイベント処理
             */
            this.handleBlur = (e) => {
                const to = e.relatedTarget;
                const insideAuto = to && this.autocompleteEl.contains(to);
                setBlurCheckTimeout(() => {
                    if (!insideAuto && !this.autocompleteEl.matches(':hover')) {
                        this.hideTagSuggestions();
                    }
                });
            };
            this.dom = dom;
            this.tagInput = tagInput;
            this.onTagSelect = onTagSelect;
            this.state = {
                items: [],
                index: -1,
                isVisible: false
            };
            this.buildAutocomplete();
            this.setupEventListeners();
        }
        /**
         * オートコンプリートUIを構築
         */
        buildAutocomplete() {
            // コンテナを作成して元の入力欄を囲む
            this.container = document.createElement('div');
            this.container.className = 'tag-autocomplete-container';
            this.container.style.position = 'relative';
            // オートコンプリート要素を作成
            this.autocompleteEl = document.createElement('div');
            this.autocompleteEl.className = 'tag-autocomplete-list';
            this.autocompleteEl.style.display = 'none';
            // スタイルを追加
            const style = document.createElement('style');
            style.textContent = `
      .tag-autocomplete-container {
        position: relative;
        width: 100%;
      }
      .tag-autocomplete-list {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--panel-bg);
        border: 1px solid var(--border-color);
        border-top: none;
        border-radius: 0 0 8px 8px;
        max-height: 200px;
        overflow-y: auto;
        z-index: 2147483647;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        scrollbar-width: none;
        min-width: 300px;
        width: max-content;
        max-width: 500px;
      }
      .tag-autocomplete-list::-webkit-scrollbar {
        width: 0;
        height: 0;
      }
      .tag-autocomplete-item {
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-items: flex-start;
        gap: 8px;
        transition: background 0.12s ease, transform 0.12s ease;
        min-height: 40px;
        white-space: nowrap;
      }
      .tag-autocomplete-item:first-child {
        border-radius: 8px 8px 0 0;
      }
      .tag-autocomplete-item:last-child {
        border-bottom: none;
        border-radius: 0 0 8px 8px;
      }
      .tag-autocomplete-item:hover,
      .tag-autocomplete-item.active {
        background: var(--item-active);
        transform: translateX(2px);
      }
      .tag-autocomplete-tag {
        flex: 1;
        color: var(--panel-text);
        display: flex;
        align-items: flex-start;
        gap: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
      }
      .tag-autocomplete-count {
        font-size: 12px;
        color: var(--muted);
        background: var(--hint-bg);
        padding: 2px 6px;
        border-radius: 4px;
        flex-shrink: 0;
        white-space: nowrap;
      }
      .tag-autocomplete-new {
        color: var(--accent-color);
        font-style: italic;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
      }
      .tag-autocomplete-debug {
        font-size: 11px;
        color: var(--muted);
        cursor: default;
        white-space: normal;
        word-break: break-word;
      }
    `;
            // 元の入力欄をコンテナに移動
            if (this.tagInput && this.tagInput.parentNode) {
                this.tagInput.parentNode.replaceChild(this.container, this.tagInput);
                this.container.appendChild(this.tagInput);
                this.container.appendChild(this.autocompleteEl);
                // スタイルをルート要素に追加
                if (this.dom.root) {
                    this.dom.root.appendChild(style);
                }
            }
        }
        /**
         * イベントリスナーを設定
         */
        setupEventListeners() {
            // 入力イベント
            addInputListener(this.tagInput, this.handleInput);
            // キーボードイベント
            addKeydownListener(this.tagInput, this.handleKeydown);
            // フォーカスイベント
            addBlurListener(this.tagInput, this.handleBlur);
            // オートコンプリート内クリック時にフォーカスを奪われても閉じない
            addMouseDownListener(this.autocompleteEl, (e) => {
                e.preventDefault(); // 入力の blur を抑止
                this.tagInput.focus(); // フォーカスを戻す
            });
        }
        /**
         * タグ候補を表示
         */
        showTagSuggestions(query) {
            const entries = getSites();
            const allTags = getAllTags(entries);
            // タグの使用回数をカウント
            const tagCounts = countTagUsage(entries);
            // クエリに基づいてタグをフィルタリング
            let filteredTags = filterTags(allTags, query);
            // 階層の浅い順、アルファベット順にソート
            filteredTags = sortTagsByHierarchy(filteredTags);
            // タグ候補オブジェクトに変換
            const filteredTagObjects = createTagSuggestions(filteredTags, tagCounts);
            // 新規タグ作成を提案
            const showNewTagOption = !filteredTagObjects.some(item => item.name.toLowerCase() === query.toLowerCase());
            if (filteredTagObjects.length === 0 && !showNewTagOption) {
                this.hideTagSuggestions();
                return;
            }
            this.state.items = filteredTagObjects;
            if (showNewTagOption) {
                this.state.items.push({
                    name: query,
                    count: 0,
                    depth: 0,
                    parentPath: undefined
                });
            }
            this.state.index = 0;
            this.state.isVisible = true;
            this.renderTagSuggestions();
        }
        /**
         * タグ候補をレンダリング
         */
        renderTagSuggestions() {
            this.autocompleteEl.innerHTML = '';
            this.state.items.forEach((tag, index) => {
                const item = document.createElement('div');
                item.className = 'tag-autocomplete-item';
                item.dataset.index = index.toString();
                const isNewTag = tag.count === 0;
                if (isNewTag) {
                    // 新規タグ作成オプション
                    item.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0;">
            <span class="tag-autocomplete-tag tag-autocomplete-new" style="overflow: hidden; text-overflow: ellipsis;">➕ 新規タグを作成: "${escapeHtml(tag.name)}"</span>
            <div style="font-size: 10px; color: var(--muted);">Enterで作成して続行</div>
          </div>
        `;
                }
                else {
                    // 既存タグ
                    const parts = tag.name.split('/');
                    const displayName = parts.pop() || '';
                    // 階層関係を視覚的に表現
                    let hierarchyDisplay = '';
                    if (tag.depth > 0 && tag.parentPath) {
                        hierarchyDisplay = `<span style="color: var(--muted); font-size: 11px;">${escapeHtml(tag.parentPath)}/</span>`;
                    }
                    item.innerHTML = `
          <div style="display: flex; align-items: flex-start; gap: 4px; flex: 1; min-width: 0;">
            <span style="margin-left: ${tag.depth * 12}px; color: var(--muted); font-size: 12px; flex-shrink: 0; margin-top: 2px;">${tag.depth > 0 ? '└─' : ''}</span>
            <div style="display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 4px; min-width: 0;">
                ${hierarchyDisplay}
                <span class="tag-autocomplete-tag" style="font-weight: ${tag.depth > 0 ? '400' : '500'}; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(displayName)}</span>
              </div>
              ${tag.depth > 0 ? `<div style="font-size: 10px; color: var(--muted); margin-left: ${tag.depth * 12 + 16}px; overflow: hidden; text-overflow: ellipsis;">フルパス: ${escapeHtml(tag.name)}</div>` : ''}
            </div>
          </div>
          <span class="tag-autocomplete-count">${tag.count}件</span>
        `;
                }
                addClickListener(item, () => this.selectTag(tag.name));
                addMouseEnterListener(item, () => {
                    this.state.index = index;
                    this.updateActive();
                });
                this.autocompleteEl.appendChild(item);
            });
            this.autocompleteEl.style.display = 'block';
            this.updateActive();
        }
        /**
         * タグ候補を非表示
         */
        hideTagSuggestions() {
            this.state.isVisible = false;
            this.state.index = -1;
            this.autocompleteEl.style.display = 'none';
        }
        /**
         * アクティブな候補を更新
         */
        updateActive() {
            const items = this.autocompleteEl.querySelectorAll('.tag-autocomplete-item');
            items.forEach((item, index) => {
                item.classList.toggle('active', index === this.state.index);
            });
        }
        /**
         * タグを選択
         */
        selectTag(tag) {
            const currentValue = this.tagInput.value;
            const tags = currentValue.split(/[,\s]+/).filter(Boolean);
            // 最後のタグを置換
            if (tags.length > 0) {
                tags[tags.length - 1] = tag;
            }
            else {
                tags.push(tag);
            }
            // 入力欄を更新
            this.tagInput.value = tags.join(', ') + ', ';
            this.hideTagSuggestions();
            this.tagInput.focus();
            // コールバックを実行
            this.onTagSelect(tag);
        }
    }

    /**
     * DOM要素取得関連のユーティリティ関数
     */
    /**
     * DOM要素取得の共通オブジェクト
     */
    const DOMSelectors = {
        /**
         * 親要素からIDで要素を取得する
         */
        byId: (parent, id) => {
            return parent.querySelector(`#${id}`);
        },
        /**
         * 親要素からname属性で要素リストを取得する
         */
        byName: (parent, name) => {
            return parent.querySelectorAll(`[name="${name}"]`);
        },
        /**
         * 親要素からセレクタで最初の要素を取得する
         */
        bySelector: (parent, selector) => {
            return parent.querySelector(selector);
        }};
    // 後方互換性のために個別関数もエクスポート
    /**
     * 親要素からIDで要素を取得する
     */
    const getElementById = DOMSelectors.byId;
    /**
     * 親要素からname属性で要素リストを取得する
     */
    const getElementsByName = DOMSelectors.byName;
    /**
     * 親要素からセレクタで最初の要素を取得する
     */
    const querySelector = DOMSelectors.bySelector;
    /**
     * 設定画面用のDOM要素を取得する
     */
    const getSettingsElements = (setBox) => {
        return {
            closeBtn: getElementById(setBox, 'vs-close'),
            saveBtn: getElementById(setBox, 'vs-save'),
            resetBtn: getElementById(setBox, 'vs-reset'),
            clearFavBtn: getElementById(setBox, 'vs-clear-fav'),
            hotkey1Input: getElementById(setBox, 'vs-hotkey1'),
            hotkey2Input: getElementById(setBox, 'vs-hotkey2'),
            accentInput: getElementById(setBox, 'vs-accent'),
            accentText: getElementById(setBox, 'vs-accent-text'),
            blocklistInput: getElementById(setBox, 'vs-blocklist'),
            autoOpenInput: getElementById(setBox, 'vs-auto-open'),
            enterInputs: getElementsByName(setBox, 'vs-enter'),
            themeInputs: getElementsByName(setBox, 'vs-theme')
        };
    };
    /**
     * マネージャー画面用のDOM要素を取得する
     */
    const getManagerElements = (mgrBox) => {
        return {
            addSiteBtn: getElementById(mgrBox, 'vm-add-site'),
            saveBtn: getElementById(mgrBox, 'vm-save'),
            closeBtn: getElementById(mgrBox, 'vm-close'),
            exportBtn: getElementById(mgrBox, 'vm-export'),
            importInput: getElementById(mgrBox, 'vm-import-file'),
            importBtn: getElementById(mgrBox, 'vm-import'),
            siteBodyEl: getElementById(mgrBox, 'vm-rows-sites')
        };
    };
    /**
     * サイト行の入力要素を取得する
     */
    const getSiteRowInputs = (row) => {
        return {
            nameInput: querySelector(row, 'input[data-field="name"]'),
            urlInput: querySelector(row, 'input[data-field="url"]'),
            tagsInput: querySelector(row, 'input[data-field="tags"]'),
            upBtn: querySelector(row, '[data-up]'),
            downBtn: querySelector(row, '[data-down]'),
            delBtn: querySelector(row, '[data-del]'),
            testBtn: querySelector(row, '[data-test]')
        };
    };
    /**
     * 入力要素の値を安全に取得する
     */
    const getInputValue = (input) => {
        return input?.value?.trim() || '';
    };

    /**
     * サイトマネージャUIを管理するクラス
     */
    class Manager {
        constructor(dom, onRenderList) {
            this.dom = dom;
            this.onRenderList = onRenderList;
        }
        /**
         * マネージャを構築
         */
        buildManager() {
            try {
                this.dom.mgrOverlay = document.createElement('div');
                this.dom.mgrOverlay.className = 'mgr-overlay';
                this.dom.mgrOverlay.addEventListener('click', e => {
                    if (e.target === this.dom.mgrOverlay)
                        this.closeManager();
                });
                this.dom.mgrBox = document.createElement('div');
                this.dom.mgrBox.className = 'mgr';
                this.dom.mgrBox.innerHTML = `
        <header>
          <h3>サイトマネージャ</h3>
          <div>
            <button class="btn" id="vm-export">エクスポート</button>
            <button class="btn" id="vm-import">インポート</button>
            <button class="btn primary" id="vm-save">保存</button>
            <button class="btn" id="vm-close">閉じる</button>
          </div>
        </header>
        <input type="file" id="vm-import-file" accept="application/json" style="display:none">
        <div style="padding:10px 14px">
          <table class="tbl">
            <thead>
              <tr><th style="width:36px"></th><th>名前</th><th>URL</th><th>タグ</th><th style="width:220px">操作</th></tr>
            </thead>
            <tbody id="vm-rows-sites"></tbody>
          </table>
          <div style="padding:12px 0"><button class="btn" id="vm-add-site">行を追加</button></div>
        </div>
        <footer>
          <span class="muted">上下ボタンで並べ替え。保存すると即時反映。</span>
          <span class="muted">Ctrl/⌘S で保存、Esc で閉じる</span>
        </footer>`;
                if (this.dom.mgrOverlay && this.dom.mgrBox) {
                    this.dom.mgrOverlay.appendChild(this.dom.mgrBox);
                }
                if (this.dom.root && this.dom.mgrOverlay) {
                    this.dom.root.appendChild(this.dom.mgrOverlay);
                }
                // DOM要素を取得
                this.dom.siteBodyEl = this.dom.mgrBox.querySelector('#vm-rows-sites');
                // イベントリスナーを設定
                this.setupManagerEventListeners();
            }
            catch (error) {
                console.error('[CommandPalette] Error building manager:', error);
            }
        }
        /**
         * マネージャのイベントリスナーを設定
         */
        setupManagerEventListeners() {
            try {
                // DOM要素を取得
                const elements = getManagerElements(this.dom.mgrBox);
                // イベントリスナーを設定
                if (elements.addSiteBtn) {
                    addClickListener(elements.addSiteBtn, () => this.addSiteRow({ name: '', url: '', tags: [] }));
                }
                if (elements.saveBtn) {
                    addClickListener(elements.saveBtn, () => this.saveManager());
                }
                if (elements.closeBtn) {
                    addClickListener(elements.closeBtn, () => this.closeManager());
                }
                if (elements.exportBtn) {
                    addClickListener(elements.exportBtn, () => this.exportSites());
                }
                if (this.dom.mgrBox) {
                    addKeydownListener(this.dom.mgrBox, (e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                            e.preventDefault();
                            this.saveManager();
                        }
                        if (e.key === 'Escape') {
                            e.preventDefault();
                            this.closeManager();
                        }
                    });
                }
                if (elements.importBtn) {
                    addClickListener(elements.importBtn, () => {
                        if (!elements.importInput)
                            return;
                        elements.importInput.value = '';
                        elements.importInput.click();
                    });
                }
                if (elements.importInput) {
                    elements.importInput.addEventListener('change', () => {
                        const file = elements.importInput.files && elements.importInput.files[0];
                        if (!file)
                            return;
                        const reader = new FileReader();
                        reader.onload = () => {
                            this.importSitesFromJson(typeof reader.result === 'string' ? reader.result : '');
                        };
                        reader.onerror = () => {
                            showToast('ファイルの読み込みに失敗しました');
                        };
                        try {
                            reader.readAsText(file, 'utf-8');
                        }
                        catch (err) {
                            console.error('[CommandPalette] import read error', err);
                            showToast('ファイルの読み込みに失敗しました');
                        }
                    });
                }
            }
            catch (error) {
                console.error('[CommandPalette] Error setting up manager event listeners:', error);
            }
        }
        /**
         * マネージャを開く
         */
        openManager() {
            this.renderManager();
            if (this.dom.mgrOverlay) {
                this.dom.mgrOverlay.style.display = 'block';
                setFocusTimeout(() => {
                    const i = this.dom.mgrBox?.querySelector('input');
                    if (i)
                        i.focus();
                });
            }
        }
        /**
         * マネージャを閉じる
         */
        closeManager() {
            if (this.dom.mgrOverlay) {
                this.dom.mgrOverlay.style.display = 'none';
            }
        }
        /**
         * マネージャをレンダリング
         */
        renderManager() {
            if (!this.dom.siteBodyEl)
                return;
            this.dom.siteBodyEl.innerHTML = '';
            getSites().forEach(s => this.addSiteRow({ ...s }));
        }
        /**
         * サイト行を追加
         */
        addSiteRow(data) {
            if (!this.dom.siteBodyEl)
                return;
            const tr = document.createElement('tr');
            if (data.id)
                tr.dataset.entryId = data.id;
            tr.innerHTML = `
      <td class="drag">⋮⋮</td>
      <td><input type="text" data-field="name" value="${escapeHtml(data.name || '')}"/></td>
      <td><input type="text" data-field="url" placeholder="https://example.com/" value="${escapeHtml(data.url || '')}"/></td>
      <td><input type="text" data-field="tags" placeholder="カンマ区切り" value="${escapeHtml((data.tags || []).join(', '))}"/></td>
      <td class="row-btns">
        <button class="btn" data-up>↑</button>
        <button class="btn" data-down>↓</button>
        <button class="btn" data-test>テスト</button>
        <button class="btn danger" data-del>削除</button>
      </td>`;
            const inputs = getSiteRowInputs(tr);
            const urlInput = inputs.urlInput;
            const tagsInput = inputs.tagsInput;
            // タグ入力フィールドにオートコンプリートを適用
            if (tagsInput) {
                new ManagerAutocomplete(this.dom, tagsInput, (tag) => {
                    // タグ選択時の処理はManagerAutocompleteクラス内で実装済み
                });
            }
            tr.querySelector('[data-up]')?.addEventListener('click', () => this.moveRow(tr, -1, this.dom.siteBodyEl));
            tr.querySelector('[data-down]')?.addEventListener('click', () => this.moveRow(tr, 1, this.dom.siteBodyEl));
            tr.querySelector('[data-del]')?.addEventListener('click', () => { tr.remove(); });
            tr.querySelector('[data-test]')?.addEventListener('click', () => {
                const u = urlInput?.value.trim();
                if (u)
                    window.open(u.includes('%s') ? u.replace(/%s/g, encodeURIComponent('test')) : u, '_blank');
            });
            this.dom.siteBodyEl.appendChild(tr);
        }
        /**
         * 行を移動
         */
        moveRow(tr, delta, container) {
            const rows = Array.from(container.children);
            const i = rows.indexOf(tr);
            if (i < 0)
                return;
            const ni = Math.min(rows.length - 1, Math.max(0, i + delta));
            if (ni === i)
                return;
            if (delta < 0) {
                container.insertBefore(tr, rows[ni]);
            }
            else {
                container.insertBefore(tr, rows[ni].nextSibling);
            }
        }
        /**
         * マネージャを保存
         */
        saveManager() {
            if (!this.dom.siteBodyEl)
                return;
            const previousSites = getSites();
            const sites = Array.from(this.dom.siteBodyEl.querySelectorAll('tr')).map((tr, index) => {
                const name = tr.querySelector('input[data-field="name"]')?.value.trim() || '';
                const url = tr.querySelector('input[data-field="url"]')?.value.trim() || '';
                const tags = tr.querySelector('input[data-field="tags"]')?.value.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean) || [];
                if (!name || !url)
                    return null;
                const existing = tr.dataset.entryId && previousSites.find(s => s.id === tr.dataset.entryId);
                const id = existing ? existing.id : (tr.dataset.entryId || `site-${Math.random().toString(36).slice(2, 10)}`);
                return { id, type: 'site', name, url, tags };
            }).filter(Boolean);
            setSites(sites);
            pruneUsage(new Set([...sites.map(s => s.id)]));
            showToast('保存しました');
            this.onRenderList();
        }
        /**
         * サイトをエクスポート
         */
        exportSites() {
            const sites = getSites();
            const json = JSON.stringify(sites, null, 2);
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
            const filename = `sites-backup-${stamp}.json`;
            if (this.downloadTextFile(filename, json)) {
                showToast('エクスポートファイルをダウンロードしました');
            }
            else {
                showToast('エクスポートに失敗しました');
            }
        }
        /**
         * テキストファイルをダウンロード
         */
        downloadTextFile(filename, text) {
            try {
                const blob = new Blob([text], { type: 'application/json;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.rel = 'noopener';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setUrlRevokeTimeout(() => URL.revokeObjectURL(url));
                return true;
            }
            catch (e) {
                console.error('[CommandPalette] export failed', e);
                return false;
            }
        }
        /**
         * JSONからサイトをインポート
         */
        importSitesFromJson(jsonText) {
            if (!jsonText) {
                showToast('無効なJSONです');
                return;
            }
            try {
                const arr = JSON.parse(jsonText);
                if (!Array.isArray(arr))
                    throw new Error('not array');
                setSites(arr);
                pruneUsage(new Set(getSites().map(e => e.id)));
                this.renderManager();
                showToast('読み込みました');
            }
            catch (err) {
                console.error('[CommandPalette] import parse error', err);
                showToast('無効なJSONです');
            }
        }
    }

    /**
     * 設定UIを管理するクラス
     */
    class SettingsUI {
        constructor(dom, onApplyTheme) {
            this.cachedSettings = null;
            this.dom = dom;
            this.onApplyTheme = onApplyTheme;
        }
        /**
         * 設定を構築
         */
        buildSettings() {
            this.dom.setOverlay = document.createElement('div');
            this.dom.setOverlay.className = 'set-overlay';
            this.dom.setOverlay.addEventListener('click', e => {
                if (e.target === this.dom.setOverlay)
                    this.closeSettings();
            });
            this.dom.setBox = document.createElement('div');
            this.dom.setBox.className = 'set';
            this.dom.setBox.innerHTML = `
      <header>
        <h3>設定</h3>
        <div>
          <button class="btn primary" id="vs-save">保存</button>
          <button class="btn" id="vs-close">閉じる</button>
        </div>
      </header>
      <div class="form-row">
        <div>ホットキー（メイン）</div>
        <div class="inline"><input id="vs-hotkey1" type="text" class="hotkey-box" placeholder="押して設定" readonly></div>
      </div>
      <div class="form-row">
        <div>ホットキー（サブ）</div>
        <div class="inline"><input id="vs-hotkey2" type="text" class="hotkey-box" placeholder="押して設定" readonly></div>
      </div>
      <div class="form-row">
        <div>Enter の動作</div>
        <div class="inline">
          <label><input type="radio" name="vs-enter" value="current"> 現在のタブで開く</label>
          <label><input type="radio" name="vs-enter" value="newtab"> 新規タブで開く</label>
          <span class="muted">Shift は逆の動作</span>
        </div>
      </div>
      <div class="form-row">
        <div>テーマ</div>
        <div class="inline">
          <label><input type="radio" name="vs-theme" value="dark"> ダーク</label>
          <label><input type="radio" name="vs-theme" value="light"> ライト</label>
        </div>
      </div>
      <div class="form-row">
        <div>アクセントカラー</div>
        <div class="inline">
          <input type="color" id="vs-accent" value="#2563eb" style="width:60px; height:34px; padding:0; border-radius:8px; border: none;">
          <input type="text" id="vs-accent-text" placeholder="#2563eb" style="width:120px;">
        </div>
      </div>
      <div class="form-row">
        <div>無効にするホスト</div>
        <div>
          <textarea id="vs-blocklist" rows="4" placeholder="例:\n*.example.com\nlocalhost"></textarea>
          <div class="muted">1行1パターン（* ワイルドカード可）。一致するページではパレットは開かない。</div>
        </div>
      </div>
      <div class="form-row">
        <div>自動で開くURL</div>
        <div>
          <textarea id="vs-auto-open" rows="4" placeholder="例:\nhttps://example.com/path\nhttps://*.example.org/"></textarea>
          <div class="muted">1行につき1URL。前方一致（*ワイルドカード可）で一致したページでパレットを自動表示。</div>
        </div>
      </div>
      <footer>
        <div class="inline">
          <button class="btn" id="vs-reset">既定値に戻す</button>
          <button class="btn" id="vs-clear-fav">faviconキャッシュをクリア</button>
        </div>
        <span class="muted">Ctrl/⌘S で保存、Esc で閉じる</span>
      </footer>`;
            this.dom.setOverlay.appendChild(this.dom.setBox);
            if (this.dom.root) {
                this.dom.root.appendChild(this.dom.setOverlay);
            }
            const elements = getSettingsElements(this.dom.setBox);
            addClickListener(elements.closeBtn, () => this.closeSettings());
            addClickListener(elements.saveBtn, () => this.saveSettingsFromUI());
            addClickListener(elements.resetBtn, () => {
                this.applySettingsToUI(defaultSettings);
            });
            addClickListener(elements.clearFavBtn, () => {
                // キャッシュをクリア
                const emptyCache = {};
                GM_setValue('vm_sites_palette__favcache_v1', emptyCache);
                showToast('faviconキャッシュを削除しました');
            });
            addKeydownListener(this.dom.setBox, e => {
                if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    this.saveSettingsFromUI();
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.closeSettings();
                }
            });
            this.setupHotkeyCapture(elements.hotkey1Input, 'hotkeyPrimary');
            this.setupHotkeyCapture(elements.hotkey2Input, 'hotkeySecondary');
            this.setupAccentSync();
        }
        /**
         * 設定を開く
         */
        openSettings() {
            this.cachedSettings = getSettings();
            this.onApplyTheme();
            this.applySettingsToUI(this.cachedSettings);
            if (this.dom.setOverlay) {
                this.dom.setOverlay.style.display = 'block';
            }
        }
        /**
         * 設定を閉じる
         */
        closeSettings() {
            if (this.dom.setOverlay) {
                this.dom.setOverlay.style.display = 'none';
            }
        }
        /**
         * 設定をUIに適用
         */
        applySettingsToUI(s) {
            if (!this.dom.setBox)
                return;
            const hotkey1Input = this.dom.setBox.querySelector('#vs-hotkey1');
            const hotkey2Input = this.dom.setBox.querySelector('#vs-hotkey2');
            if (hotkey1Input) {
                hotkey1Input.value = this.labelHotkey(s.hotkeyPrimary);
                hotkey1Input.dataset.sig = s.hotkeyPrimary;
            }
            if (hotkey2Input) {
                hotkey2Input.value = this.labelHotkey(s.hotkeySecondary);
                hotkey2Input.dataset.sig = s.hotkeySecondary;
            }
            Array.from(this.dom.setBox.querySelectorAll('input[name="vs-enter"]')).forEach(r => {
                const input = r;
                input.checked = input.value === s.enterOpens;
            });
            Array.from(this.dom.setBox.querySelectorAll('input[name="vs-theme"]')).forEach(r => {
                const input = r;
                input.checked = input.value === (s.theme || 'dark');
            });
            const accent = s.accentColor || defaultSettings.accentColor;
            const accentInput = this.dom.setBox.querySelector('#vs-accent');
            const accentText = this.dom.setBox.querySelector('#vs-accent-text');
            if (accentInput)
                accentInput.value = this.normalizeColor(accent);
            if (accentText)
                accentText.value = this.normalizeColor(accent);
            const blocklistInput = this.dom.setBox.querySelector('#vs-blocklist');
            if (blocklistInput)
                blocklistInput.value = s.blocklist || '';
            const autoOpenInput = this.dom.setBox.querySelector('#vs-auto-open');
            if (autoOpenInput) {
                const auto = this.normalizeAutoOpen(s.autoOpenUrls);
                autoOpenInput.value = auto.join('\n');
            }
        }
        /**
         * UIから設定を保存
         */
        saveSettingsFromUI() {
            if (!this.dom.setBox)
                return;
            const elements = getSettingsElements(this.dom.setBox);
            const s = {
                hotkeyPrimary: elements.hotkey1Input?.dataset.sig || defaultSettings.hotkeyPrimary,
                hotkeySecondary: elements.hotkey2Input?.dataset.sig || defaultSettings.hotkeySecondary,
                enterOpens: (this.dom.setBox.querySelector('input[name="vs-enter"]:checked')?.value || 'current'),
                theme: (this.dom.setBox.querySelector('input[name="vs-theme"]:checked')?.value || defaultSettings.theme),
                accentColor: this.normalizeColor(getInputValue(elements.accentText) || getInputValue(elements.accentInput) || defaultSettings.accentColor),
                blocklist: elements.blocklistInput?.value.trim() || '',
                autoOpenUrls: this.normalizeAutoOpen(elements.autoOpenInput?.value.trim() || '')
            };
            setSettings(s);
            this.cachedSettings = s;
            this.onApplyTheme();
            showToast('設定を保存しました');
        }
        /**
         * カラーを正規化
         */
        normalizeColor(value) {
            let v = (value || '').trim();
            if (!v)
                return defaultSettings.accentColor;
            if (!v.startsWith('#'))
                v = '#' + v.replace(/^#+/, '');
            if (v.length === 4)
                v = '#' + v.slice(1).split('').map(ch => ch + ch).join('');
            if (/^#[0-9a-fA-F]{6}$/.test(v))
                return v.toLowerCase();
            return defaultSettings.accentColor;
        }
        /**
         * 自動オープンURLを正規化
         */
        normalizeAutoOpen(value) {
            if (!value)
                return [];
            if (Array.isArray(value))
                return value.map(v => (v || '').trim()).filter(Boolean);
            return value.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
        }
        /**
         * アクセントカラー同期を設定
         */
        setupAccentSync() {
            if (!this.dom.setBox)
                return;
            const elements = getSettingsElements(this.dom.setBox);
            const colorInput = elements.accentInput;
            const textInput = elements.accentText;
            const hexFull = (v) => /^#?[0-9a-fA-F]{6}$/.test(v.replace(/^#/, ''));
            colorInput.addEventListener('input', () => {
                const val = colorInput.value;
                if (textInput)
                    textInput.value = val;
            });
            textInput.addEventListener('input', () => {
                const raw = textInput.value.trim();
                if (hexFull(raw)) {
                    const normalized = this.normalizeColor(raw);
                    colorInput.value = normalized;
                }
            });
            textInput.addEventListener('blur', () => {
                const normalized = this.normalizeColor(textInput.value);
                textInput.value = normalized;
                colorInput.value = normalized;
            });
        }
        /**
         * ホットキーキャプチャを設定
         */
        setupHotkeyCapture(input, field) {
            if (!input)
                return;
            input.addEventListener('focus', () => {
                input.value = '任意のキーを押す';
            });
            input.addEventListener('blur', () => {
                const sig = input.dataset.sig || getSettings()[field];
                input.value = this.labelHotkey(sig || '');
            });
            input.addEventListener('keydown', (e) => {
                e.preventDefault();
                // 修飾キー自体がメインキーとして押された場合は無視
                const isModifierKey = [
                    'MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight',
                    'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight'
                ].includes(e.code);
                if (isModifierKey) {
                    input.value = '修飾キー以外のキーを押してください';
                    return;
                }
                // 修飾キーの状態を収集
                const modifiers = [];
                if (e.metaKey)
                    modifiers.push('Meta');
                if (e.ctrlKey)
                    modifiers.push('Control');
                if (e.altKey)
                    modifiers.push('Alt');
                if (e.shiftKey)
                    modifiers.push('Shift');
                // 少なくとも1つの修飾キーが必要
                if (modifiers.length === 0) {
                    input.value = '修飾キー(Ctrl/Alt/Shift/Meta)を含めて押す';
                    return;
                }
                // ホットキー文字列を生成（例: "Meta+Shift+KeyP"）
                const sig = [...modifiers, e.code].join('+');
                input.dataset.sig = sig;
                input.value = this.labelHotkey(sig);
            });
        }
        /**
         * ホットキーラベルを生成
         */
        labelHotkey(sig) {
            if (!sig)
                return '';
            // ホットキー文字列を解析
            const parts = sig.split('+');
            const mainKey = parts[parts.length - 1]; // 最後の部分がメインキー
            const modifiers = parts.slice(0, -1); // 修飾キーの部分
            // 修飾キーがメインキーとして設定されている場合は無効
            const isModifierKey = [
                'MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight',
                'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight'
            ].includes(mainKey);
            if (isModifierKey) {
                return '無効なホットキー';
            }
            // メインキーの表示名を整形
            let keyName = mainKey.replace(/^Key/, '').replace(/^Digit/, '');
            // 特殊キーの表示名を調整
            const specialKeys = {
                'Space': 'Space',
                'Enter': 'Enter',
                'Escape': 'Esc',
                'Tab': 'Tab',
                'Backspace': 'Backspace',
                'Delete': 'Delete',
                'ArrowUp': '↑',
                'ArrowDown': '↓',
                'ArrowLeft': '←',
                'ArrowRight': '→'
            };
            if (specialKeys[mainKey]) {
                keyName = specialKeys[mainKey];
            }
            // 修飾キーの表示名を生成
            const isMac = /mac/i.test(navigator.platform);
            const modifierLabels = [];
            for (const mod of modifiers) {
                if (mod === 'Meta') {
                    modifierLabels.push(isMac ? '⌘' : 'Win+');
                }
                else if (mod === 'Control') {
                    modifierLabels.push(isMac ? '⌃' : 'Ctrl+');
                }
                else if (mod === 'Alt') {
                    modifierLabels.push(isMac ? '⌥' : 'Alt+');
                }
                else if (mod === 'Shift') {
                    modifierLabels.push(isMac ? '⇧' : 'Shift+');
                }
            }
            // 修飾キーとメインキーを結合
            return modifierLabels.join('') + keyName;
        }
    }

    /**
     * パレットのコアロジックを管理するクラス
     */
    class PaletteCore {
        constructor(inputEl) {
            this.inputEl = null;
            this.inputEl = inputEl || null;
        }
        /**
         * 入力要素を設定
         */
        setInputElement(inputEl) {
            this.inputEl = inputEl;
        }
        /**
         * エントリを実行する
         */
        executeEntry(entry, shiftPressed, query) {
            if (!entry)
                return;
            const settings = getSettings();
            const preferNew = settings.enterOpens === 'newtab';
            const openNew = shiftPressed ? !preferNew : preferNew;
            let targetUrl = entry.url;
            if (entry.url && entry.url.includes('%s')) {
                const q = query !== undefined ? query : this.inputEl?.value.trim() || '';
                if (!q) {
                    if (this.inputEl) {
                        this.inputEl.value = '';
                        this.inputEl.placeholder = `${entry.name} に検索キーワードを入力…`;
                    }
                    showToast('検索キーワードを入力してください');
                    this.inputEl?.focus();
                    return;
                }
                targetUrl = entry.url.replace(/%s/g, encodeURIComponent(q));
            }
            // パレットを閉じる処理は呼び出し元に委ねる
            incrementUsage(entry.id);
            this.openUrlWithPreference(targetUrl, openNew ? 'newtab' : 'same');
        }
        /**
         * Bing検索を実行する
         */
        runBingSearch(shiftPressed, entry, query) {
            const keywords = (query || '').trim();
            if (!keywords) {
                showToast('検索キーワードを入力してください');
                return;
            }
            const mode = shiftPressed ? 'newtab' : 'auto';
            this.openUrlWithPreference(`https://www.bing.com/search?q=${encodeURIComponent(keywords)}`, mode);
        }
        /**
         * 入力からBing検索を実行する
         */
        runBingSearchFromInput() {
            const q = this.inputEl?.value.trim() || '';
            if (!q) {
                showToast('検索キーワードを入力してください');
                return;
            }
            this.openUrlWithPreference(`https://www.bing.com/search?q=${encodeURIComponent(q)}`);
        }
        /**
         * 設定に応じてURLを開く
         */
        openUrlWithPreference(url, mode = 'auto') {
            const settings = getSettings();
            const openNew = mode === 'newtab' ? true : mode === 'same' ? false : mode === 'command' ? true : settings.enterOpens === 'newtab';
            if (openNew) {
                try {
                    GM_openInTab(url, { active: true, insert: true });
                }
                catch {
                    window.open(url, '_blank');
                }
            }
            else {
                try {
                    location.assign(url);
                }
                catch {
                    location.href = url;
                }
            }
        }
        /**
         * 現在のページを追加する
         */
        runAddCurrent() {
            // この処理はストレージモジュールに依存するため、ここでは実装しない
            // 呼び出し元で適切に処理する
            showToast('現在のページを登録しました');
        }
        /**
         * URLをコピーする
         */
        copyUrl() {
            try {
                GM_setClipboard(location.href);
                showToast('URLをコピーしました');
            }
            catch {
                navigator.clipboard?.writeText(location.href);
                showToast('URLをコピーしました');
            }
        }
    }

    /**
     * ホットキーが一致するかチェックする
     */
    const matchHotkey = (e, sig) => {
        if (!sig)
            return false;
        // ホットキー文字列を解析（例: "Meta+Shift+KeyP"）
        const parts = sig.split('+');
        const mainKey = parts[parts.length - 1]; // 最後の部分がメインキー
        // 修飾キーの部分を取得
        const modifiers = parts.slice(0, -1);
        // 修飾キー自体がメインキーとして設定されている場合は無効
        const isModifierKey = [
            'MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight',
            'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight'
        ].includes(mainKey);
        if (isModifierKey)
            return false;
        // メインキーが一致するかチェック
        if (e.code !== mainKey)
            return false;
        // 修飾キーの状態をチェック
        const hasMeta = modifiers.includes('Meta');
        const hasControl = modifiers.includes('Control');
        const hasAlt = modifiers.includes('Alt');
        const hasShift = modifiers.includes('Shift');
        // 修飾キーの状態が一致するかチェック
        return ((hasMeta === e.metaKey) &&
            (hasControl === e.ctrlKey) &&
            (hasAlt === e.altKey) &&
            (hasShift === e.shiftKey));
    };
    /**
     * サイトがブロックリストに含まれるかチェックする
     */
    const isBlocked = () => {
        const s = getSettings();
        const patterns = (s.blocklist || '').split(/\r?\n/).map(t => t.trim()).filter(Boolean);
        if (!patterns.length)
            return false;
        const host = location.hostname;
        return patterns.some(p => wildcard(host, p));
    };
    /**
     * 自動オープンが必要かチェックする
     */
    const shouldAutoOpen = () => {
        const { autoOpenUrls = [] } = getSettings();
        if (!Array.isArray(autoOpenUrls) || !autoOpenUrls.length)
            return false;
        const current = location.href;
        return autoOpenUrls.some(pattern => {
            const parts = pattern.split('*').map(x => x.replace(/[\.^$+?()|{}\[\]]/g, r => '\\' + r));
            const regex = new RegExp('^' + parts.join('.*') + '');
            return regex.test(current);
        });
    };
    // グローバルホットキーコールバックを保持する変数
    let globalHotkeyCallback = null;
    // パレットが開いているかどうかを追跡する変数
    let isPaletteOpen = false;
    /**
     * パレットの開閉状態を設定する
     */
    const setPaletteOpenState = (isOpen) => {
        isPaletteOpen = isOpen;
    };
    /**
     * グローバルキーボードイベントハンドラ
     */
    const onGlobalKeydown = (e) => {
        try {
            // ブロックサイトでは処理しない
            if (isBlocked())
                return;
            // デバッグログ
            if (isPaletteOpen) {
                console.log('[Debug] Global keydown:', {
                    key: e.key,
                    code: e.code,
                    target: e.target,
                    targetTagName: e.target?.tagName,
                    targetClassName: e.target?.className,
                    isComposing: e.isComposing,
                    keyCode: e.keyCode
                });
            }
            // パレットが開いている場合は、特定のキー以外は無視
            if (isPaletteOpen) {
                // パレット内の要素からのイベントかチェック
                const target = e.target;
                const isInPalette = target && (target.closest('#vm-cmd-palette-host') ||
                    target.closest('.overlay') ||
                    target.closest('.panel'));
                console.log('[Debug] Is in palette:', isInPalette, 'Target:', target);
                // パレット内からのイベントでない場合は無視
                if (!isInPalette) {
                    // Escキーは常に許可（パネルを閉じるため）
                    if (e.key === 'Escape') {
                        return; // Escキーは許可
                    }
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                // パレット内の入力フィールドの場合は、ほぼすべてのキーを許可
                const inputTarget = e.target;
                const isInputField = inputTarget && (inputTarget.tagName === 'INPUT' ||
                    inputTarget.tagName === 'TEXTAREA' ||
                    inputTarget.contentEditable === 'true');
                console.log('[Debug] Is input field:', isInputField);
                // 入力フィールド内では基本的にすべてのキーを許可
                if (isInputField) {
                    console.log('[Debug] Allowing key in input field');
                    // 入力フィールド内では何も制限しない
                    return;
                }
                // 入力フィールド以外のパネル内要素では、特定のキーのみ許可
                const allowedKeys = [
                    'Escape', 'Enter', 'Tab', 'ArrowUp', 'ArrowDown',
                    'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete',
                    'Home', 'End', 'PageUp', 'PageDown', ' '
                ];
                // 修飾キーのみの場合は許可
                if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) {
                    return;
                }
                // Meta+Enter（Cmd+Enter）は常に許可（Web検索用）
                if (e.key === 'Enter' && e.metaKey) {
                    console.log('[Debug] Allowing Cmd+Enter for web search');
                    return;
                }
                // 許可されたキーでない場合は無視
                if (!allowedKeys.includes(e.key)) {
                    console.log('[Debug] Blocking key:', e.key);
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                return; // パレットが開いている場合はここで処理終了
            }
            // 編集中の要素では処理しない
            const mainTarget = e.target;
            const tag = (mainTarget && mainTarget.tagName) || '';
            const editable = ['INPUT', 'TEXTAREA'].includes(tag) ||
                (mainTarget && mainTarget.isContentEditable);
            if (editable)
                return;
            const settings = getSettings();
            // ホットキーをチェック
            if (matchHotkey(e, settings.hotkeyPrimary) || matchHotkey(e, settings.hotkeySecondary)) {
                e.preventDefault();
                e.stopPropagation();
                // パレットを開く処理を実行
                if (globalHotkeyCallback) {
                    globalHotkeyCallback();
                }
            }
        }
        catch (error) {
            console.error('[CommandPalette] Global hotkey error:', error);
        }
    };
    /**
     * グローバルホットキーコールバックを設定する
     */
    const setGlobalHotkeyCallback = (callback) => {
        globalHotkeyCallback = callback;
    };
    /**
     * グローバルホットキーを設定する
     */
    const setupGlobalHotkey = (settings) => {
        // 既存のリスナーを削除
        window.removeEventListener('keydown', onGlobalKeydown, true);
        // 新しいリスナーを追加（バブリングフェーズでキャプチャ）
        window.addEventListener('keydown', onGlobalKeydown, false);
    };

    /**
     * キーボードイベント処理を管理するクラス
     */
    class KeyboardHandler {
        constructor(handlers) {
            /**
             * 入力キーボードイベントを処理する
             */
            this.onInputKey = (e, currentItems, activeIndex, inputEl, isAutocompleteVisible) => {
                if (e.isComposing || e.keyCode === 229) {
                    return activeIndex;
                }
                if (isAutocompleteVisible) {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        this.onHideAutocomplete();
                        return activeIndex;
                    }
                    return activeIndex;
                }
                if (e.key === 'Enter' && e.metaKey) {
                    e.preventDefault();
                    this.onBingSearch();
                    return activeIndex;
                }
                if (e.key === 'Escape') {
                    this.onPaletteHide();
                    return activeIndex;
                }
                if (e.key === 'Tab' && !e.shiftKey && inputEl.value.trim() === '') {
                    e.preventDefault();
                    const allTags = getAllTags();
                    if (allTags.length > 0) {
                        inputEl.value = '#' + allTags[0] + ' ';
                        this.onRenderList();
                        this.onShowAutocomplete(allTags[0]);
                    }
                    return activeIndex;
                }
                if (!currentItems.length) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const q = inputEl.value.trim();
                        if (!q) {
                            showToast('検索キーワードを入力してください');
                            return activeIndex;
                        }
                        // Bing検索を実行
                        window.open(`https://www.bing.com/search?q=${encodeURIComponent(q)}`, '_blank');
                    }
                    return activeIndex;
                }
                let newActiveIndex = activeIndex;
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    newActiveIndex = (activeIndex + 1) % currentItems.length;
                    this.onUpdateActive();
                }
                else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    newActiveIndex = (activeIndex - 1 + currentItems.length) % currentItems.length;
                    this.onUpdateActive();
                }
                else if (e.key === 'Enter') {
                    e.preventDefault();
                    const item = currentItems[activeIndex];
                    this.onExecuteEntry(item, e.shiftKey);
                }
                return newActiveIndex;
            };
            /**
             * グローバルホットキーハンドラを更新する
             */
            this.updateHotkeyHandler = (e, settings, onOpenPalette) => {
                if (matchHotkey(e, settings.hotkeyPrimary) || matchHotkey(e, settings.hotkeySecondary)) {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenPalette();
                }
            };
            /**
             * オートコンプリートキーボード処理
             */
            this.handleAutocompleteKeydown = (e, autocompleteItems, autocompleteIndex, isVisible) => {
                if (!isVisible) {
                    return { newIndex: autocompleteIndex, shouldHide: false };
                }
                let newIndex = autocompleteIndex;
                let shouldHide = false;
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    newIndex = (autocompleteIndex + 1) % autocompleteItems.length;
                }
                else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    newIndex = (autocompleteIndex - 1 + autocompleteItems.length) % autocompleteItems.length;
                }
                else if (e.key === 'Enter' && autocompleteIndex >= 0) {
                    e.preventDefault();
                    // アイテム選択処理は呼び出し元に委ねる
                }
                else if (e.key === 'Escape') {
                    shouldHide = true;
                }
                return { newIndex, shouldHide };
            };
            this.onPaletteHide = handlers.onPaletteHide;
            this.onPaletteOpen = handlers.onPaletteOpen;
            this.onRenderList = handlers.onRenderList;
            this.onUpdateActive = handlers.onUpdateActive;
            this.onExecuteEntry = handlers.onExecuteEntry;
            this.onShowAutocomplete = handlers.onShowAutocomplete;
            this.onHideAutocomplete = handlers.onHideAutocomplete;
            this.onBingSearch = handlers.onBingSearch;
        }
    }

    /**
     * テスト用のサンプルデータを作成
     */
    const createSampleData = () => {
        return [
            {
                id: 'sample-1',
                type: 'site',
                name: 'GitHub',
                url: 'https://github.com',
                tags: ['development', 'work/project', 'tools']
            },
            {
                id: 'sample-2',
                type: 'site',
                name: 'Google',
                url: 'https://google.com',
                tags: ['search', 'daily']
            },
            {
                id: 'sample-3',
                type: 'site',
                name: 'Stack Overflow',
                url: 'https://stackoverflow.com',
                tags: ['development', 'programming', 'help']
            },
            {
                id: 'sample-4',
                type: 'site',
                name: 'Reddit',
                url: 'https://reddit.com',
                tags: ['social', 'entertainment']
            },
            {
                id: 'sample-5',
                type: 'site',
                name: 'YouTube',
                url: 'https://youtube.com',
                tags: ['video', 'entertainment', 'learning']
            },
            {
                id: 'sample-6',
                type: 'site',
                name: 'MDN Web Docs',
                url: 'https://developer.mozilla.org',
                tags: ['development', 'documentation', 'web']
            },
            {
                id: 'sample-7',
                type: 'site',
                name: 'Twitter',
                url: 'https://twitter.com',
                tags: ['social', 'news']
            },
            {
                id: 'sample-8',
                type: 'site',
                name: 'Notion',
                url: 'https://notion.so',
                tags: ['productivity', 'work/notes', 'organization']
            },
            {
                id: 'sample-9',
                type: 'site',
                name: 'Figma',
                url: 'https://figma.com',
                tags: ['design', 'work/tools', 'collaboration']
            },
            {
                id: 'sample-10',
                type: 'site',
                name: 'Slack',
                url: 'https://slack.com',
                tags: ['communication', 'work/chat', 'team']
            },
            {
                id: 'sample-11',
                type: 'site',
                name: 'DeepSeek',
                url: 'https://deepseek.com',
                tags: ['ai/deepseek', 'ai/chat', 'platform']
            },
            {
                id: 'sample-12',
                type: 'site',
                name: 'ChatGPT',
                url: 'https://chat.openai.com',
                tags: ['ai/openai', 'ai/chat', 'platform']
            },
            {
                id: 'sample-13',
                type: 'site',
                name: 'Claude',
                url: 'https://claude.ai',
                tags: ['ai/anthropic', 'ai/chat', 'platform']
            },
            {
                id: 'sample-14',
                type: 'site',
                name: 'Gemini',
                url: 'https://gemini.google.com',
                tags: ['ai/gemini', 'ai/chat', 'platform']
            }
        ];
    };
    /**
     * サンプルデータをストレージに追加（開発用）
     */
    const addSampleData = () => {
        try {
            const existing = window.GM_getValue?.('vm_sites_palette__sites', []) || [];
            const sampleData = createSampleData();
            // 重複チェック
            const existingIds = new Set(existing.map((item) => item.id));
            const newItems = sampleData.filter(item => !existingIds.has(item.id));
            if (newItems.length > 0) {
                const updated = [...existing, ...newItems];
                window.GM_setValue?.('vm_sites_palette__sites', updated);
            }
            else {
                // サンプルデータは既に存在
            }
        }
        catch (error) {
            console.error('[CommandPalette] Failed to add sample data:', error);
        }
    };

    /**
     * アプリケーションメインクラス
     */
    class CommandPaletteApp {
        constructor() {
            /**
             * グローバルホットキーハンドラを更新
             */
            this.updateHotkeyHandler = (e) => {
                const settings = this.getSettings();
                this.keyboardHandler.updateHotkeyHandler(e, settings, () => this.openPalette());
            };
            // 状態の初期化
            this.state = createInitialState();
            this.dom = createInitialDOMElements();
            this.autocompleteState = createInitialAutocompleteState();
            // コンポーネントの初期化
            this.palette = new Palette(this.state, this.dom, (item, shiftPressed) => this.executeEntry(item, shiftPressed), () => this.openManager(), () => this.openSettings());
            this.autocomplete = new Autocomplete(this.dom, this.autocompleteState, () => this.renderList(), () => this.updateActive());
            this.manager = new Manager(this.dom, () => this.renderList());
            this.settings = new SettingsUI(this.dom, () => this.applyTheme());
            this.paletteCore = new PaletteCore();
            this.keyboardHandler = new KeyboardHandler({
                onPaletteHide: () => this.hidePalette(),
                onPaletteOpen: () => this.openPalette(),
                onRenderList: () => this.renderList(),
                onUpdateActive: () => this.updateActive(),
                onExecuteEntry: (item, shiftKey) => this.executeEntry(item, shiftKey),
                onShowAutocomplete: (tag) => this.showAutocomplete(tag),
                onHideAutocomplete: () => this.hideAutocomplete(),
                onBingSearch: () => this.runBingSearch()
            });
            // グローバルアクセス用（既存コードとの互換性）
            window.toastEl = this.dom.toastEl;
        }
        /**
         * パレットを開く
         */
        openPalette() {
            setPaletteOpenState(true);
            this.palette.openPalette();
            this.setupEventListeners();
        }
        /**
         * パレットを閉じる
         */
        hidePalette() {
            setPaletteOpenState(false);
            this.palette.hidePalette();
        }
        /**
         * テーマを適用する
         */
        applyTheme() {
            this.palette.applyTheme();
        }
        /**
         * リストをレンダリングする
         */
        renderList() {
            this.palette.refreshList();
        }
        /**
         * アクティブなアイテムを更新する
         */
        updateActive() {
            this.palette.updateActive();
        }
        /**
         * エントリを実行する
         */
        executeEntry(item, shiftPressed) {
            this.paletteCore.setInputElement(this.dom.inputEl);
            this.paletteCore.executeEntry(item, shiftPressed);
            this.hidePalette();
        }
        /**
         * Bing検索を実行する
         */
        runBingSearch() {
            this.paletteCore.setInputElement(this.dom.inputEl);
            this.paletteCore.runBingSearchFromInput();
            this.hidePalette();
        }
        /**
         * オートコンプリートを表示
         */
        showAutocomplete(tag) {
            this.autocomplete.showAutocomplete(tag);
        }
        /**
         * オートコンプリートを非表示
         */
        hideAutocomplete() {
            this.autocomplete.hideAutocomplete();
        }
        /**
         * イベントリスナーを設定
         */
        setupEventListeners() {
            if (!this.dom.overlayEl || !this.dom.inputEl || !this.dom.hintEl)
                return;
            // オーバーレイクリックで閉じる
            this.dom.overlayEl.addEventListener('click', (e) => {
                if (e.target === this.dom.overlayEl)
                    this.hidePalette();
            });
            // オートコンプリートの構築（初回のみ）
            if (!this.dom.autocompleteEl) {
                this.autocomplete.buildAutocomplete();
            }
        }
        /**
         * マネージャを開く
         */
        openManager() {
            if (!this.dom.mgrOverlay) {
                this.manager.buildManager();
            }
            this.manager.openManager();
        }
        /**
         * 設定を開く
         */
        openSettings() {
            if (!this.dom.setOverlay) {
                this.settings.buildSettings();
            }
            this.settings.openSettings();
        }
        /**
         * 現在のページを追加
         */
        runAddCurrent() {
            const title = document.title || location.hostname;
            const url = location.href;
            const existing = getSites();
            const newSite = {
                id: `site-${Math.random().toString(36).slice(2, 10)}`,
                type: 'site',
                name: title,
                url: url || '',
                tags: []
            };
            setSites([...existing, newSite]);
            pruneUsage(new Set([...existing.map(s => s.id), newSite.id]));
            this.paletteCore.runAddCurrent();
            this.renderList();
        }
        /**
         * URLをコピー
         */
        copyUrl() {
            this.paletteCore.copyUrl();
        }
        /**
         * 設定を取得（暫定実装）
         */
        getSettings() {
            try {
                return { ...defaultSettings, ...window.GM_getValue?.('vm_sites_palette__settings_v2', {}) };
            }
            catch {
                return defaultSettings;
            }
        }
        /**
         * アプリケーションを初期化する
         */
        bootstrap() {
            try {
                // ストレージを初期化
                initializeStorage();
                // 設定を取得
                const settings = this.getSettings();
                // グローバルホットキーコールバックを設定
                setGlobalHotkeyCallback(() => this.openPalette());
                // グローバルホットキーを設定
                setupGlobalHotkey(settings);
                // メニューを登録
                if (typeof GM_registerMenuCommand === 'function') {
                    GM_registerMenuCommand('サイトマネージャを開く', () => this.openManager());
                    GM_registerMenuCommand('設定', () => this.openSettings());
                    GM_registerMenuCommand('現在のページを追加', () => this.runAddCurrent());
                    GM_registerMenuCommand('URLをコピー', () => this.copyUrl());
                    GM_registerMenuCommand('サンプルデータを追加', () => addSampleData());
                }
                // 自動オープンをチェック
                if (shouldAutoOpen()) {
                    setTimeout(() => this.openPalette(), 120);
                }
                // 二重ハンドラを削除（main.tsのハンドラは不要になった）
                window.removeEventListener('keydown', this.updateHotkeyHandler, true);
            }
            catch (error) {
                console.error('[CommandPalette] Bootstrap error:', error);
            }
        }
    }
    // アプリケーションを起動
    const app = new CommandPaletteApp();
    app.bootstrap();

})();
