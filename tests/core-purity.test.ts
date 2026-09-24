import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const coreDir = fileURLToPath(new URL('../src/core/', import.meta.url));

/** ルール本体（src/core）が画面・保存・時刻・Math.random に触れていないこと（CLAUDE.md 設計の決まり1・2） */
const FORBIDDEN: [RegExp, string][] = [
  [/from\s+['"]react/, 'React'],
  [/from\s+['"]react-dom/, 'ReactDOM'],
  [/from\s+['"]pixi/, 'PixiJS'],
  [/from\s+['"]zustand/, 'Zustand'],
  [/from\s+['"]\.\.\/(ui|world|store|save)\//, '画面・保存のフォルダ'],
  [/\blocalStorage\b/, 'localStorage'],
  [/\bwindow\./, 'window'],
  [/\bdocument\./, 'document'],
  [/Math\.random/, 'Math.random'],
  [/Date\.now/, 'Date.now'],
  [/performance\.now/, 'performance.now'],
];

describe('ルール本体は Pure TypeScript', () => {
  const files = readdirSync(coreDir).filter((f) => f.endsWith('.ts'));
  it('src/core にファイルがある', () => {
    expect(files.length).toBeGreaterThan(0);
  });
  for (const f of files) {
    it(`${f} は画面・保存・時刻・Math.random を使わない`, () => {
      // コメントの中の説明は数えない
      const src = readFileSync(join(coreDir, f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      for (const [re, what] of FORBIDDEN) {
        expect(re.test(src), `${f} が ${what} を使っている`).toBe(false);
      }
    });
  }
});
