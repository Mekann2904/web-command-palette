export const STORAGE_KEYS = {
  SITES: 'vm_sites_palette__sites',
  SETTINGS: 'vm_sites_palette__settings_v2',
  FAVCACHE: 'vm_sites_palette__favcache_v1',
  USAGE: 'vm_sites_palette__usage_v1'
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
