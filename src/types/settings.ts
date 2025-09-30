export interface Settings {
  hotkeyPrimary: string;
  hotkeySecondary: string;
  enterOpens: 'current' | 'newtab';
  blocklist: string;
  theme: 'dark' | 'light';
  accentColor: string;
  autoOpenUrls: string[];
}

export interface Theme {
  '--overlay-bg': string;
  '--panel-bg': string;
  '--panel-text': string;
  '--panel-shadow': string;
  '--input-bg': string;
  '--input-text': string;
  '--input-placeholder': string;
  '--border-color': string;
  '--muted': string;
  '--item-bg-alt': string;
  '--item-active': string;
  '--hint-bg': string;
  '--list-scroll-thumb': string;
  '--list-scroll-track': string;
  '--command-badge-bg': string;
  '--tag-bg': string;
  '--tag-text': string;
  '--toast-bg': string;
  '--toast-text': string;
}

export interface Themes {
  dark: Theme;
  light: Theme;
}
