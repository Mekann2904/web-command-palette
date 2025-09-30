import { SiteEntry } from '@/types';
import { DOMElements } from '@/core/state';
import { getSites, setSites, pruneUsage } from '@/core/storage';
import { escapeHtml } from '@/utils/string';
import { showToast } from '@/utils/ui';

// GM_* APIのグローバル宣言
declare const GM_setValue: (key: string, value: any) => void;

/**
 * サイトマネージャUIを管理するクラス
 */
export class Manager {
  private dom: DOMElements;
  private onRenderList: () => void;

  constructor(dom: DOMElements, onRenderList: () => void) {
    this.dom = dom;
    this.onRenderList = onRenderList;
  }

  /**
   * マネージャを構築
   */
  buildManager(): void {
    this.dom.mgrOverlay = document.createElement('div');
    this.dom.mgrOverlay.className = 'mgr-overlay';
    this.dom.mgrOverlay.addEventListener('click', e => { 
      if (e.target === this.dom.mgrOverlay) this.closeManager(); 
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

    this.dom.mgrOverlay.appendChild(this.dom.mgrBox);
    if (this.dom.root) {
      this.dom.root.appendChild(this.dom.mgrOverlay);
    }

    this.dom.siteBodyEl = this.dom.mgrBox.querySelector('#vm-rows-sites') as HTMLTableSectionElement;

    this.dom.mgrBox.querySelector('#vm-add-site')?.addEventListener('click', () => 
      this.addSiteRow({ name:'', url:'', tags:[] })
    );
    this.dom.mgrBox.querySelector('#vm-save')?.addEventListener('click', () => this.saveManager());
    this.dom.mgrBox.querySelector('#vm-close')?.addEventListener('click', () => this.closeManager());
    this.dom.mgrBox.querySelector('#vm-export')?.addEventListener('click', () => this.exportSites());
    
    const importInput = this.dom.mgrBox.querySelector('#vm-import-file') as HTMLInputElement;
    this.dom.mgrBox.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { 
        e.preventDefault(); 
        this.saveManager(); 
      }
      if (e.key === 'Escape') { 
        e.preventDefault(); 
        this.closeManager(); 
      }
    });
    
    this.dom.mgrBox.querySelector('#vm-import')?.addEventListener('click', () => {
      if (!importInput) return;
      importInput.value = '';
      importInput.click();
    });
    
    if (importInput) {
      importInput.addEventListener('change', () => {
        const file = importInput.files && importInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          this.importSitesFromJson(typeof reader.result === 'string' ? reader.result : '');
        };
        reader.onerror = () => {
          showToast('ファイルの読み込みに失敗しました');
        };
        try {
          reader.readAsText(file, 'utf-8');
        } catch (err) {
          console.error('[CommandPalette] import read error', err);
          showToast('ファイルの読み込みに失敗しました');
        }
      });
    }
  }

  /**
   * マネージャを開く
   */
  openManager(): void {
    this.renderManager();
    if (this.dom.mgrOverlay) {
      this.dom.mgrOverlay.style.display = 'block';
      setTimeout(() => { 
        const i = this.dom.mgrBox?.querySelector('input'); 
        if (i) i.focus(); 
      }, 0);
    }
  }

  /**
   * マネージャを閉じる
   */
  closeManager(): void {
    if (this.dom.mgrOverlay) {
      this.dom.mgrOverlay.style.display = 'none';
    }
  }

  /**
   * マネージャをレンダリング
   */
  renderManager(): void {
    if (!this.dom.siteBodyEl) return;
    this.dom.siteBodyEl.innerHTML = '';
    getSites().forEach(s => this.addSiteRow({ ...s }));
  }

  /**
   * サイト行を追加
   */
  addSiteRow(data: any): void {
    if (!this.dom.siteBodyEl) return;
    
    const tr = document.createElement('tr');
    if (data.id) tr.dataset.entryId = data.id;
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

    const urlInput = tr.querySelector('input[data-field="url"]') as HTMLInputElement;
    tr.querySelector('[data-up]')?.addEventListener('click', ()=> this.moveRow(tr, -1, this.dom.siteBodyEl!));
    tr.querySelector('[data-down]')?.addEventListener('click', ()=> this.moveRow(tr, +1, this.dom.siteBodyEl!));
    tr.querySelector('[data-del]')?.addEventListener('click', ()=> { tr.remove(); });
    tr.querySelector('[data-test]')?.addEventListener('click', ()=> {
      const u = urlInput?.value.trim();
      if (u) window.open(u.includes('%s') ? u.replace(/%s/g, encodeURIComponent('test')) : u, '_blank');
    });

    this.dom.siteBodyEl.appendChild(tr);
  }

  /**
   * 行を移動
   */
  moveRow(tr: HTMLTableRowElement, delta: number, container: HTMLTableSectionElement): void {
    const rows = Array.from(container.children);
    const i = rows.indexOf(tr); 
    if (i < 0) return;
    const ni = Math.min(rows.length - 1, Math.max(0, i + delta));
    if (ni === i) return;
    if (delta < 0) {
      container.insertBefore(tr, rows[ni]); 
    } else {
      container.insertBefore(tr, rows[ni].nextSibling);
    }
  }

  /**
   * マネージャを保存
   */
  saveManager(): void {
    if (!this.dom.siteBodyEl) return;
    
    const previousSites = getSites();

    const sites = Array.from(this.dom.siteBodyEl!.querySelectorAll('tr')).map((tr, index) => {
      const name = (tr.querySelector('input[data-field="name"]') as HTMLInputElement)?.value.trim() || '';
      const url = (tr.querySelector('input[data-field="url"]') as HTMLInputElement)?.value.trim() || '';
      const tags = (tr.querySelector('input[data-field="tags"]') as HTMLInputElement)?.value.split(/[,\s]+/).map((t: string) => t.trim()).filter(Boolean) || [];
      if (!name || !url) return null;
      const existing = tr.dataset.entryId && previousSites.find(s => s.id === tr.dataset.entryId);
      const id = existing ? existing.id : (tr.dataset.entryId || `site-${Math.random().toString(36).slice(2, 10)}`);
      return { id, type: 'site' as const, name, url, tags };
    }).filter(Boolean) as SiteEntry[];

    setSites(sites);
    pruneUsage(new Set([...sites.map(s => s.id)]));
    showToast('保存しました');
    this.onRenderList();
  }

  /**
   * サイトをエクスポート
   */
  exportSites(): void {
    const sites = getSites();
    const json = JSON.stringify(sites, null, 2);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `sites-backup-${stamp}.json`;
    if (this.downloadTextFile(filename, json)) {
      showToast('エクスポートファイルをダウンロードしました');
    } else {
      showToast('エクスポートに失敗しました');
    }
  }

  /**
   * テキストファイルをダウンロード
   */
  private downloadTextFile(filename: string, text: string): boolean {
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
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return true;
    } catch (e) {
      console.error('[CommandPalette] export failed', e);
      return false;
    }
  }

  /**
   * JSONからサイトをインポート
   */
  private importSitesFromJson(jsonText: string): void {
    if (!jsonText) {
      showToast('無効なJSONです');
      return;
    }
    try {
      const arr = JSON.parse(jsonText);
      if (!Array.isArray(arr)) throw new Error('not array');
      setSites(arr);
      pruneUsage(new Set(getSites().map(e => e.id)));
      this.renderManager();
      showToast('読み込みました');
    } catch (err) {
      console.error('[CommandPalette] import parse error', err);
      showToast('無効なJSONです');
    }
  }
}
