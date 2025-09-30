import { extractTagFilter, shouldShowTagSuggestions, filterEntriesByTag } from './search';
import { SiteEntry } from '@/types';

describe('search utils', () => {
  const mockEntries: SiteEntry[] = [
    { id: '1', type: 'site', name: 'GitHub', url: 'https://github.com', tags: ['開発', 'git'] },
    { id: '2', type: 'site', name: 'Stack Overflow', url: 'https://stackoverflow.com', tags: ['開発'] },
    { id: '3', type: 'site', name: 'YouTube', url: 'https://youtube.com', tags: ['動画', 'entertainment'] },
    { id: '4', type: 'site', name: 'Google Calendar', url: 'https://calendar.google.com', tags: ['仕事', 'calendar'] },
    { id: '5', type: 'site', name: 'MDN', url: 'https://developer.mozilla.org', tags: ['開発', 'documentation'] },
    { id: '6', type: 'site', name: 'AI Tools', url: 'https://ai.example.com', tags: ['ai/tools', 'development'] }
  ];

  describe('extractTagFilter', () => {
    it('should return null tagFilter for regular queries', () => {
      const result = extractTagFilter('github');
      expect(result.tagFilter).toBeNull();
      expect(result.textQuery).toBe('github');
    });

    it('should extract tag filter for #tag format', () => {
      const result = extractTagFilter('#開発');
      expect(result.tagFilter).toBe('開発');
      expect(result.textQuery).toBe('');
    });

    it('should extract tag filter and text query for #tag query format', () => {
      const result = extractTagFilter('#開発 github');
      expect(result.tagFilter).toBe('開発');
      expect(result.textQuery).toBe('github');
    });

    it('should handle complex tag queries', () => {
      const result = extractTagFilter('#ai/tools chatgpt');
      expect(result.tagFilter).toBe('ai/tools');
      expect(result.textQuery).toBe('chatgpt');
    });

    it('should handle empty queries', () => {
      const result = extractTagFilter('');
      expect(result.tagFilter).toBeNull();
      expect(result.textQuery).toBe('');
    });

    it('should handle queries with only #', () => {
      const result = extractTagFilter('#');
      expect(result.tagFilter).toBeNull();
      expect(result.textQuery).toBe('');
    });
  });

  describe('shouldShowTagSuggestions', () => {
    it('should return false for regular queries', () => {
      expect(shouldShowTagSuggestions('github')).toBe(false);
      expect(shouldShowTagSuggestions('github stackoverflow')).toBe(false);
    });

    it('should return true for #tag format', () => {
      expect(shouldShowTagSuggestions('#開発')).toBe(true);
      expect(shouldShowTagSuggestions('#ai')).toBe(true);
    });

    it('should return false for #tag query format', () => {
      expect(shouldShowTagSuggestions('#開発 github')).toBe(false);
      expect(shouldShowTagSuggestions('#ai tools')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(shouldShowTagSuggestions('#')).toBe(true);
      expect(shouldShowTagSuggestions('')).toBe(false);
      expect(shouldShowTagSuggestions('text #tag')).toBe(false);
    });
  });

  describe('filterEntriesByTag', () => {
    it('should return all entries when tagFilter is empty', () => {
      const result = filterEntriesByTag(mockEntries, '');
      expect(result).toHaveLength(mockEntries.length);
    });

    it('should filter entries by exact tag match', () => {
      const result = filterEntriesByTag(mockEntries, '開発');
      expect(result).toHaveLength(3);
      expect(result.map(e => e.name)).toContain('GitHub');
      expect(result.map(e => e.name)).toContain('Stack Overflow');
      expect(result.map(e => e.name)).toContain('MDN');
    });

    it('should filter entries by hierarchical tag match', () => {
      const result = filterEntriesByTag(mockEntries, 'ai');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('AI Tools');
    });

    it('should filter entries by hierarchical tag', () => {
      const result = filterEntriesByTag(mockEntries, 'ai/tools');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('AI Tools');
    });

    it('should filter entries by parent tag', () => {
      const result = filterEntriesByTag(mockEntries, 'ai');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('AI Tools');
    });

    it('should not match partial strings in tags', () => {
      const result = filterEntriesByTag(mockEntries, 'tain');
      expect(result).toHaveLength(0);
    });

    it('should be case insensitive', () => {
      const result = filterEntriesByTag(mockEntries, '開発');
      expect(result).toHaveLength(3);
      
      const result2 = filterEntriesByTag(mockEntries, '開発');
      expect(result2).toHaveLength(3);
    });

    it('should return empty array for non-existent tags', () => {
      const result = filterEntriesByTag(mockEntries, 'nonexistent');
      expect(result).toHaveLength(0);
    });

    it('should handle entries without tags', () => {
      const entriesWithoutTags: SiteEntry[] = [
        { id: '7', type: 'site', name: 'No Tags', url: 'https://example.com', tags: [] }
      ];
      const result = filterEntriesByTag(entriesWithoutTags, 'anytag');
      expect(result).toHaveLength(0);
    });
  });
});