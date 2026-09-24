import { deserialize, serialize, type SaveData } from './format';

/**
 * 保存の窓口。ゲームからはこれだけを使う。
 * 今は localStorage。あとで IndexedDB（Dexie）に差し替えられるよう、読み書きは Promise にしてある。
 */
export interface SaveStore {
  load(): Promise<SaveData | null>;
  save(data: SaveData): Promise<void>;
  clear(): Promise<void>;
}

/** localStorage と同じ形の入れ物（テストでは Map で代わりをする） */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = 'pc-tycoon/save';

export class LocalStorageSaveStore implements SaveStore {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key: string = SAVE_KEY,
  ) {}

  async load(): Promise<SaveData | null> {
    const text = this.storage.getItem(this.key);
    if (text === null) return null;
    return deserialize(text);
  }

  async save(data: SaveData): Promise<void> {
    this.storage.setItem(this.key, serialize(data));
  }

  async clear(): Promise<void> {
    this.storage.removeItem(this.key);
  }
}

/** 保存できない環境（プライベートモードなど）では、保存しない入れ物を使う */
export class MemorySaveStore implements SaveStore {
  private text: string | null = null;

  async load(): Promise<SaveData | null> {
    return this.text === null ? null : deserialize(this.text);
  }

  async save(data: SaveData): Promise<void> {
    this.text = serialize(data);
  }

  async clear(): Promise<void> {
    this.text = null;
  }
}
