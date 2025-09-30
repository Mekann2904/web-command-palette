export interface SiteEntry {
  id: string;
  type: 'site';
  name: string;
  url: string;
  tags: string[];
}

export interface SiteEntryRaw {
  id?: string;
  type?: string;
  name: string;
  url: string;
  tags?: string | string[];
}

export interface AutocompleteItem {
  name: string;
  count: number;
}
