import { Settings } from '@/types';
import { DOMElements } from '@/core/state';
import { getSettings, setSettings } from '@/core/storage';
import { defaultSettings } from '@/constants';
import { showToast } from '@/utils/ui';
import { addClickListener, addKeydownListener, addInputListener, addBlurListener, addFocusListener } from '@/utils/events';
import { getSettingsElements, getInputValue, getTextareaValue } from '@/utils/dom-helpers';

// GM_* APIのグローバル宣言
declare const GM_setValue: (key: string, value: any) => void;

/**
 * 設定UIを管理するクラス
 */
export class SettingsUI {
  private dom: DOMElements;
  private cachedSettings: Settings | null = null;
  private onApplyTheme: () => void;

  constructor(dom: DOMElements, onApplyTheme: () => void) {
    this.dom = dom;
    this.onApplyTheme = onApplyTheme;
  }

  /**
   * 設定を構築
   */
  buildSettings(): void {
    this.dom.setOverlay = document.createElement('div');
    this.dom.setOverlay.className = 'set-overlay';
    this.dom.setOverlay.addEventListener('click', e => { 
      if (e.target === this.dom.setOverlay) this.closeSettings(); 
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
      const emptyCache: Record<string, string> = {};
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
  openSettings(): void {
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
  closeSettings(): void {
    if (this.dom.setOverlay) {
      this.dom.setOverlay.style.display = 'none';
    }
  }

  /**
   * 設定をUIに適用
   */
  applySettingsToUI(s: Settings): void {
    if (!this.dom.setBox) return;
    
    const hotkey1Input = this.dom.setBox.querySelector('#vs-hotkey1') as HTMLInputElement;
    const hotkey2Input = this.dom.setBox.querySelector('#vs-hotkey2') as HTMLInputElement;
    
    if (hotkey1Input) {
      hotkey1Input.value = this.labelHotkey(s.hotkeyPrimary);
      hotkey1Input.dataset.sig = s.hotkeyPrimary;
    }
    if (hotkey2Input) {
      hotkey2Input.value = this.labelHotkey(s.hotkeySecondary);
      hotkey2Input.dataset.sig = s.hotkeySecondary;
    }
    
    Array.from(this.dom.setBox.querySelectorAll('input[name="vs-enter"]')).forEach(r => {
      const input = r as HTMLInputElement;
      input.checked = input.value === s.enterOpens;
    });
    Array.from(this.dom.setBox.querySelectorAll('input[name="vs-theme"]')).forEach(r => {
      const input = r as HTMLInputElement;
      input.checked = input.value === (s.theme || 'dark');
    });
    
    const accent = s.accentColor || defaultSettings.accentColor;
    const accentInput = this.dom.setBox.querySelector('#vs-accent') as HTMLInputElement;
    const accentText = this.dom.setBox.querySelector('#vs-accent-text') as HTMLInputElement;
    
    if (accentInput) accentInput.value = this.normalizeColor(accent);
    if (accentText) accentText.value = this.normalizeColor(accent);
    
    const blocklistInput = this.dom.setBox.querySelector('#vs-blocklist') as HTMLTextAreaElement;
    if (blocklistInput) blocklistInput.value = s.blocklist || '';
    
    const autoOpenInput = this.dom.setBox.querySelector('#vs-auto-open') as HTMLTextAreaElement;
    if (autoOpenInput) {
      const auto = this.normalizeAutoOpen(s.autoOpenUrls);
      autoOpenInput.value = auto.join('\n');
    }
  }

  /**
   * UIから設定を保存
   */
  saveSettingsFromUI(): void {
    if (!this.dom.setBox) return;
    
    const elements = getSettingsElements(this.dom.setBox);
    
    const s: Settings = {
      hotkeyPrimary: elements.hotkey1Input?.dataset.sig || defaultSettings.hotkeyPrimary,
      hotkeySecondary: elements.hotkey2Input?.dataset.sig || defaultSettings.hotkeySecondary,
      enterOpens: ((this.dom.setBox.querySelector('input[name="vs-enter"]:checked') as HTMLInputElement)?.value || 'current') as 'current' | 'newtab',
      theme: ((this.dom.setBox.querySelector('input[name="vs-theme"]:checked') as HTMLInputElement)?.value || defaultSettings.theme) as 'dark' | 'light',
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
  private normalizeColor(value: string): string {
    let v = (value || '').trim();
    if (!v) return defaultSettings.accentColor;
    if (!v.startsWith('#')) v = '#' + v.replace(/^#+/, '');
    if (v.length === 4) v = '#' + v.slice(1).split('').map(ch => ch + ch).join('');
    if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
    return defaultSettings.accentColor;
  }

  /**
   * 自動オープンURLを正規化
   */
  private normalizeAutoOpen(value: string | string[]): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(v => (v || '').trim()).filter(Boolean);
    return value.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
  }

  /**
   * アクセントカラー同期を設定
   */
  private setupAccentSync(): void {
    if (!this.dom.setBox) return;
    
    const elements = getSettingsElements(this.dom.setBox);
    const colorInput = elements.accentInput;
    const textInput = elements.accentText;
    
    const hexFull = (v: string) => /^#?[0-9a-fA-F]{6}$/.test(v.replace(/^#/, ''));
    
    colorInput.addEventListener('input', () => {
      const val = colorInput.value;
      if (textInput) textInput.value = val;
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
  private setupHotkeyCapture(input: HTMLInputElement | null, field: keyof Settings): void {
    if (!input) return;
    
    input.addEventListener('focus', () => {
      input.value = '任意のキーを押す';
    });
    
    input.addEventListener('blur', () => {
      const sig = input.dataset.sig || getSettings()[field] as string;
      input.value = this.labelHotkey(sig || '');
    });
    
    input.addEventListener('keydown', (e: KeyboardEvent) => {
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
      const modifiers: string[] = [];
      if (e.metaKey) modifiers.push('Meta');
      if (e.ctrlKey) modifiers.push('Control');
      if (e.altKey) modifiers.push('Alt');
      if (e.shiftKey) modifiers.push('Shift');
      
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
  private labelHotkey(sig: string): string {
    if (!sig) return '';
    
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
    const specialKeys: Record<string, string> = {
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
    const modifierLabels: string[] = [];
    
    for (const mod of modifiers) {
      if (mod === 'Meta') {
        modifierLabels.push(isMac ? '⌘' : 'Win+');
      } else if (mod === 'Control') {
        modifierLabels.push(isMac ? '⌃' : 'Ctrl+');
      } else if (mod === 'Alt') {
        modifierLabels.push(isMac ? '⌥' : 'Alt+');
      } else if (mod === 'Shift') {
        modifierLabels.push(isMac ? '⇧' : 'Shift+');
      }
    }
    
    // 修飾キーとメインキーを結合
    return modifierLabels.join('') + keyName;
  }
}
