import { describe, expect, it } from 'vitest';
import { createState, hire, runPolicy, smartPolicy, step } from '../src/core';
import { balance as bal } from '../src/data';
import {
  deserialize,
  exportText,
  importText,
  LocalStorageSaveStore,
  migrate,
  MIGRATIONS,
  SAVE_VERSION,
  SaveFormatError,
  serialize,
  type KeyValueStorage,
  type SaveData,
} from '../src/save';

function memoryStorage(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function sample(): SaveData {
  const s = createState(bal, 11);
  runPolicy(s, bal, 150, smartPolicy());
  return { saveVersion: SAVE_VERSION, savedAt: 1_700_000_000_000, screen: s.player.screen, settings: { theme: 'auto' }, state: s };
}

describe('セーブ', () => {
  it('保存して読み込んでも状態が変わらない（作業の途中・注文・下請け・乱数も含む）', () => {
    const data = sample();
    expect(data.state.workers.length + data.state.orders.length).toBeGreaterThan(0);
    const back = deserialize(serialize(data));
    expect(back).toEqual(data);
  });

  it('読み込んだ状態から進めても、読み込まずに進めたのと同じ結果になる', () => {
    const data = sample();
    const back = deserialize(serialize(data));
    for (let i = 0; i < 1200; i++) {
      step(data.state, bal);
      step(back.state, bal);
    }
    expect(back.state).toEqual(data.state);
  });

  it('SaveStore（localStorage）で保存・読み込み・消去ができる', async () => {
    const storage = memoryStorage();
    const store = new LocalStorageSaveStore(storage);
    expect(await store.load()).toBeNull();
    const data = sample();
    await store.save(data);
    expect(storage.map.size).toBe(1);
    expect(await store.load()).toEqual(data);
    await store.clear();
    expect(await store.load()).toBeNull();
  });

  it('セーブには版番号が入り、今の版はそのまま通る', () => {
    const data = sample();
    expect(JSON.parse(serialize(data)).saveVersion).toBe(SAVE_VERSION);
    expect(migrate(JSON.parse(serialize(data)))).toEqual(data);
  });

  it('古い版は変換関数を順に通して新しい版にする', () => {
    const data = sample();
    const old = { ...JSON.parse(serialize(data)), saveVersion: 0, legacy: true };
    MIGRATIONS[0] = (d) => {
      const { legacy: _legacy, ...rest } = d;
      return rest;
    };
    try {
      expect(migrate(old)).toEqual(data);
    } finally {
      delete MIGRATIONS[0];
    }
  });

  it('新しすぎる版・壊れたセーブは読み込まない', () => {
    const data = sample();
    expect(() => migrate({ ...data, saveVersion: SAVE_VERSION + 1 })).toThrow(SaveFormatError);
    expect(() => deserialize('{')).toThrow(SaveFormatError);
    const broken = JSON.parse(serialize(data));
    broken.state.cash = 'たくさん';
    expect(() => migrate(broken)).toThrow(SaveFormatError);
  });

  it('テキストに書き出して、貼り付けて読み込める', () => {
    const data = sample();
    hire(data.state, bal, 'ship', { force: true });
    const text = exportText(data);
    expect(text.startsWith('PCT1.')).toBe(true);
    expect(importText(text)).toEqual(data);
    expect(importText(`  ${text.slice(0, 20)}\n${text.slice(20)}  `)).toEqual(data);
    expect(importText(serialize(data))).toEqual(data);
    expect(() => importText('PCT1.@@@')).toThrow(SaveFormatError);
  });
});
