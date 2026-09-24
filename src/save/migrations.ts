import { balance } from '../data';

type Json = Record<string, any>;

/**
 * 版 n のセーブを 版 n+1 に変換する関数。
 * 1 → 2（段階1・改）：部品を4種類に分け、注文と発送中の作業に値段を付け、出品価格と新しい記録を足す。
 */
export const MIGRATIONS: Record<number, (old: Json) => Json> = {
  1: (d) => {
    const st = d.state as Json;
    // 部品の個数は、4種類1個ずつの組に分ける（1組で1台分。あまりは捨てる）
    const n = typeof st.parts === 'number' ? st.parts : 0;
    const sets = Math.floor(n / 4);
    st.parts = { board: sets, memory: sets, storage: sets, power: sets };
    const level = balance.market.defaultLevel;
    const price = balance.market.priceLevels[level]!.price;
    st.priceLevel = level;
    st.orders = (st.orders ?? []).map((o: Json) => ({ ...o, price }));
    const fixTask = (t: Json | null) => (t ? { ...t, price: t.lane === 'ship' ? price : null } : null);
    st.player = { ...st.player, queued: false, task: fixTask(st.player?.task ?? null) };
    st.workers = (st.workers ?? []).map((w: Json) => ({ ...w, task: fixTask(w.task ?? null) }));
    st.recent = { ...st.recent, lost: [] };
    st.stats = { ...st.stats, brokenParts: 0, newPartsBought: 0, newPartsSpent: 0, priceChanges: 0 };
    st.schema = 2;
    return d;
  },
};
