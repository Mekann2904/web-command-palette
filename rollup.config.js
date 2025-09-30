import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/main.ts',
  output: {
    file: 'dist/script.user.js',
    format: 'iife',
    name: 'WebCommandPalette',
    banner: `// ==UserScript==
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

`,
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      sourceMap: false,
    }),
  ],
  external: [],
};
