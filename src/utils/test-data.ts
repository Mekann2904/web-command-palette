import { SiteEntry } from '@/types';

/**
 * テスト用のサンプルデータを作成
 */
export const createSampleData = (): SiteEntry[] => {
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
export const addSampleData = (): void => {
  try {
    const existing = (window as any).GM_getValue?.('vm_sites_palette__sites', []) || [];
    const sampleData = createSampleData();
    
    // 重複チェック
    const existingIds = new Set(existing.map((item: any) => item.id));
    const newItems = sampleData.filter(item => !existingIds.has(item.id));
    
    if (newItems.length > 0) {
      const updated = [...existing, ...newItems];
      (window as any).GM_setValue?.('vm_sites_palette__sites', updated);
    } else {
      // サンプルデータは既に存在
    }
  } catch (error) {
    console.error('[CommandPalette] Failed to add sample data:', error);
  }
};

/**
 * サンプルデータをクリア
 */
export const clearSampleData = (): void => {
  try {
    const existing = (window as any).GM_getValue?.('vm_sites_palette__sites', []) || [];
    const sampleIds = new Set(createSampleData().map(item => item.id));
    const filtered = existing.filter((item: any) => !sampleIds.has(item.id));
    (window as any).GM_setValue?.('vm_sites_palette__sites', filtered);
  } catch (error) {
    console.error('[CommandPalette] Failed to clear sample data:', error);
  }
};
