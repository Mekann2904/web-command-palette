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
     * 状態管理クラス
     */
    /**
     * グローバル状態の初期化
     */
    const createInitialState = () => ({
        isOpen: false,
        currentItems: [],
        activeIndex: 0,
        cachedSettings: null,
        lastUpdated: Date.now()
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
        isVisible: false,
        lastUpdated: Date.now()
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
            '--panel-text': '#f9fafb', // #e5e7eb → #f9fafb (コントラスト向上)
            '--panel-shadow': '0 10px 40px rgba(0,0,0,.45)',
            '--input-bg': '#111827',
            '--input-text': '#f3f4f6',
            '--input-placeholder': '#9ca3af',
            '--border-color': '#374151',
            '--muted': '#d1d5db', // #94a3b8 → #d1d5db (コントラスト向上)
            '--item-bg-alt': 'rgba(255,255,255,.02)',
            '--item-active': '#374151',
            '--hint-bg': '#111827',
            '--list-scroll-thumb': '#4b5563',
            '--list-scroll-track': 'rgba(255,255,255,0.08)',
            '--command-badge-bg': 'rgba(255,255,255,0.12)',
            '--tag-bg': 'rgba(79,70,229,0.2)',
            '--tag-text': '#e0e7ff', // #c7d2fe → #e0e7ff (コントラスト向上)
            '--tag-suggestion-bg': 'rgba(79,70,229,0.1)',
            '--autocomplete-bg': '#1f2937',
            '--autocomplete-border': '#374151',
            '--toast-bg': 'rgba(17,24,39,0.92)',
            '--toast-text': '#f9fafb' // #e5e7eb → #f9fafb (コントラスト向上)
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
            '--muted': '#4b5563', // #6b7280 → #4b5563 (コントラスト向上)
            '--item-bg-alt': 'rgba(17,24,39,0.03)',
            '--item-active': 'rgba(37,99,235,0.12)',
            '--hint-bg': '#edf2f7',
            '--list-scroll-thumb': '#94a3ff',
            '--list-scroll-track': 'rgba(37,99,235,0.08)',
            '--command-badge-bg': 'rgba(37,99,235,0.15)',
            '--tag-bg': 'rgba(37,99,235,0.12)',
            '--tag-text': '#1e40af', // #1d4ed8 → #1e40af (コントラスト向上)
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

    // ストレージキーの定数
    const STORAGE_KEYS = {
        SITES: 'vm_sites_palette__sites',
        SETTINGS: 'vm_sites_palette__settings_v2',
        FAVCACHE: 'vm_sites_palette__favcache_v1',
        USAGE: 'vm_sites_palette__usage_v1'
    };
    // キャッシュ関連の定数
    const CACHE_TTL = 5 * 60 * 1000; // 5分
    const MAX_CACHE_SIZE = 1000;
    const ID_PREFIX = 'site';
    /**
     * ストレージ操作の基底クラス
     */
    class StorageBase {
        constructor() {
            this.cache = new Map();
        }
        /**
         * データを取得（キャッシュ付き）
         */
        get(defaultValue, useCache = false) {
            const key = this.getStorageKey();
            if (useCache) {
                const cached = this.cache.get(key);
                if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
                    return cached.data;
                }
            }
            const data = GM_getValue(key, defaultValue);
            if (useCache) {
                this.setCache(key, data);
            }
            return data;
        }
        /**
         * データを設定
         */
        set(value) {
            const key = this.getStorageKey();
            GM_setValue(key, value);
            this.updateCache(key, value);
        }
        /**
         * キャッシュを設定
         */
        setCache(key, data) {
            this.cache.set(key, {
                data,
                timestamp: Date.now()
            });
            // キャッシュサイズを制限
            if (this.cache.size > MAX_CACHE_SIZE) {
                this.pruneCache();
            }
        }
        /**
         * キャッシュを更新
         */
        updateCache(key, data) {
            const existing = this.cache.get(key);
            if (existing) {
                existing.data = data;
                existing.timestamp = Date.now();
            }
            else {
                this.setCache(key, data);
            }
        }
        /**
         * 古いキャッシュを削除
         */
        pruneCache() {
            const entries = Array.from(this.cache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            // 古い半分を削除
            const toDelete = entries.slice(0, Math.floor(entries.length / 2));
            toDelete.forEach(([key]) => this.cache.delete(key));
        }
        /**
         * キャッシュをクリア
         */
        clearCache() {
            this.cache.clear();
        }
    }
    /**
     * サイトストレージクラス
     */
    class SiteStorage extends StorageBase {
        getStorageKey() {
            return STORAGE_KEYS.SITES;
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
                if (JSON.stringify(item) !== JSON.stringify(norm))
                    mutated = true;
                normalized.push(norm);
            }
            if (!normalized.length) {
                normalized.push(...defaultSites.map(normalizeSite).filter(Boolean));
                mutated = true;
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
            try {
                const sites = this.getSites();
                const newSite = normalizeSite({ ...site, id: site.id || generateId() });
                if (!newSite) {
                    return { success: false, error: new Error('Invalid site data') };
                }
                sites.push(newSite);
                this.setSites(sites, true);
                return { success: true, data: newSite };
            }
            catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error : new Error(String(error))
                };
            }
        }
        /**
         * サイトを更新する
         */
        updateSite(id, updates) {
            try {
                const sites = this.getSites();
                const index = sites.findIndex(site => site.id === id);
                if (index === -1) {
                    return { success: false, error: new Error('Site not found') };
                }
                const updatedSite = { ...sites[index], ...updates };
                sites[index] = updatedSite;
                this.setSites(sites, true);
                return { success: true, data: updatedSite };
            }
            catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error : new Error(String(error))
                };
            }
        }
        /**
         * サイトを削除する
         */
        deleteSite(id) {
            try {
                const sites = this.getSites();
                const filteredSites = sites.filter(site => site.id !== id);
                if (filteredSites.length === sites.length) {
                    return { success: false, error: new Error('Site not found') };
                }
                this.setSites(filteredSites, true);
                return { success: true, data: true };
            }
            catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error : new Error(String(error))
                };
            }
        }
        /**
         * サイトを検索
         */
        searchSites(query) {
            if (!query.trim())
                return this.getSites();
            const normalizedQuery = query.toLowerCase().trim();
            return this.getSites().filter(site => site.name.toLowerCase().includes(normalizedQuery) ||
                site.url.toLowerCase().includes(normalizedQuery) ||
                site.tags.some(tag => tag.toLowerCase().includes(normalizedQuery)));
        }
    }
    /**
     * 設定ストレージクラス
     */
    class SettingsStorage extends StorageBase {
        getStorageKey() {
            return STORAGE_KEYS.SETTINGS;
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
            try {
                const currentSettings = this.getSettings();
                const newSettings = { ...currentSettings, ...settings };
                this.set(newSettings);
                return { success: true, data: newSettings };
            }
            catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error : new Error(String(error))
                };
            }
        }
        /**
         * 設定をリセットする
         */
        resetSettings() {
            try {
                this.set(defaultSettings);
                return { success: true, data: defaultSettings };
            }
            catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error : new Error(String(error))
                };
            }
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
        setCacheData(cache) {
            this.set(cache);
        }
        /**
         * キャッシュエントリを設定する
         */
        setCacheEntry(key, value) {
            const cache = this.getCache();
            cache[key] = value;
            this.setCacheData(cache);
        }
        /**
         * キャッシュエントリを削除する
         */
        deleteCacheEntry(key) {
            const cache = this.getCache();
            if (!(key in cache))
                return false;
            delete cache[key];
            this.setCacheData(cache);
            return true;
        }
        /**
         * キャッシュをクリアする
         */
        clearCache() {
            this.set({});
        }
        /**
         * キャッシュサイズを取得
         */
        getCacheSize() {
            return Object.keys(this.getCache()).length;
        }
    }
    // ストレージインスタンスを作成
    const siteStorage = new SiteStorage();
    const settingsStorage = new SettingsStorage();
    new CacheStorage(STORAGE_KEYS.FAVCACHE);
    const usageStorage = new CacheStorage(STORAGE_KEYS.USAGE);
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
        return settingsStorage.setSettings(settings);
    };
    /**
     * 使用回数を増やす（アトミック操作）
     */
    const incrementUsage = (id) => {
        if (!id) {
            return { success: false, error: new Error('Invalid ID') };
        }
        // リトライカウンタと最大リトライ回数
        let retryCount = 0;
        const maxRetries = 3;
        while (retryCount < maxRetries) {
            try {
                // 現在の使用回数を取得
                const currentUsage = usageStorage.getCache();
                const currentCount = currentUsage[id] || 0;
                // 新しい使用回数を計算
                const nextCount = currentCount + 1;
                // アトミックに更新（楽観的ロック）
                const updatedUsage = { ...currentUsage, [id]: nextCount };
                usageStorage.setCacheData(updatedUsage);
                // 更新が成功したか確認
                const verificationUsage = usageStorage.getCache();
                if (verificationUsage[id] === nextCount) {
                    return { success: true, data: nextCount };
                }
                // 競合が検出された場合、リトライ
                retryCount++;
                // 短い遅延を入れてからリトライ
                if (retryCount < maxRetries) {
                    const delay = Math.pow(2, retryCount) * 10; // 指数バックオフ
                    const start = Date.now();
                    while (Date.now() - start < delay) {
                        // 同期的に待機
                    }
                }
            }
            catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error : new Error(String(error))
                };
            }
        }
        // 最大リトライ回数を超えた場合
        return {
            success: false,
            error: new Error('Failed to increment usage after maximum retries')
        };
    };
    /**
     * 使用回数キャッシュを取得する
     */
    const getUsageCache = () => {
        return usageStorage.getCache();
    };
    /**
     * 使用回数を整理する
     */
    const pruneUsage = (validIds) => {
        try {
            const usageCache = getUsageCache();
            const next = {};
            let removedCount = 0;
            for (const [id, count] of Object.entries(usageCache)) {
                if (validIds.has(id)) {
                    next[id] = count;
                }
                else {
                    removedCount++;
                }
            }
            usageStorage.setCacheData(next);
            return { success: true, data: removedCount };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
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
            next.id = generateId();
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
    function generateId() {
        return `${ID_PREFIX}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

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
            favCache[origin] = {
                href,
                timestamp: Date.now()
            };
            // キャッシュサイズが制限を超えた場合はLRUで整理
            if (Object.keys(favCache).length > FAVICON_CACHE_CONFIG.MAX_SIZE) {
                pruneFavCache(favCache);
            }
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
        /**
         * faviconキャッシュを整理（LRUアルゴリズム）
         */
        const pruneFavCache = (cache) => {
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
                const toKeep = entries.slice(-500);
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
        const periodicCleanup = () => {
            const now = Date.now();
            if (now - lastCleanupTime > FAVICON_CACHE_CONFIG.CLEANUP_INTERVAL) {
                const favCache = getFavCache();
                pruneFavCache(favCache);
                window.GM_setValue?.('vm_sites_palette__favcache_v1', favCache);
                lastCleanupTime = now;
            }
        };
        // 定期的なクリーンアップを実行
        periodicCleanup();
        const cached = origin && getFavCache()[origin] ? getFavCache()[origin].href : null;
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
            this.maxCacheSize = 5;
            this.maxItemHeightsSize = 1000; // アイテム高さキャッシュの最大サイズ
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
            this.pruneItemHeightsCache(); // アイテム高さキャッシュを整理
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
            const length = this.items.length;
            this.itemPositions = new Array(length + 1);
            this.itemPositions[0] = 0;
            let currentY = 0;
            for (let i = 0; i < length; i++) {
                const item = this.items[i];
                const height = this.itemHeights.get(item.id) || this.estimatedItemHeight;
                currentY += height;
                this.itemPositions[i + 1] = currentY;
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
         * アイテム高さキャッシュを整理
         */
        pruneItemHeightsCache() {
            const currentIds = new Set(this.items.map(item => item.id));
            const toDelete = [];
            // 現在のアイテムに存在しないIDを収集
            for (const id of this.itemHeights.keys()) {
                if (!currentIds.has(id)) {
                    toDelete.push(id);
                }
            }
            // 不要なエントリを削除
            toDelete.forEach(id => this.itemHeights.delete(id));
            // キャッシュサイズが大きすぎる場合は古いものを削除
            if (this.itemHeights.size > this.maxItemHeightsSize) {
                const entries = Array.from(this.itemHeights.entries());
                const toKeep = entries.slice(-this.maxItemHeightsSize);
                this.itemHeights.clear();
                toKeep.forEach(([id, height]) => this.itemHeights.set(id, height));
            }
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
        /**
         * リソースをクリーンアップ
         */
        cleanup() {
            this.items = [];
            this.itemHeights.clear();
            this.itemPositions = [];
            this.visibleRangeCache.clear();
            this.totalHeight = 0;
            this.lastScrollTop = 0;
            this.scrollDirection = 'none';
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
      .panel { position: absolute; left: 50%; top: 16%; transform: translateX(-50%); width: min(720px, 92vw); max-height: 75vh; background: var(--panel-bg); color: var(--panel-text); border-radius: 14px; box-shadow: var(--panel-shadow); overflow: hidden; font-family: ui-sans-serif, -apple-system, system-ui, Segoe UI, Roboto, 'Helvetica Neue', Arial, 'Apple Color Emoji','Segoe UI Emoji'; border: 1px solid var(--border-color); opacity: 0; transition: opacity 200ms ease; display: flex; flex-direction: column; }
      .overlay.visible .panel { opacity: 1; }
      .input { width: 100%; box-sizing: border-box; padding: 0.875rem 1rem; font-size: 0.9375rem; background: var(--input-bg); color: var(--input-text); border: none; outline: none; }
      .input::placeholder { color: var(--input-placeholder); }
      .hint { padding: 0.375rem 0.75rem; font-size: 0.75rem; color: var(--muted); border-top: 1px solid var(--border-color); background: var(--hint-bg); display: flex; align-items: center; justify-content: space-between; }
      .link { cursor: pointer; color: var(--accent-color); }
      .list { max-height: min(60vh, 800px); overflow-y: auto; overflow-x: hidden; scrollbar-width: none; }
      .list::-webkit-scrollbar { width: 0; height: 0; }
      .item { display: grid; grid-template-columns: 1.75rem 1fr auto; align-items: center; gap: 0.625rem; padding: 0.625rem 0.875rem; cursor: pointer; transition: background 0.12s ease, transform 0.12s ease; }
      .item:nth-child(odd) { background: var(--item-bg-alt); }
      .item.active { background: var(--item-active); transform: translateX(0.125rem); }
      .item .name { font-size: 0.875rem; display: flex; align-items: center; gap: 0.375rem; }
      .item .name .command-badge { margin-left: 0; }
      .item .url { font-size: 0.75rem; color: var(--muted); }
      .item img.ico { width: 1.125rem; height: 1.125rem; border-radius: 0.25rem; object-fit: contain; background: #fff; border: 1px solid var(--border-color); }
      .item .ico-letter { width: 1.125rem; height: 1.125rem; border-radius: 0.25rem; border: 1px solid var(--border-color); background: var(--hint-bg); color: var(--panel-text); font-size: 0.625rem; font-weight: 600; display: flex; align-items: center; justify-content: center; text-transform: uppercase; }
      .item .tag-badges { display: flex; gap: 0.25rem; margin-top: 0.25rem; flex-wrap: wrap; }
      .tag { display: inline-flex; align-items: center; padding: 0.125rem 0.375rem; background: var(--tag-bg); color: var(--tag-text); font-size: 0.625rem; border-radius: 999px; }
      .tag::before { content: '#'; opacity: 0.7; margin-right: 0.125rem; }
      .tag-more { background: var(--muted); color: var(--panel-text); font-weight: 600; cursor: help; }
      .empty { padding: 1.125rem 0.875rem; color: var(--muted); font-size: 0.875rem; }
      .kbd { display: inline-block; padding: 0.125rem 0.375rem; border-radius: 0.375rem; background: var(--hint-bg); border: 1px solid var(--border-color); font-size: 0.75rem; color: var(--input-text); }
      .command-badge { margin-left: 0.375rem; padding: 0.125rem 0.375rem; border-radius: 0.375rem; background: var(--command-badge-bg); font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--panel-text); }
      .group-title { padding: 0.5rem 1rem 0.25rem; font-size: 0.6875rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
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
      .mgr, .set { position: absolute; left: 50%; top: 8%; transform: translateX(-50%); width: min(53.75rem, 94vw); max-height: 85vh; overflow-y: auto; background: var(--panel-bg); color: var(--panel-text); border-radius: 0.875rem; box-shadow: var(--panel-shadow); font-family: ui-sans-serif, -apple-system, system-ui, Segoe UI, Roboto, 'Helvetica Neue', Arial, 'Apple Color Emoji','Segoe UI Emoji'; border: 1px solid var(--border-color); }
      .mgr header, .set header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0.875rem; border-bottom: 1px solid var(--border-color); position: sticky; top: 0; background: var(--panel-bg); z-index: 1; }
      .mgr header h3, .set header h3 { margin: 0; font-size: 1rem; }
      .mgr-tabs { display: flex; gap: 0.5rem; margin-bottom: 0.625rem; }
      .tab-btn { flex: none; }
      .tab-btn.active { box-shadow: inset 0 0 0 2px rgba(255,255,255,0.12); }
      .mgr-tab.hidden { display: none; }
      .mgr .tbl { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
      .mgr .tbl th, .mgr .tbl td { border-bottom: 1px solid var(--border-color); padding: 0.5rem 0.625rem; vertical-align: top; }
      .mgr .tbl th { text-align: left; color: var(--muted); font-weight: 600; }
      .mgr input[type=text], .mgr textarea, .set input[type=text], .set textarea, .set select, .set input[type=color] { width: 100%; box-sizing: border-box; padding: 0.375rem 0.5rem; font-size: 0.875rem; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--input-text); border-radius: 0.5rem; }
      .mgr textarea { resize: vertical; min-height: 3.5rem; }
      .mgr .row-btns button { margin-right: 0.375rem; }
      .btn { padding: 0.375rem 0.625rem; border-radius: 0.5rem; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--panel-text); cursor: pointer; transition: transform 0.12s ease, box-shadow 0.12s ease; }
      .btn:hover { transform: translateY(-0.0625rem); box-shadow: 0 0.375rem 1rem rgba(0,0,0,0.18); }
      .btn.primary { background: var(--accent-color); border-color: var(--accent-color); color: #fff; }
      .btn.danger { background: #7f1d1d; border-color: #7f1d1d; color: #fee2e2; }
      .mgr footer, .set footer { display: flex; align-items: center; justify-content: space-between; padding: 0.625rem 0.875rem; position: sticky; bottom: 0; background: var(--panel-bg); }
      .muted { color: var(--muted); font-size: 0.75rem; }
      .drag { cursor: grab; }
      .form-row { display: grid; grid-template-columns: 12.5rem 1fr; gap: 0.75rem; align-items: center; padding: 0.625rem 0.875rem; }
      .inline { display: flex; gap: 0.75rem; align-items: center; }
      .hotkey-box { text-align: center; font-size: 0.875rem; padding: 0.5rem 0.625rem; border: 1px dashed var(--border-color); border-radius: 0.5rem; user-select: none; background: var(--input-bg); color: var(--input-text); }
      .badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.125rem 0.5rem; border-radius: 999px; font-size: 0.6875rem; background: var(--command-badge-bg); color: var(--panel-text); }
      .toast { position: fixed; inset: auto 0 1.5rem 0; display: none; justify-content: center; pointer-events: none; }
      .toast-message { background: var(--toast-bg); color: var(--toast-text); padding: 0.625rem 1rem; border-radius: 999px; box-shadow: 0 0.625rem 1.25rem rgba(0,0,0,0.2); animation: fade-slide 2.4s ease forwards; }
      @keyframes fade-slide {
        0% { opacity: 0; transform: translateY(1.125rem); }
        10% { opacity: 1; transform: translateY(0); }
        90% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(0.75rem); }
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
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-label', 'コマンドパレット');
            overlay.setAttribute('tabindex', '-1');
            return overlay;
        }
        /**
         * パネル要素を作成
         */
        createPanelElement() {
            const panel = document.createElement('div');
            panel.className = 'panel';
            panel.setAttribute('role', 'search');
            panel.setAttribute('aria-label', 'サイト検索');
            // 入力要素を作成
            this.dom.inputEl = document.createElement('input');
            this.dom.inputEl.className = 'input';
            this.dom.inputEl.type = 'text';
            this.dom.inputEl.setAttribute('role', 'combobox');
            this.dom.inputEl.setAttribute('aria-expanded', 'false');
            this.dom.inputEl.setAttribute('aria-autocomplete', 'list');
            this.dom.inputEl.setAttribute('aria-label', 'サイト名、URL、またはタグで検索');
            this.dom.inputEl.setAttribute('placeholder', 'サイト名、URL、またはタグで検索...');
            this.dom.inputEl.setAttribute('autocomplete', 'off');
            this.dom.inputEl.setAttribute('autocorrect', 'off');
            this.dom.inputEl.setAttribute('autocapitalize', 'off');
            this.dom.inputEl.setAttribute('spellcheck', 'false');
            // リスト要素を作成
            this.dom.listEl = document.createElement('div');
            this.dom.listEl.className = 'list';
            this.dom.listEl.setAttribute('role', 'listbox');
            this.dom.listEl.setAttribute('aria-label', '検索結果');
            // ヒント要素を作成
            this.dom.hintEl = document.createElement('div');
            this.dom.hintEl.className = 'hint';
            this.dom.hintEl.setAttribute('role', 'status');
            this.dom.hintEl.setAttribute('aria-live', 'polite');
            this.dom.hintLeftSpan = document.createElement('span');
            this.dom.hintLeftSpan.textContent = '↑↓: 移動 / Enter: 開く / Shift+Enter: 新規タブ / Tab: タグ選択 / Esc: 閉じる';
            this.dom.hintLeftSpan.setAttribute('aria-hidden', 'true');
            const rightSpan = document.createElement('span');
            rightSpan.innerHTML = '<span class="link" id="vm-open-manager" tabindex="0" role="button" aria-label="サイトマネージャを開く">サイトマネージャを開く</span> · <span class="link" id="vm-open-settings" tabindex="0" role="button" aria-label="設定を開く">設定</span> · ⌘P / Ctrl+P';
            rightSpan.setAttribute('aria-hidden', 'true');
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
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', 'false');
            item.setAttribute('tabindex', '-1');
            // アクセシビリティ用のラベル
            const ariaLabel = `${entry.name} - ${entry.url}${entry.tags.length > 0 ? `。タグ: ${entry.tags.join(', ')}` : ''}`;
            item.setAttribute('aria-label', ariaLabel);
            // ファビコンを作成
            const favicon = createFaviconEl(entry);
            favicon.setAttribute('aria-hidden', 'true');
            item.appendChild(favicon);
            // 名前とURLのコンテナを作成
            const info = document.createElement('div');
            info.className = 'info';
            const name = document.createElement('div');
            name.className = 'name';
            name.textContent = entry.name;
            name.setAttribute('aria-hidden', 'true');
            // コマンドバッジを追加
            if (entry.type === 'command') {
                const badge = document.createElement('span');
                badge.className = 'command-badge';
                badge.textContent = 'CMD';
                badge.setAttribute('aria-label', 'コマンド');
                name.appendChild(badge);
            }
            const url = document.createElement('div');
            url.className = 'url';
            url.textContent = entry.url;
            url.setAttribute('aria-hidden', 'true');
            info.appendChild(name);
            info.appendChild(url);
            // タグバッジを追加（表示数制限付き）
            if (entry.tags && entry.tags.length > 0) {
                const tagBadges = document.createElement('div');
                tagBadges.className = 'tag-badges';
                tagBadges.setAttribute('aria-hidden', 'true');
                const maxTags = 3;
                const visibleTags = entry.tags.slice(0, maxTags);
                const remainingCount = entry.tags.length - maxTags;
                // 表示するタグ
                visibleTags.forEach(tag => {
                    const tagEl = document.createElement('span');
                    tagEl.className = 'tag';
                    tagEl.textContent = tag;
                    tagEl.setAttribute('aria-label', `タグ: ${tag}`);
                    tagBadges.appendChild(tagEl);
                });
                // 残りのタグ数を表示
                if (remainingCount > 0) {
                    const moreTagsEl = document.createElement('span');
                    moreTagsEl.className = 'tag tag-more';
                    moreTagsEl.textContent = `+${remainingCount}`;
                    moreTagsEl.setAttribute('aria-label', `さらに${remainingCount}個のタグ`);
                    moreTagsEl.title = `残りのタグ: ${entry.tags.slice(maxTags).join(', ')}`;
                    tagBadges.appendChild(moreTagsEl);
                }
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
                    item.setAttribute('aria-selected', 'true');
                    item.setAttribute('tabindex', '0');
                }
                else {
                    item.classList.remove('active');
                    item.setAttribute('aria-selected', 'false');
                    item.setAttribute('tabindex', '-1');
                }
            });
            // 入力フィールドのaria-expandedを更新
            if (this.dom.inputEl) {
                this.dom.inputEl.setAttribute('aria-expanded', items.length > 0 ? 'true' : 'false');
            }
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
                empty.setAttribute('role', 'status');
                empty.setAttribute('aria-live', 'polite');
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
            // デバッグログ：パネル表示前の状態
            console.log('[Debug] showPalette called', {
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight,
                scrollTop: window.scrollY,
                scrollLeft: window.scrollX
            });
            this.dom.overlayEl.style.display = 'block';
            // パネルの位置とサイズを動的に調整
            this.adjustPanelPosition();
            // CSSベースの遷移を発火
            this.dom.overlayEl.classList.add('visible');
            // パネルの位置とサイズをデバッグ
            setTimeout(() => {
                if (this.dom.overlayEl && this.dom.overlayEl.querySelector('.panel')) {
                    const panel = this.dom.overlayEl.querySelector('.panel');
                    if (panel) {
                        const rect = panel.getBoundingClientRect();
                        console.log('[Debug] Panel dimensions and position after adjustment', {
                            width: rect.width,
                            height: rect.height,
                            top: rect.top,
                            left: rect.left,
                            bottom: rect.bottom,
                            right: rect.right,
                            windowHeight: window.innerHeight,
                            windowWidth: window.innerWidth
                        });
                    }
                }
            }, 100);
            setFocusTimeout(() => {
                if (this.dom.inputEl) {
                    this.dom.inputEl.focus();
                }
            });
        }
        /**
         * パネルの位置とサイズを動的に調整
         */
        adjustPanelPosition() {
            if (!this.dom.overlayEl || !this.dom.overlayEl.querySelector('.panel'))
                return;
            const panel = this.dom.overlayEl.querySelector('.panel');
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const scrollTop = window.scrollY;
            const scrollLeft = window.scrollX;
            // パネルの最大サイズを計算
            const maxWidth = Math.min(720, windowWidth * 0.92);
            const maxHeight = windowHeight * 0.8;
            // パネルの位置を計算（中央配置）
            let top = scrollTop + (windowHeight * 0.1); // 画面の10%の位置から開始
            let left = scrollLeft + (windowWidth - maxWidth) / 2;
            // パネルが画面外にはみ出す場合の調整
            if (top < scrollTop) {
                top = scrollTop + 10; // 上端から10pxの位置
            }
            if (left < scrollLeft) {
                left = scrollLeft + 10; // 左端から10pxの位置
            }
            // パネルのスタイルを更新
            panel.style.width = `${maxWidth}px`;
            panel.style.maxHeight = `${maxHeight}px`;
            panel.style.position = 'absolute';
            panel.style.left = `${left}px`;
            panel.style.top = `${top}px`;
            panel.style.transform = 'none'; // transformをリセット
            console.log('[Debug] Adjusted panel position', {
                maxWidth,
                maxHeight,
                top,
                left,
                windowWidth,
                windowHeight,
                scrollTop,
                scrollLeft
            });
        }
        /**
         * パレットを非表示
         */
        hidePalette() {
            if (!this.dom.overlayEl)
                return;
            console.log('[Debug] Hiding palette');
            this.dom.overlayEl.classList.remove('visible');
            // CSSのtransition時間を踏まえて余裕を持って隠す
            setTimeout(() => {
                if (this.dom.overlayEl && !this.state.isOpen) {
                    this.dom.overlayEl.style.display = 'none';
                    console.log('[Debug] Palette hidden, display set to none');
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
     * 正規表現をエスケープする
     */
    const escapeRegex = (str) => {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
        const base = new Array(entries.length);
        for (let i = 0; i < entries.length; i++) {
            base[i] = { entry: entries[i], score: 0 };
        }
        if (!query) {
            for (let i = 0; i < base.length; i++) {
                base[i].score = 0.0001 + getUsageBoost(base[i].entry, usageCache);
            }
        }
        else {
            const matcher = createFuzzyMatcher(query);
            for (let i = 0; i < base.length; i++) {
                const entry = base[i].entry;
                const score = Math.max(matcher(entry.name || ''), matcher(entry.url || '') - 4, matcher((entry.tags || []).join(' ')) - 2);
                base[i].score = score === -Infinity ? -Infinity : score + getUsageBoost(base[i].entry, usageCache);
            }
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
        constructor(state, dom, onExecuteEntry, onVirtualScroll, onEscape, onOpenManager, onOpenSettings, onBingSearch) {
            this.onBingSearch = () => { };
            this.onRenderList = () => { };
            this.onUpdateActive = () => { };
            this.state = state;
            this.dom = dom;
            this.onExecuteEntry = onExecuteEntry;
            this.onVirtualScroll = onVirtualScroll;
            this.onEscape = onEscape;
            this.onOpenManager = onOpenManager;
            this.onOpenSettings = onOpenSettings;
            this.onBingSearch = onBingSearch || (() => { });
            // デバウンスされたレンダリング関数を作成（統一された遅延時間）
            this.debouncedRenderList = debounce(() => this.performRenderList(), 100);
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
            // デバッグログ：入力要素の状態
            console.log('[Debug] Setting up input event listeners', {
                inputElement: this.dom.inputEl,
                inputType: this.dom.inputEl.type,
                inputId: this.dom.inputEl.id,
                inputClasses: this.dom.inputEl.className
            });
            // 入力イベント（統一されたデバウンス処理）
            this.dom.inputEl.addEventListener('input', (e) => {
                this.state.activeIndex = 0;
                this.renderList();
            });
            // キーダウンイベント
            EventListeners.addKeydown(this.dom.inputEl, (e) => {
                this.handleInputKeydown(e);
            });
            // 入力フィールドがフォーカスされたときの処理
            this.dom.inputEl.addEventListener('focus', (e) => {
                // フォーカス処理
            });
            // コンポジションイベント（日本語入力など）
            this.dom.inputEl.addEventListener('compositionstart', (e) => {
                // コンポジション開始時にフラグを設定
                this.dom.inputEl.isComposing = true;
            });
            this.dom.inputEl.addEventListener('compositionupdate', (e) => {
                // コンポジション更新中は検索を実行しない
                this.dom.inputEl.isComposing = true;
            });
            this.dom.inputEl.addEventListener('compositionend', (e) => {
                // コンポジション終了時にフラグを解除して検索を実行
                this.dom.inputEl.isComposing = false;
                this.state.activeIndex = 0;
                this.renderList();
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
            // 日本語入力中は一部のキーのみを処理
            const isComposing = this.dom.inputEl.isComposing || e.isComposing;
            // Meta+EnterでBing検索（日本語入力中も有効）
            if (e.key === 'Enter' && e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
                this.handleBingSearch();
                return;
            }
            // 日本語入力中はEnterキーとEscキーのみを処理
            if (isComposing) {
                if (e.key === 'Enter') {
                    // 日本語入力中のEnterは変換確定なので、デフォルト動作を許可
                    return;
                }
                if (e.key === 'Escape') {
                    // 日本語入力中のEscapeは変換キャンセル
                    e.preventDefault();
                    this.onEscape();
                    return;
                }
                // その他のキーはデフォルト動作を許可
                return;
            }
            // 通常時のキー処理
            switch (e.key) {
                case 'ArrowDown':
                    if (this.state.currentItems && this.state.currentItems.length > 0) {
                        e.preventDefault();
                        this.state.activeIndex = Math.min(this.state.activeIndex + 1, this.state.currentItems.length - 1);
                        this.updateActive();
                    }
                    break;
                case 'ArrowUp':
                    if (this.state.currentItems && this.state.currentItems.length > 0) {
                        e.preventDefault();
                        this.state.activeIndex = Math.max(this.state.activeIndex - 1, 0);
                        this.updateActive();
                    }
                    break;
                case 'Enter':
                    if (this.state.currentItems && this.state.currentItems.length > 0) {
                        e.preventDefault();
                        const item = this.state.currentItems[this.state.activeIndex];
                        if (item) {
                            this.openItem(item, e.shiftKey);
                        }
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.onEscape();
                    break;
                case 'Tab':
                    e.preventDefault();
                    // タグ選択機能はオートコンプリート機能に統合されたため、ここでは何もしない
                    break;
                case 'Home':
                    e.preventDefault();
                    if (this.state.currentItems && this.state.currentItems.length > 0) {
                        this.state.activeIndex = 0;
                        this.updateActive();
                    }
                    break;
                case 'End':
                    e.preventDefault();
                    if (this.state.currentItems && this.state.currentItems.length > 0) {
                        this.state.activeIndex = this.state.currentItems.length - 1;
                        this.updateActive();
                    }
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
         * Bing検索コールバックを設定
         */
        setBingSearchCallback(callback) {
            this.onBingSearch = callback;
        }
        /**
         * Bing検索を処理
         */
        handleBingSearch() {
            this.onBingSearch();
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
            this.eventHandler = new PaletteEventHandler(state, dom, onExecuteEntry, (position) => this.handleVirtualScroll(position), () => this.hidePalette(), () => this.openManager(), () => this.openSettings(), () => this.handleBingSearch());
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
            this.eventHandler.setBingSearchCallback(() => this.handleBingSearch());
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
         * Bing検索を処理
         */
        handleBingSearch() {
            // このメソッドはmain.tsのrunBingSearchを呼び出す必要がある
            // しかし、直接参照できないので、代わりにカスタムイベントを発行
            const event = new CustomEvent('palette-bing-search', {
                bubbles: true,
                detail: { query: this.ui.getInputValue() }
            });
            this.dom.inputEl?.dispatchEvent(event);
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
     * セキュリティ関連のユーティリティ関数
     */
    /**
     * 正規表現の複雑さを検証し、安全な正規表現に変換する
     * @param pattern 検証する正規表現パターン
     * @param maxLength パターンの最大長（デフォルト100文字）
     * @returns 安全な正規表現パターン、または安全でない場合はnull
     */
    const sanitizeRegex = (pattern, maxLength = 100) => {
        // パターン長のチェック
        if (!pattern || pattern.length > maxLength) {
            return null;
        }
        // 危険な正規表現パターンのブラックリスト
        const dangerousPatterns = [
            // 原子的なグループのネスト
            /\(.*\(\(.*\)\).*\)/,
            // 再帰的なパターン
            /\(\?\((.*)\)\)/,
            // 多数の量指定子の連続
            /(\*|\+|\?|\{[\d,]+\}){5,}/,
            // 複雑な先読み/後読み
            /(\(\?=.+\)|\(\?!.+\)|\(\?<=.+\)|\(\?<!.+\)){2,}/,
            // バックトラッキングを多用するパターン
            /(.+\*|.+[^\*]\+|.+[^\+]\?){2,}/
        ];
        // 危険なパターンをチェック
        for (const dangerous of dangerousPatterns) {
            if (dangerous.test(pattern)) {
                return null;
            }
        }
        // 特殊文字をエスケープして安全なパターンを作成
        const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return escapedPattern;
    };
    /**
     * URLの妥当性を検証する
     * @param url 検証するURL
     * @returns 有効なURLの場合はtrue、無効な場合はfalse
     */
    const isValidUrl = (url) => {
        try {
            // URLの構文を検証
            const parsedUrl = new URL(url);
            // 許可されたプロトコルのみを許可
            const allowedProtocols = ['http:', 'https:', 'ftp:', 'ftps:', 'mailto:', 'tel:'];
            if (!allowedProtocols.includes(parsedUrl.protocol)) {
                return false;
            }
            // javascript:プロトコルを明示的に拒否
            if (parsedUrl.protocol === 'javascript:') {
                return false;
            }
            return true;
        }
        catch {
            // URLの構文が無効な場合
            return false;
        }
    };
    /**
     * 入力文字列の長さと内容を検証する
     * @param input 検証する入力文字列
     * @param maxLength 最大長（デフォルト1000文字）
     * @returns 有効な入力の場合はtrue、無効な場合はfalse
     */
    const validateInput = (input, maxLength = 1000) => {
        if (!input || typeof input !== 'string') {
            return false;
        }
        if (input.length > maxLength) {
            return false;
        }
        // 制御文字（改行、タブを除く）をチェック
        const controlCharsRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
        if (controlCharsRegex.test(input)) {
            return false;
        }
        return true;
    };
    /**
     * 安全な正規表現を作成する
     * @param pattern 元のパターン文字列
     * @param flags 正規表現フラグ
     * @param maxLength パターンの最大長
     * @returns 安全な正規表現オブジェクト、または安全でない場合はnull
     */
    const createSafeRegex = (pattern, flags = 'i', maxLength = 100) => {
        const sanitizedPattern = sanitizeRegex(pattern, maxLength);
        if (!sanitizedPattern) {
            return null;
        }
        try {
            return new RegExp(sanitizedPattern, flags);
        }
        catch {
            return null;
        }
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
            // 入力値の検証
            if (!validateInput(tagName, 50)) { // タグ名は最大50文字
                console.warn('Invalid tag name:', tagName);
                return;
            }
            // タグ名のサニタイズ
            const sanitizedTagName = tagName.trim()
                .replace(/[<>]/g, '') // HTMLタグ文字を削除
                .replace(/[\x00-\x1F\x7F]/g, '') // 制御文字を削除
                .replace(/\s+/g, ' '); // 連続する空白を単一の空白に
            if (!sanitizedTagName) {
                console.warn('Tag name is empty after sanitization');
                return;
            }
            const currentValue = this.dom.inputEl.value;
            const hashIndex = currentValue.indexOf('#');
            if (hashIndex >= 0) {
                const beforeHash = currentValue.slice(0, hashIndex);
                this.dom.inputEl.value = beforeHash + '#' + sanitizedTagName;
            }
            else {
                this.dom.inputEl.value = '#' + sanitizedTagName;
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
                if (u && isValidUrl(u)) {
                    window.open(u.includes('%s') ? u.replace(/%s/g, encodeURIComponent('test')) : u, '_blank');
                }
                else if (u) {
                    showToast('無効なURLです');
                }
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
                const nameInput = tr.querySelector('input[data-field="name"]');
                const urlInput = tr.querySelector('input[data-field="url"]');
                const tagsInput = tr.querySelector('input[data-field="tags"]');
                const name = nameInput?.value.trim() || '';
                const url = urlInput?.value.trim() || '';
                const tags = tagsInput?.value.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean) || [];
                // 入力値の検証
                if (!name || !url)
                    return null;
                // 名前の検証
                if (!validateInput(name, 100)) { // 名前は最大100文字
                    console.warn('Invalid site name:', name);
                    return null;
                }
                // URLの検証
                if (!isValidUrl(url)) {
                    console.warn('Invalid site URL:', url);
                    return null;
                }
                // タグの検証
                const validTags = tags.filter(tag => validateInput(tag, 50)).slice(0, 10); // タグは最大10個、各50文字
                const existing = tr.dataset.entryId && previousSites.find(s => s.id === tr.dataset.entryId);
                const id = existing ? existing.id : (tr.dataset.entryId || `site-${Math.random().toString(36).slice(2, 10)}`);
                return { id, type: 'site', name, url, tags: validTags };
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
            // インポートするデータのサイズを制限（最大1MB）
            if (jsonText.length > 1024 * 1024) {
                showToast('ファイルサイズが大きすぎます');
                return;
            }
            try {
                const arr = JSON.parse(jsonText);
                if (!Array.isArray(arr))
                    throw new Error('not array');
                // インポートデータの検証とフィルタリング
                const validSites = arr.filter((site) => {
                    // 基本的な構造の検証
                    if (!site || typeof site !== 'object')
                        return false;
                    if (site.type !== 'site')
                        return false;
                    if (!site.name || typeof site.name !== 'string')
                        return false;
                    if (!site.url || typeof site.url !== 'string')
                        return false;
                    // 入力値の検証
                    if (!validateInput(site.name, 100))
                        return false;
                    if (!isValidUrl(site.url))
                        return false;
                    // タグの検証
                    if (site.tags) {
                        if (!Array.isArray(site.tags))
                            return false;
                        site.tags = site.tags.filter((tag) => typeof tag === 'string' && validateInput(tag, 50)).slice(0, 10);
                    }
                    else {
                        site.tags = [];
                    }
                    return true;
                });
                if (validSites.length === 0) {
                    showToast('有効なサイトデータがありません');
                    return;
                }
                if (validSites.length < arr.length) {
                    showToast(`${arr.length - validSites.length}件の無効なデータを除外しました`);
                }
                setSites(validSites);
                pruneUsage(new Set(getSites().map(e => e.id)));
                this.renderManager();
                showToast(`${validSites.length}件のサイトを読み込みました`);
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

    // 定数
    const BING_SEARCH_URL$1 = 'https://www.bing.com/search?q=';
    const SEARCH_PLACEHOLDER_TEMPLATE = ' に検索キーワードを入力…';
    const DEFAULT_MESSAGES = {
        EMPTY_QUERY: '検索キーワードを入力してください',
        URL_COPIED: 'URLをコピーしました',
        PAGE_ADDED: '現在のページを登録しました'
    };
    /**
     * パレットのコアロジックを管理するクラス
     */
    class PaletteCore {
        constructor(inputEl) {
            this.inputEl = null;
            this.settingsCache = null;
            this.lastSettingsUpdate = 0;
            this.SETTINGS_CACHE_TTL = 1000; // 1秒キャッシュ
            /**
             * 設定をキャッシュから取得
             */
            this.getCachedSettings = () => {
                const now = Date.now();
                if (this.settingsCache && (now - this.lastSettingsUpdate) < this.SETTINGS_CACHE_TTL) {
                    return this.settingsCache;
                }
                this.settingsCache = getSettings();
                this.lastSettingsUpdate = now;
                return this.settingsCache;
            };
            /**
             * 入力フィールドのプレースホルダーを更新
             */
            this.updateInputPlaceholder = (entryName) => {
                if (this.inputEl) {
                    this.inputEl.value = '';
                    this.inputEl.placeholder = entryName + SEARCH_PLACEHOLDER_TEMPLATE;
                }
            };
            /**
             * 新しいタブでURLを開くかどうかを判定
             */
            this.shouldOpenNewTab = (mode, settings) => {
                switch (mode) {
                    case 'newtab':
                        return true;
                    case 'same':
                        return false;
                    case 'command':
                        return true;
                    case 'auto':
                    default:
                        return settings.enterOpens === 'newtab';
                }
            };
            /**
             * 新しいタブでURLを開く
             */
            this.openUrlInNewTab = (url) => {
                try {
                    GM_openInTab(url, { active: true, insert: true });
                }
                catch {
                    // ポップアップブロック対策
                    const newWindow = window.open(url, '_blank');
                    if (!newWindow) {
                        showToast('ポップアップがブロックされました。ブラウザの設定を確認してください。');
                    }
                }
            };
            /**
             * 同じタブでURLを開く
             */
            this.openUrlInSameTab = (url) => {
                try {
                    location.assign(url);
                }
                catch {
                    location.href = url;
                }
            };
            /**
             * 現在のページ情報を取得
             */
            this.getCurrentPageInfo = () => {
                return {
                    title: document.title || location.hostname,
                    url: location.href
                };
            };
            /**
             * 設定キャッシュをクリア
             */
            this.clearSettingsCache = () => {
                this.settingsCache = null;
                this.lastSettingsUpdate = 0;
            };
            /**
             * 入力値を取得
             */
            this.getInputValue = () => {
                return this.inputEl?.value.trim() || '';
            };
            /**
             * 入力値を設定
             */
            this.setInputValue = (value) => {
                if (this.inputEl) {
                    this.inputEl.value = value;
                }
            };
            /**
             * 入力フィールドにフォーカス
             */
            this.focusInput = () => {
                this.inputEl?.focus();
            };
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
            if (!entry) {
                return { success: false, message: '無効なエントリです' };
            }
            const settings = this.getCachedSettings();
            const preferNew = settings.enterOpens === 'newtab';
            const openNew = shiftPressed ? !preferNew : preferNew;
            // 検索エントリの場合はクエリを確認
            if (entry.url && entry.url.includes('%s')) {
                const searchQuery = query !== undefined ? query : this.inputEl?.value.trim() || '';
                if (!searchQuery) {
                    this.updateInputPlaceholder(entry.name);
                    this.inputEl?.focus();
                    return {
                        success: false,
                        requiresInput: true,
                        message: DEFAULT_MESSAGES.EMPTY_QUERY
                    };
                }
                // 検索クエリの検証
                if (!validateInput(searchQuery, 200)) { // 検索クエリは最大200文字
                    return {
                        success: false,
                        message: '検索キーワードが無効です'
                    };
                }
                const targetUrl = entry.url.replace(/%s/g, encodeURIComponent(searchQuery));
                // 生成されたURLの妥当性を検証
                if (!isValidUrl(targetUrl)) {
                    return {
                        success: false,
                        message: '無効なURLが生成されました'
                    };
                }
                incrementUsage(entry.id);
                this.openUrlWithPreference(targetUrl, openNew ? 'newtab' : 'same');
                return { success: true };
            }
            // 通常のURLエントリ
            if (!isValidUrl(entry.url)) {
                return {
                    success: false,
                    message: '無効なURLです'
                };
            }
            incrementUsage(entry.id);
            this.openUrlWithPreference(entry.url, openNew ? 'newtab' : 'same');
            return { success: true };
        }
        /**
         * Bing検索を実行する
         */
        runBingSearch(shiftPressed, entry, query) {
            const keywords = (query || this.inputEl?.value.trim() || '').trim();
            if (!keywords) {
                return {
                    success: false,
                    message: DEFAULT_MESSAGES.EMPTY_QUERY
                };
            }
            // 検索キーワードの検証
            if (!validateInput(keywords, 200)) { // 検索キーワードは最大200文字
                return {
                    success: false,
                    message: '検索キーワードが無効です'
                };
            }
            const mode = shiftPressed ? 'newtab' : 'auto';
            const searchUrl = `${BING_SEARCH_URL$1}${encodeURIComponent(keywords)}`;
            // エントリが指定されている場合は使用回数を増やす
            if (entry) {
                incrementUsage(entry.id);
            }
            this.openUrlWithPreference(searchUrl, mode);
            return { success: true };
        }
        /**
         * 入力からBing検索を実行する
         */
        runBingSearchFromInput() {
            const query = this.inputEl?.value.trim() || '';
            if (!query) {
                return {
                    success: false,
                    message: DEFAULT_MESSAGES.EMPTY_QUERY
                };
            }
            // 検索クエリの検証
            if (!validateInput(query, 200)) { // 検索クエリは最大200文字
                return {
                    success: false,
                    message: '検索キーワードが無効です'
                };
            }
            const searchUrl = `${BING_SEARCH_URL$1}${encodeURIComponent(query)}`;
            this.openUrlWithPreference(searchUrl);
            return { success: true };
        }
        /**
         * 設定に応じてURLを開く
         */
        openUrlWithPreference(url, mode = 'auto') {
            const settings = this.getCachedSettings();
            const openNew = this.shouldOpenNewTab(mode, settings);
            if (openNew) {
                this.openUrlInNewTab(url);
            }
            else {
                this.openUrlInSameTab(url);
            }
        }
        /**
         * 現在のページを追加する
         */
        runAddCurrent() {
            const pageInfo = this.getCurrentPageInfo();
            // この処理はストレージモジュールに依存するため、ここでは実装しない
            // 呼び出し元で適切に処理する
            showToast(DEFAULT_MESSAGES.PAGE_ADDED);
            return {
                success: true,
                data: pageInfo
            };
        }
        /**
         * URLをコピーする（非同期対応）
         */
        async copyUrl() {
            const url = location.href;
            try {
                GM_setClipboard(url);
                showToast(DEFAULT_MESSAGES.URL_COPIED);
                return { success: true };
            }
            catch {
                // フォールバックとしてClipboard APIを使用
                if (navigator.clipboard) {
                    try {
                        await navigator.clipboard.writeText(url);
                        showToast(DEFAULT_MESSAGES.URL_COPIED);
                        return { success: true };
                    }
                    catch (clipboardError) {
                        return { success: false, message: 'URLのコピーに失敗しました' };
                    }
                }
                return { success: false, message: 'クリップボードAPIが利用できません' };
            }
        }
    }

    // 修飾キーの定数
    const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Alt', 'Shift']);
    const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA']);
    const PALETTE_SELECTORS = ['#vm-cmd-palette-host', '.overlay', '.panel'];
    const ALLOWED_KEYS = new Set([
        'Escape', 'Enter', 'Tab', 'ArrowUp', 'ArrowDown',
        'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete',
        'Home', 'End', 'PageUp', 'PageDown', ' '
    ]);
    // キャッシュ用変数
    let cachedSettings = null;
    let lastSettingsUpdate = 0;
    const SETTINGS_CACHE_TTL = 5000; // 5秒キャッシュ
    // パレットが開いているかどうかを追跡する変数
    let isPaletteOpen = false;
    // グローバルホットキーコールバック
    let globalHotkeyCallback = null;
    // デバッグモードフラグ（本番環境ではfalseに設定）
    const DEBUG_MODE = false;
    /**
     * デバッグログを出力（デバッグモード時のみ）
     */
    const debugLog = (message, data) => {
    };
    /**
     * 設定をキャッシュから取得
     */
    const getCachedSettings = () => {
        const now = Date.now();
        if (cachedSettings && (now - lastSettingsUpdate) < SETTINGS_CACHE_TTL) {
            return cachedSettings;
        }
        cachedSettings = getSettings();
        cachedSettings.blocklist ?
            cachedSettings.blocklist.split(',').map(s => s.trim()).filter(Boolean) :
            [];
        cachedSettings.autoOpenUrls || [];
        lastSettingsUpdate = now;
        return cachedSettings;
    };
    /**
     * ホットキー判定関数
     */
    const matchHotkey = (e, signature) => {
        if (!signature)
            return false;
        const parts = signature.split('+');
        const hasMeta = parts.includes('Meta');
        const hasCtrl = parts.includes('Control');
        const hasAlt = parts.includes('Alt');
        const hasShift = parts.includes('Shift');
        const keyPart = parts.find(p => !MODIFIER_KEYS.has(p));
        // メインキーが修飾キーでないことを確認
        if (keyPart && MODIFIER_KEYS.has(keyPart)) {
            return false;
        }
        return (e.metaKey === hasMeta &&
            e.ctrlKey === hasCtrl &&
            e.altKey === hasAlt &&
            e.shiftKey === hasShift &&
            (keyPart ? e.key === keyPart || e.code === keyPart : true));
    };
    /**
     * ブロックサイト判定関数
     */
    const isBlocked = () => {
        const settings = getCachedSettings();
        if (!settings.blocklist)
            return false;
        const blocklist = settings.blocklist.split(',').map(s => s.trim()).filter(Boolean);
        if (!blocklist.length)
            return false;
        const hostname = window.location.hostname;
        const href = window.location.href;
        return blocklist.some((pattern) => {
            const safeRegex = createSafeRegex(pattern, 'i');
            if (!safeRegex) {
                return false;
            }
            return safeRegex.test(hostname) || safeRegex.test(href);
        });
    };
    /**
     * 自動オープンをチェック
     */
    const shouldAutoOpen = () => {
        const settings = getCachedSettings();
        if (!settings.autoOpenUrls || !settings.autoOpenUrls.length)
            return false;
        const currentUrl = window.location.href;
        return settings.autoOpenUrls.some((url) => {
            const safeRegex = createSafeRegex(url, 'i');
            if (!safeRegex) {
                return false;
            }
            return safeRegex.test(currentUrl);
        });
    };
    /**
     * パレットの開閉状態を設定する
     */
    const setPaletteOpenState = (isOpen) => {
        isPaletteOpen = isOpen;
    };
    /**
     * グローバルホットキーコールバックを設定する
     */
    const setGlobalHotkeyCallback = (callback) => {
        globalHotkeyCallback = callback;
    };
    /**
     * パレットが表示されているかチェック
     */
    const isPaletteVisible = () => {
        const overlayVisible = document.querySelector('.overlay');
        return !!(overlayVisible &&
            overlayVisible.classList.contains('visible') &&
            overlayVisible.style.display !== 'none');
    };
    /**
     * イベントがパレット内から発生したかチェック
     */
    const isEventFromPalette = (target) => {
        if (!target)
            return false;
        return PALETTE_SELECTORS.some(selector => target.closest(selector));
    };
    /**
     * 入力フィールドかチェック
     */
    const isInputField = (target) => {
        if (!target)
            return false;
        return INPUT_TAGS.has(target.tagName) || target.contentEditable === 'true';
    };
    /**
     * 許可されたキーかチェック
     */
    const isAllowedKey = (e) => {
        // 修飾キーのみの場合は許可
        if (MODIFIER_KEYS.has(e.key)) {
            return true;
        }
        // Meta+Enter（Cmd+Enter）は常に許可（Web検索用）
        if (e.key === 'Enter' && e.metaKey) {
            return true;
        }
        // 許可されたキーリストに含まれるかチェック
        return ALLOWED_KEYS.has(e.key);
    };
    /**
     * パレットが開いている場合のキーボードイベント処理
     */
    const handlePaletteOpenKeydown = (e) => {
        const target = e.target;
        const isInPalette = isEventFromPalette(target);
        // パネル内からのイベントでない場合は無視
        if (!isInPalette) {
            // Escキーは常に許可（パネルを閉じるため）
            if (e.key === 'Escape') {
                return false; // Escキーは許可
            }
            debugLog('Blocking key outside palette:', e.key);
            e.preventDefault();
            e.stopPropagation();
            return true; // イベントを処理した
        }
        // パネル内の入力フィールドの場合は、ほぼすべてのキーを許可
        if (isInputField(target)) {
            debugLog('Allowing key in input field:', e.key);
            return false; // イベントを処理しない
        }
        // 入力フィールド以外のパネル内要素では、特定のキーのみ許可
        if (!isAllowedKey(e)) {
            debugLog('Blocking key in palette:', e.key);
            e.preventDefault();
            e.stopPropagation();
            return true; // イベントを処理した
        }
        debugLog('Allowing key in palette:', e.key);
        return false; // イベントを処理しない
    };
    /**
     * パレットが閉じている場合のキーボードイベント処理
     */
    const handlePaletteClosedKeydown = (e) => {
        const target = e.target;
        const tag = target?.tagName || '';
        const editable = INPUT_TAGS.has(tag) || (target && target.isContentEditable);
        debugLog('Palette is closed, checking for hotkey:', e.key);
        if (editable) {
            // 編集中の要素でもホットキーはチェックするが、それ以外はすべて許可
            const settings = getCachedSettings();
            if (matchHotkey(e, settings.hotkeyPrimary) || matchHotkey(e, settings.hotkeySecondary)) {
                e.preventDefault();
                e.stopPropagation();
                // パレットを開く処理を実行
                if (globalHotkeyCallback) {
                    globalHotkeyCallback();
                }
                return true; // イベントを処理した
            }
            return false; // ホットキー以外はすべて許可
        }
        // 編集中でない要素の場合のみ、ホットキーをチェック
        const settings = getCachedSettings();
        if (matchHotkey(e, settings.hotkeyPrimary) || matchHotkey(e, settings.hotkeySecondary)) {
            e.preventDefault();
            e.stopPropagation();
            // パレットを開く処理を実行
            if (globalHotkeyCallback) {
                globalHotkeyCallback();
            }
            return true; // イベントを処理した
        }
        return false; // ホットキー以外はすべて許可
    };
    /**
     * グローバルホットキーを設定する
     */
    const setupGlobalHotkey = (settings) => {
        // 既存のリスナーを削除
        window.removeEventListener('keydown', onGlobalKeydown, true);
        // 新しいリスナーを追加（バブリングフェーズでキャプチャ）
        window.addEventListener('keydown', onGlobalKeydown, false);
        // 設定キャッシュを更新
        cachedSettings = settings;
        settings.blocklist ?
            settings.blocklist.split(',').map(s => s.trim()).filter(Boolean) :
            [];
        settings.autoOpenUrls || [];
        lastSettingsUpdate = Date.now();
    };
    /**
     * グローバルキーボードイベントハンドラ
     */
    const onGlobalKeydown = (e) => {
        try {
            // ブロックサイトでは処理しない
            if (isBlocked())
                return;
            // パネルが実際に表示されているかをチェック
            const isActuallyVisible = isPaletteVisible();
            if (DEBUG_MODE) ;
            // パネルが表示されている場合と閉じている場合で処理を分岐
            if (isActuallyVisible) {
                handlePaletteOpenKeydown(e);
            }
            else {
                handlePaletteClosedKeydown(e);
            }
        }
        catch (error) {
            console.error('[CommandPalette] Global hotkey error:', error);
        }
    };

    // キーの定数
    const NAVIGATION_KEYS = new Set(['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab']);
    const BING_SEARCH_URL = 'https://www.bing.com/search?q=';
    /**
     * キーボードイベント処理を管理するクラス
     */
    class KeyboardHandler {
        constructor(callbacks) {
            /**
             * 入力キーボードイベントを処理する
             */
            this.onInputKey = (e, currentItems, activeIndex, inputEl, isAutocompleteVisible) => {
                // 日本語入力中は処理しない
                if (e.isComposing || e.keyCode === 229) {
                    return { activeIndex, handled: false };
                }
                // オートコンプリート表示中の処理
                if (isAutocompleteVisible) {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        this.callbacks.onHideAutocomplete();
                        return { activeIndex, handled: true };
                    }
                    return { activeIndex, handled: false };
                }
                // Meta+EnterでBing検索
                if (e.key === 'Enter' && e.metaKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.callbacks.onBingSearch();
                    return { activeIndex, handled: true };
                }
                // Escapeでパレットを閉じる
                if (e.key === 'Escape') {
                    this.callbacks.onPaletteHide();
                    return { activeIndex, handled: true };
                }
                // Tabでタグ補完
                if (e.key === 'Tab' && !e.shiftKey && inputEl.value.trim() === '') {
                    e.preventDefault();
                    this.handleTabCompletion(inputEl);
                    return { activeIndex, handled: true };
                }
                // アイテムがない場合の処理
                if (!currentItems.length) {
                    return this.handleEmptyItems(e, inputEl, activeIndex);
                }
                // ナビゲーションキーの処理
                return this.handleNavigationKeys(e, currentItems, activeIndex);
            };
            /**
             * Tabキーでのタグ補完を処理
             */
            this.handleTabCompletion = (inputEl) => {
                const allTags = getAllTags();
                if (allTags.length > 0) {
                    inputEl.value = '#' + allTags[0] + ' ';
                    this.callbacks.onRenderList();
                    this.callbacks.onShowAutocomplete(allTags[0]);
                }
            };
            /**
             * アイテムがない場合のキーボード処理
             */
            this.handleEmptyItems = (e, inputEl, activeIndex) => {
                if (e.key === 'Enter') {
                    // Meta+Enterはここでは処理しない（すでに上位で処理済み）
                    if (e.metaKey) {
                        return { activeIndex, handled: false };
                    }
                    e.preventDefault();
                    const query = inputEl.value.trim();
                    if (!query) {
                        showToast('検索キーワードを入力してください');
                        return { activeIndex, handled: true };
                    }
                    // Bing検索を実行
                    window.open(`${BING_SEARCH_URL}${encodeURIComponent(query)}`, '_blank');
                    return { activeIndex, handled: true };
                }
                return { activeIndex, handled: false };
            };
            /**
             * ナビゲーションキーの処理
             */
            this.handleNavigationKeys = (e, currentItems, activeIndex) => {
                let newActiveIndex = activeIndex;
                let handled = false;
                switch (e.key) {
                    case 'ArrowDown':
                        e.preventDefault();
                        newActiveIndex = (activeIndex + 1) % currentItems.length;
                        this.callbacks.onUpdateActive();
                        handled = true;
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        newActiveIndex = (activeIndex - 1 + currentItems.length) % currentItems.length;
                        this.callbacks.onUpdateActive();
                        handled = true;
                        break;
                    case 'Enter':
                        // Meta+Enterはここでは処理しない（すでに上位で処理済み）
                        if (e.metaKey) {
                            return { activeIndex, handled: false };
                        }
                        e.preventDefault();
                        const item = currentItems[activeIndex];
                        this.callbacks.onExecuteEntry(item, e.shiftKey);
                        handled = true;
                        break;
                }
                return { activeIndex: newActiveIndex, handled };
            };
            /**
             * グローバルホットキーハンドラを更新する
             */
            this.updateHotkeyHandler = (e, settings, onOpenPalette) => {
                if (matchHotkey(e, settings.hotkeyPrimary) || matchHotkey(e, settings.hotkeySecondary)) {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenPalette();
                    return true;
                }
                return false;
            };
            /**
             * オートコンプリートキーボード処理
             */
            this.handleAutocompleteKeydown = (e, autocompleteItems, autocompleteIndex, isVisible) => {
                if (!isVisible || !autocompleteItems.length) {
                    return { newIndex: autocompleteIndex, shouldHide: false, handled: false };
                }
                let newIndex = autocompleteIndex;
                let shouldHide = false;
                let handled = false;
                switch (e.key) {
                    case 'ArrowDown':
                        e.preventDefault();
                        newIndex = (autocompleteIndex + 1) % autocompleteItems.length;
                        handled = true;
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        newIndex = (autocompleteIndex - 1 + autocompleteItems.length) % autocompleteItems.length;
                        handled = true;
                        break;
                    case 'Enter':
                        if (autocompleteIndex >= 0) {
                            e.preventDefault();
                            // アイテム選択処理は呼び出し元に委ねる
                            handled = true;
                        }
                        break;
                    case 'Escape':
                        shouldHide = true;
                        handled = true;
                        break;
                }
                return { newIndex, shouldHide, handled };
            };
            this.callbacks = callbacks;
        }
    }
    /**
     * キーがナビゲーションキーかチェック
     */
    KeyboardHandler.isNavigationKey = (key) => {
        return NAVIGATION_KEYS.has(key);
    };
    /**
     * キーが修飾キーかチェック
     */
    KeyboardHandler.isModifierKey = (e) => {
        return e.ctrlKey || e.metaKey || e.altKey || e.shiftKey;
    };

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
     * 統一されたエラーハンドリングシステム
     */
    // エラーの種類を定義
    var ErrorType;
    (function (ErrorType) {
        ErrorType["VALIDATION"] = "validation";
        ErrorType["STORAGE"] = "storage";
        ErrorType["NETWORK"] = "network";
        ErrorType["PERMISSION"] = "permission";
        ErrorType["UNKNOWN"] = "unknown";
    })(ErrorType || (ErrorType = {}));
    // エラーレベルを定義
    var ErrorLevel;
    (function (ErrorLevel) {
        ErrorLevel["LOW"] = "low";
        ErrorLevel["MEDIUM"] = "medium";
        ErrorLevel["HIGH"] = "high";
        ErrorLevel["CRITICAL"] = "critical";
    })(ErrorLevel || (ErrorLevel = {}));
    /**
     * カスタムエラークラス
     */
    class AppError extends Error {
        constructor(message, type = ErrorType.UNKNOWN, level = ErrorLevel.MEDIUM, code, details, context) {
            super(message);
            this.name = 'AppError';
            this.type = type;
            this.level = level;
            this.code = code;
            this.details = details;
            this.context = context;
            this.timestamp = Date.now();
            // スタックトレースを維持
            if (Error.captureStackTrace) {
                Error.captureStackTrace(this, AppError);
            }
        }
        /**
         * エラー情報をオブジェクトに変換
         */
        toErrorInfo() {
            return {
                type: this.type,
                level: this.level,
                message: this.message,
                code: this.code,
                details: this.details,
                timestamp: this.timestamp,
                stack: this.stack,
                context: this.context
            };
        }
        /**
         * ユーザー向けのメッセージを取得
         */
        getUserMessage() {
            switch (this.type) {
                case ErrorType.VALIDATION:
                    return '入力内容が無効です。確認して再度お試しください。';
                case ErrorType.STORAGE:
                    return 'データの保存に失敗しました。ブラウザのストレージ容量を確認してください。';
                case ErrorType.NETWORK:
                    return 'ネットワーク接続に問題があります。接続状態を確認してください。';
                case ErrorType.PERMISSION:
                    return '必要な権限がありません。ブラウザの設定を確認してください。';
                default:
                    return 'エラーが発生しました。再度お試しください。';
            }
        }
    }
    /**
     * エラーハンドリングマネージャー
     */
    class ErrorHandlerManager {
        constructor() {
            this.handlers = [];
            this.errorHistory = [];
            this.maxHistorySize = 100;
        }
        /**
         * シングルトンインスタンスを取得
         */
        static getInstance() {
            if (!ErrorHandlerManager.instance) {
                ErrorHandlerManager.instance = new ErrorHandlerManager();
            }
            return ErrorHandlerManager.instance;
        }
        /**
         * エラーハンドラを登録
         */
        registerHandler(handler) {
            this.handlers.push(handler);
        }
        /**
         * エラーハンドラを削除
         */
        removeHandler(handler) {
            const index = this.handlers.indexOf(handler);
            if (index > -1) {
                this.handlers.splice(index, 1);
            }
        }
        /**
         * エラーを処理
         */
        handleError(error) {
            let errorInfo;
            if (error instanceof AppError) {
                errorInfo = error.toErrorInfo();
            }
            else if (error instanceof Error) {
                errorInfo = {
                    type: ErrorType.UNKNOWN,
                    level: ErrorLevel.MEDIUM,
                    message: error.message,
                    timestamp: Date.now(),
                    stack: error.stack
                };
            }
            else {
                errorInfo = error;
            }
            // エラー履歴に追加
            this.addToHistory(errorInfo);
            // 登録されたハンドラを実行
            this.handlers.forEach(handler => {
                try {
                    handler.handle(errorInfo);
                }
                catch (handlerError) {
                    console.error('[ErrorHandler] Handler error:', handlerError);
                }
            });
            // コンソールに出力
            this.logToConsole(errorInfo);
        }
        /**
         * エラー履歴に追加
         */
        addToHistory(errorInfo) {
            this.errorHistory.push(errorInfo);
            // 履歴サイズを制限
            if (this.errorHistory.length > this.maxHistorySize) {
                this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
            }
        }
        /**
         * コンソールに出力
         */
        logToConsole(errorInfo) {
            const logLevel = this.getLogLevel(errorInfo.level);
            const message = `[${errorInfo.type.toUpperCase()}] ${errorInfo.message}`;
            switch (logLevel) {
                case 'error':
                    console.error(message, errorInfo);
                    break;
                case 'warn':
                    console.warn(message, errorInfo);
                    break;
                case 'info':
                    console.info(message, errorInfo);
                    break;
                default:
                    console.log(message, errorInfo);
            }
        }
        /**
         * エラーレベルに応じたログレベルを取得
         */
        getLogLevel(level) {
            switch (level) {
                case ErrorLevel.CRITICAL:
                case ErrorLevel.HIGH:
                    return 'error';
                case ErrorLevel.MEDIUM:
                    return 'warn';
                case ErrorLevel.LOW:
                    return 'info';
                default:
                    return 'log';
            }
        }
        /**
         * エラー履歴を取得
         */
        getErrorHistory() {
            return [...this.errorHistory];
        }
        /**
         * エラー履歴をクリア
         */
        clearHistory() {
            this.errorHistory = [];
        }
    }
    /**
     * コンソールエラーハンドラ
     */
    class ConsoleErrorHandler {
        handle(error) {
            const level = error.level;
            const message = `[${error.type.toUpperCase()}] ${error.message}`;
            switch (level) {
                case ErrorLevel.CRITICAL:
                case ErrorLevel.HIGH:
                    console.error(message, error);
                    break;
                case ErrorLevel.MEDIUM:
                    console.warn(message, error);
                    break;
                case ErrorLevel.LOW:
                    console.info(message, error);
                    break;
            }
        }
    }
    /**
     * ユーザー通知エラーハンドラ
     */
    class UserNotificationErrorHandler {
        handle(error) {
            // 重要度が中以上のエラーのみユーザーに通知
            if (error.level === ErrorLevel.LOW)
                return;
            // エラーメッセージを表示
            this.showErrorNotification(error);
        }
        showErrorNotification(error) {
            // この実装はUIコンポーネントに依存するため、簡易的な実装
            // 実際のアプリケーションでは、適切なUIコンポーネントを使用
            // トースト通知の代替
            if (typeof window !== 'undefined' && window.document) {
                const toast = document.createElement('div');
                toast.className = 'error-toast';
                toast.textContent = this.getUserMessage(error);
                toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 2147483647;
        max-width: 300px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
      `;
                document.body.appendChild(toast);
                // 3秒後に自動的に削除
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 3000);
            }
        }
        getUserMessage(error) {
            switch (error.type) {
                case ErrorType.VALIDATION:
                    return '入力内容が無効です。確認して再度お試しください。';
                case ErrorType.STORAGE:
                    return 'データの保存に失敗しました。ブラウザのストレージ容量を確認してください。';
                case ErrorType.NETWORK:
                    return 'ネットワーク接続に問題があります。接続状態を確認してください。';
                case ErrorType.PERMISSION:
                    return '必要な権限がありません。ブラウザの設定を確認してください。';
                default:
                    return error.message || 'エラーが発生しました。再度お試しください。';
            }
        }
    }
    /**
     * エラーハンドリングのユーティリティ関数
     */
    const handleError = (error, type = ErrorType.UNKNOWN, level = ErrorLevel.MEDIUM, code, details, context) => {
        const manager = ErrorHandlerManager.getInstance();
        if (typeof error === 'string') {
            manager.handleError(new AppError(error, type, level, code, details, context));
        }
        else {
            manager.handleError(error);
        }
    };
    /**
     * 初期化関数
     */
    const initializeErrorHandling = () => {
        const manager = ErrorHandlerManager.getInstance();
        // デフォルトのエラーハンドラを登録
        manager.registerHandler(new ConsoleErrorHandler());
        manager.registerHandler(new UserNotificationErrorHandler());
        // グローバルエラーハンドラを設定
        if (typeof window !== 'undefined') {
            window.addEventListener('error', (event) => {
                handleError(event.error || new Error(event.message), ErrorType.UNKNOWN, ErrorLevel.HIGH, 'GLOBAL_ERROR', { filename: event.filename, lineno: event.lineno, colno: event.colno });
            });
            window.addEventListener('unhandledrejection', (event) => {
                handleError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)), ErrorType.UNKNOWN, ErrorLevel.HIGH, 'UNHANDLED_PROMISE_REJECTION');
            });
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
            // Bing検索カスタムイベントをリッスン
            this.dom.inputEl.addEventListener('palette-bing-search', (e) => {
                this.runBingSearch();
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
                // エラーハンドリングを最初に初期化
                initializeErrorHandling();
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
                    GM_registerMenuCommand('サイトマネージャを開く', () => {
                        try {
                            this.openManager();
                        }
                        catch (error) {
                            handleError(error instanceof Error ? error : String(error), ErrorType.UNKNOWN, ErrorLevel.MEDIUM, 'OPEN_MANAGER_ERROR');
                        }
                    });
                    GM_registerMenuCommand('設定', () => {
                        try {
                            this.openSettings();
                        }
                        catch (error) {
                            handleError(error instanceof Error ? error : String(error), ErrorType.UNKNOWN, ErrorLevel.MEDIUM, 'OPEN_SETTINGS_ERROR');
                        }
                    });
                    GM_registerMenuCommand('現在のページを追加', () => {
                        try {
                            this.runAddCurrent();
                        }
                        catch (error) {
                            handleError(error instanceof Error ? error : String(error), ErrorType.STORAGE, ErrorLevel.MEDIUM, 'ADD_CURRENT_PAGE_ERROR');
                        }
                    });
                    GM_registerMenuCommand('URLをコピー', async () => {
                        try {
                            await this.paletteCore.copyUrl();
                        }
                        catch (error) {
                            handleError(error instanceof Error ? error : String(error), ErrorType.PERMISSION, ErrorLevel.MEDIUM, 'COPY_URL_ERROR');
                        }
                    });
                    GM_registerMenuCommand('サンプルデータを追加', () => {
                        try {
                            addSampleData();
                        }
                        catch (error) {
                            handleError(error instanceof Error ? error : String(error), ErrorType.STORAGE, ErrorLevel.MEDIUM, 'ADD_SAMPLE_DATA_ERROR');
                        }
                    });
                }
                // 自動オープンをチェック
                if (shouldAutoOpen()) {
                    setTimeout(() => {
                        try {
                            this.openPalette();
                        }
                        catch (error) {
                            handleError(error instanceof Error ? error : String(error), ErrorType.UNKNOWN, ErrorLevel.MEDIUM, 'AUTO_OPEN_ERROR');
                        }
                    }, 120);
                }
                // 二重ハンドラを削除（main.tsのハンドラは不要になった）
                window.removeEventListener('keydown', this.updateHotkeyHandler, true);
            }
            catch (error) {
                console.error('[CommandPalette] Bootstrap error:', error);
                handleError(error instanceof Error ? error : String(error), ErrorType.UNKNOWN, ErrorLevel.HIGH, 'BOOTSTRAP_ERROR');
            }
        }
    }
    // アプリケーションを起動
    const app = new CommandPaletteApp();
    app.bootstrap();

})();
