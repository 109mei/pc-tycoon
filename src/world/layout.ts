import type { Actor, GameState, Lane, Task } from '../core/types';
import { project, type IsoFrame } from './isoMath';

/**
 * 部屋の置き場所（PixiJS を使わない。画面の部品が名札などを重ねるのにも使う）。
 * 座標は 390×844 の基準の画面での CSS ピクセル。
 */

/** 部屋の canvas の位置と大きさ */
export const STAGE = { top: 150, width: 390, height: 320 } as const;

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

const U = 20.6;

export const ROOM_LAYOUT: Record<Lane, RoomLayout> = {
  dis: {
    frame: { ox: 195, oy: 58, u: U },
    w: 10,
    d: 10,
    wallH: 2.6,
    wallT: 0.25,
    slab: 0.55,
    slots: [
      [4.3, 5.6],
      [7.6, 5.2],
      [2.6, 7.6],
    ],
    badge: { x: 92, y: 168 },
    popup: { x: 290, y: 40 },
  },
  asm: {
    frame: { ox: 195, oy: 58, u: U },
    w: 10,
    d: 10,
    wallH: 2.6,
    wallT: 0.25,
    slab: 0.55,
    slots: [
      [2.2, 2.9],
      [6.6, 4.0],
      [3.2, 6.4],
    ],
    badge: { x: 100, y: 176 },
    popup: { x: 290, y: 40 },
  },
  ship: {
    frame: { ox: 167, oy: 54, u: U },
    w: 8.8,
    d: 8.8,
    wallH: 2.6,
    wallT: 0.25,
    slab: 0.55,
    slots: [
      [2.3, 3.5],
      [4.6, 3.6],
      [1.6, 5.3],
    ],
    badge: { x: 92, y: 150 },
    popup: { x: 265, y: 55 },
  },
};

/** 人の絵の各部分の、足元からの高さ（ピクセル） */
export const PERSON = {
  headY: -33,
  ringY: -60,
  labelY: -90,
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
