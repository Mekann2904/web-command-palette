import { SiteEntry, Settings } from '@/types';

export const defaultSites: SiteEntry[] = [
  { id: 'site-github', type: 'site', name: 'GitHub', url: 'https://github.com/', tags: ['開発'] },
  { id: 'site-stackoverflow', type: 'site', name: 'Stack Overflow', url: 'https://stackoverflow.com/', tags: ['開発'] },
  { id: 'site-mdn', type: 'site', name: 'MDN Web Docs', url: 'https://developer.mozilla.org/', tags: ['開発'] },
  { id: 'site-bing', type: 'site', name: 'Bing検索', url: 'https://www.bing.com/search?q=%s', tags: ['検索'] },
  { id: 'site-youtube', type: 'site', name: 'YouTube', url: 'https://www.youtube.com/', tags: ['動画'] },
  { id: 'site-gcal', type: 'site', name: 'Google Calendar', url: 'https://calendar.google.com/', tags: ['仕事'] }
];

export const defaultSettings: Settings = {
  hotkeyPrimary: 'Meta+KeyP',
  hotkeySecondary: 'Control+KeyP',
  enterOpens: 'current',
  blocklist: '',
  theme: 'dark',
  accentColor: '#2563eb',
  autoOpenUrls: []
};

export const DEFAULT_PLACEHOLDER = 'サイト名やURLで検索… Enterで開く / Shift+Enterで新規タブ';
