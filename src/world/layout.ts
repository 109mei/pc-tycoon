import type { Actor, GameState, Lane, PartType, Task } from '../core/types';
import { project, type IsoFrame } from './isoMath';

/**
 * 部屋の置き場所（PixiJS を使わない。画面の部品が名札などを重ねるのにも使う）。
 * 座標は 390×844 の基準の画面での CSS ピクセル。部屋の中はマス（x 右手前・y 左手前・z 上）。
 */

/** 部屋の canvas の位置と大きさ */
export const STAGE = { top: 90, width: 390, height: 340 } as const;

export interface RoomLayout {
  frame: IsoFrame;
  /** 床の広さ（マス） */
  w: number;
  d: number;
  /** 壁の高さ・厚み、床の台の厚み（マス） */
  wallH: number;
  wallT: number;
  slab: number;
  /** 人が立つ場所（床のマス）。アルバイト→自分の順に使う */
  slots: [number, number][];
  /** 雇った後の伸びを出す場所（canvas の座標） */
  badge: { x: number; y: number };
  /** 売れたときの「+¥」を出す場所（canvas の座標） */
  popup: { x: number; y: number };
}

const U = 21.5;

export const ROOM_LAYOUT: Record<Lane, RoomLayout> = {
  dis: {
    frame: { ox: 195, oy: 66, u: U },
    w: 10,
    d: 10,
    wallH: 2.7,
    wallT: 0.25,
    slab: 0.55,
    slots: [
      [4.3, 5.9],
      [7.6, 5.5],
      [2.6, 7.7],
    ],
    badge: { x: 90, y: 190 },
    popup: { x: 300, y: 40 },
  },
  asm: {
    frame: { ox: 195, oy: 66, u: U },
    w: 10,
    d: 10,
    wallH: 2.7,
    wallT: 0.25,
    slab: 0.55,
    slots: [
      [2.3, 3.3],
      [6.7, 4.3],
      [3.3, 6.5],
    ],
    badge: { x: 90, y: 196 },
    popup: { x: 300, y: 40 },
  },
  ship: {
    frame: { ox: 168, oy: 62, u: U },
    w: 8.8,
    d: 8.8,
    wallH: 2.7,
    wallT: 0.25,
    slab: 0.55,
    slots: [
      [2.3, 3.6],
      [4.7, 3.8],
      [1.7, 5.6],
    ],
    badge: { x: 90, y: 170 },
    popup: { x: 268, y: 58 },
  },
};

/** 生産の部屋：仕分け箱（部品の種類ごと）・廃棄箱・作業台・ラック・届いた箱の置き場 */
export const PRODUCTION = {
  rack: { x0: 0.6, x1: 4.7, y0: 0.3, y1: 1.45, shelvesZ: [0.22, 1.02, 1.82] },
  bins: { board: [5.25, 0.35], memory: [6.37, 0.35], storage: [7.49, 0.35], power: [8.61, 0.35] } as Record<
    PartType,
    [number, number]
  >,
  binSize: { w: 1.0, d: 0.95, h: 0.62 },
  ewaste: { x: 0.45, y: 5.3, w: 1.05, d: 1.05, h: 0.8 },
  bench: { x: 3.8, y: 3.0, w: 3.15, d: 1.55, top: 0.95 },
  /** 分解した部品が飛び出す場所（作業台の上） */
  benchCenter: [5.1, 3.8, 1.35] as [number, number, number],
  arrive: [9.4, 8.6] as [number, number],
};

/** 制作の部屋：机・PCケース・モニター・ワゴン（そろった部品のトレイ）・キット */
export const ASSEMBLY = {
  desk: { x: 3.6, y: 0.3, w: 4.95, d: 2.0, top: 1.0 },
  caseAt: [3.85, 0.45] as [number, number],
  monitorAt: [6.05, 0.6] as [number, number],
  cart: { x: 6.2, y: 5.4, w: 2.4, d: 1.2 },
  kitAt: [7.9, 2.8] as [number, number],
  /** 組み上がったPCが出てくる場所と、運ばれていく先 */
  pcFrom: [4.5, 2.5, 1.0] as [number, number, number],
  pcTo: [9.6, 7.5, 0] as [number, number, number],
};

/** 販売の部屋：梱包台・完成品の置き場・集荷を待つ箱・ドア・道路とバン */
export const SALES = {
  table: { x: 0.8, y: 0.3, w: 3.6, d: 1.55, top: 0.95 },
  pcs: { x: 4.6, y: 1.0 },
  boxes: { x: 6.55, y: 2.3 },
  door: { x0: 6.9, x1: 8.2 },
  road: { x0: 9.2, x1: 11.6, y0: -0.5, y1: 6.2, z: -0.5 },
  vanPark: [9.45, 0.2] as [number, number],
  packFrom: [3.2, 1.0, 1.0] as [number, number, number],
};

/** 人の絵の各部分の、足元からの高さ（ピクセル） */
export const PERSON = {
  headY: -38,
  ringY: -68,
  labelY: -98,
} as const;

export interface PersonSpot {
  actor: Actor;
  worker: boolean;
  /** canvas の座標（足元） */
  x: number;
  y: number;
  task: Task | null;
}

/** その部屋にいる人と立つ場所。アルバイト（番号順）→ 自分（今いる画面のときだけ） */
export function peopleIn(s: GameState, lane: Lane): PersonSpot[] {
  const L = ROOM_LAYOUT[lane];
  const out: PersonSpot[] = [];
  const place = (actor: Actor, worker: boolean, task: Task | null) => {
    const slot = L.slots[Math.min(out.length, L.slots.length - 1)]!;
    const p = project(L.frame, slot[0], slot[1], 0);
    out.push({ actor, worker, x: p.x, y: p.y, task });
  };
  for (const w of s.workers) if (w.lane === lane && !w.resting) place(w.id, true, w.task);
  if (s.player.screen === lane) place('player', false, s.player.task);
  return out;
}
