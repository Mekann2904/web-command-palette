import { matchHotkey } from './hotkey';

describe('hotkey', () => {
  describe('matchHotkey', () => {
    it('should match simple Meta+Key combination', () => {
      const event = {
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        code: 'KeyP'
      } as KeyboardEvent;
      
      expect(matchHotkey(event, 'Meta+KeyP')).toBe(true);
      expect(matchHotkey(event, 'Meta+KeyK')).toBe(false);
    });

    it('should match simple Control+Key combination', () => {
      const event = {
        metaKey: false,
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        code: 'KeyP'
      } as KeyboardEvent;
      
      expect(matchHotkey(event, 'Control+KeyP')).toBe(true);
      expect(matchHotkey(event, 'Control+KeyK')).toBe(false);
    });

    it('should match multiple modifier keys', () => {
      const event = {
        metaKey: true,
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
        code: 'KeyP'
      } as KeyboardEvent;
      
      expect(matchHotkey(event, 'Meta+Alt+KeyP')).toBe(true);
      expect(matchHotkey(event, 'Meta+KeyP')).toBe(false);
      expect(matchHotkey(event, 'Alt+KeyP')).toBe(false);
    });

    it('should match Meta+Shift+Key combination', () => {
      const event = {
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: true,
        code: 'KeyP'
      } as KeyboardEvent;
      
      expect(matchHotkey(event, 'Meta+Shift+KeyP')).toBe(true);
      expect(matchHotkey(event, 'Meta+KeyP')).toBe(false);
    });

    it('should match Control+Alt+Shift+Key combination', () => {
      const event = {
        metaKey: false,
        ctrlKey: true,
        altKey: true,
        shiftKey: true,
        code: 'KeyP'
      } as KeyboardEvent;
      
      expect(matchHotkey(event, 'Control+Alt+Shift+KeyP')).toBe(true);
      expect(matchHotkey(event, 'Control+Alt+KeyP')).toBe(false);
    });

    it('should not match when required modifier is missing', () => {
      const event = {
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        code: 'KeyP'
      } as KeyboardEvent;
      
      expect(matchHotkey(event, 'Meta+KeyP')).toBe(false);
      expect(matchHotkey(event, 'Control+KeyP')).toBe(false);
    });

    it('should not match when extra modifier is present', () => {
      const event = {
        metaKey: true,
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
        code: 'KeyP'
      } as KeyboardEvent;
      
      expect(matchHotkey(event, 'Meta+KeyP')).toBe(false);
    });

    it('should handle empty signature', () => {
      const event = {
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        code: 'KeyP'
      } as KeyboardEvent;
      
      expect(matchHotkey(event, '')).toBe(false);
    });

    it('should match special keys', () => {
      const event = {
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        code: 'Space'
      } as KeyboardEvent;
      
      expect(matchHotkey(event, 'Meta+Space')).toBe(true);
    });

    it('should match arrow keys', () => {
      const event = {
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        code: 'ArrowUp'
      } as KeyboardEvent;
      
      expect(matchHotkey(event, 'Meta+ArrowUp')).toBe(true);
    });

    it('should not match when main key is a modifier key', () => {
      const event = {
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        code: 'MetaLeft'
      } as KeyboardEvent;
      
      expect(matchHotkey(event, 'Meta+MetaLeft')).toBe(false);
    });

    it('should not match when main key is ControlLeft', () => {
      const event = {
        metaKey: false,
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        code: 'ControlLeft'
      } as KeyboardEvent;
      
      expect(matchHotkey(event, 'Control+ControlLeft')).toBe(false);
    });

    it('should not match when main key is AltLeft', () => {
      const event = {
        metaKey: false,
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
        code: 'AltLeft'
      } as KeyboardEvent;
      
      expect(matchHotkey(event, 'Alt+AltLeft')).toBe(false);
    });

    it('should not match when main key is ShiftLeft', () => {
      const event = {
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        shiftKey: true,
        code: 'ShiftLeft'
      } as KeyboardEvent;
      
      expect(matchHotkey(event, 'Shift+ShiftLeft')).toBe(false);
    });
  });
});