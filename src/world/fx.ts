import { Container, Graphics } from 'pixi.js';
import type { GameEvent, GameState, Lane, PartType } from '../core/types';
import { Iso } from './gfx';
import { project, type IsoFrame } from './isoMath';
import { ASSEMBLY, PRODUCTION, ROOM_LAYOUT, SALES } from './layout';
import type { RoomPalette } from './palette';
import { junkPc, packedBox, part, pcTower, van } from './props';

/**
 * 部屋の動き（見た目だけ。ルール本体の状態は書き換えない）。
 * 出来事を受けて物を飛ばし、バンを走らせ、モニターのバーを伸ばす。
 */

interface Anim {
  g: Graphics;
  from: { x: number; y: number };
  to: { x: number; y: number };
  t: number;
  delay: number;
  dur: number;
  arc: number;
  fade: boolean;
  onDone?: () => void;
}

type VanState = 'away' | 'in' | 'load' | 'out';

/** バンの走り方（秒・マス） */
const VAN = { inSeconds: 1.3, loadSeconds: 0.9, outSeconds: 1.3, fromY: 9.5, toY: -8 };
/** 物が飛ぶ時間（秒） */
const FLY_SECONDS = 0.55;

export class Fx {
  readonly root = new Container();
  private readonly layer = new Container();
  private readonly vanG = new Graphics();
  private readonly barG = new Graphics();
  private anims: Anim[] = [];
  private vanState: VanState = 'away';
  private vanT = 0;
  /** 集荷を待つ箱（見た目の数。バンが積むと 0 に戻る） */
  boxesWaiting = 0;

  constructor() {
    this.root.addChild(this.vanG, this.layer, this.barG);
  }

  /** 部屋を移ったら、飛んでいる物は消す */
  reset(): void {
    for (const a of this.anims) a.g.destroy();
    this.anims = [];
    this.vanState = 'away';
    this.vanT = 0;
    this.vanG.clear();
    this.barG.clear();
  }

  private local(frame: IsoFrame): Iso {
    const g = new Graphics();
    return new Iso(g, { ox: 0, oy: 0, u: frame.u });
  }

  private spawn(g: Graphics, from: { x: number; y: number }, to: { x: number; y: number }, opts: Partial<Anim> = {}): void {
    g.position.set(from.x, from.y);
    this.layer.addChild(g);
    this.anims.push({ g, from, to, t: 0, delay: 0, dur: FLY_SECONDS, arc: 26, fade: false, ...opts });
  }

  onEvents(events: GameEvent[], lane: Lane, pal: RoomPalette): void {
    const L = ROOM_LAYOUT[lane];
    const at = (x: number, y: number, z = 0) => project(L.frame, x, y, z);
    for (const e of events) {
      if (e.type === 'sold') {
        if (lane !== 'ship') {
          this.boxesWaiting += 1;
          continue;
        }
        const p = this.local(L.frame);
        packedBox(p, pal, -0.41, -0.41, 0);
        const [fx, fy, fz] = SALES.packFrom;
        this.spawn(p.g, at(fx, fy, fz), at(SALES.boxes.x + 0.4, SALES.boxes.y + 0.4, 0), {
          dur: 0.7,
          arc: 18,
          onDone: () => {
            this.boxesWaiting += 1;
          },
        });
        continue;
      }
      if (lane === 'dis' && e.type === 'disassembled') {
        const [bx, by, bz] = PRODUCTION.benchCenter;
        const from = at(bx, by, bz);
        const size = PRODUCTION.binSize;
        const all: [PartType, boolean][] = [...e.good.map((t) => [t, true] as [PartType, boolean]), ...e.broken.map((t) => [t, false] as [PartType, boolean])];
        all.forEach(([type, ok], i) => {
          const p = this.local(L.frame);
          const tint = ok ? pal : { ...pal, part: { ...pal.part, [type]: { top: 0x7a7d82, left: 0x4a4d52, right: 0x5f6267 } } };
          part(p, tint, type, -0.3, -0.2, 0, 0.9);
          const to = ok
            ? at(PRODUCTION.bins[type][0] + size.w / 2, PRODUCTION.bins[type][1] + size.d / 2, size.h)
            : at(PRODUCTION.ewaste.x + PRODUCTION.ewaste.w / 2, PRODUCTION.ewaste.y + PRODUCTION.ewaste.d / 2, PRODUCTION.ewaste.h);
          this.spawn(p.g, from, to, { delay: i * 0.08, arc: 34, fade: true });
        });
      } else if (lane === 'dis' && e.type === 'bought') {
        for (let i = 0; i < Math.min(e.count, 3); i++) {
          const p = this.local(L.frame);
          junkPc(p, pal, -0.57, -0.41, 0, i);
          const [ax, ay] = PRODUCTION.arrive;
          this.spawn(p.g, at(ax, ay, 0), at(3.2, 2.2, 0), { delay: i * 0.18, dur: 0.8, arc: 10, fade: true });
        }
      } else if (lane === 'asm' && e.type === 'assembled' && !e.kit) {
        const p = this.local(L.frame);
        pcTower(p, pal, -0.3, -0.47, 0);
        const [fx, fy, fz] = ASSEMBLY.pcFrom;
        const [tx, ty, tz] = ASSEMBLY.pcTo;
        this.spawn(p.g, at(fx, fy, fz), at(tx, ty, tz), { dur: 0.9, arc: 14, fade: true });
      }
    }
  }

  /** 毎フレーム：飛んでいる物を進め、バンを走らせ、モニターのバーを描く */
  update(dtSeconds: number, s: GameState, lane: Lane, pal: RoomPalette): void {
    for (const a of this.anims) {
      if (a.delay > 0) {
        a.delay -= dtSeconds;
        a.g.visible = false;
        continue;
      }
      a.g.visible = true;
      a.t = Math.min(1, a.t + dtSeconds / a.dur);
      const k = 1 - (1 - a.t) * (1 - a.t);
      a.g.position.set(a.from.x + (a.to.x - a.from.x) * k, a.from.y + (a.to.y - a.from.y) * k - Math.sin(Math.PI * a.t) * a.arc);
      if (a.fade) a.g.alpha = a.t > 0.75 ? 1 - (a.t - 0.75) / 0.25 : 1;
      if (a.t >= 1) a.onDone?.();
    }
    const done = this.anims.filter((a) => a.t >= 1);
    for (const a of done) a.g.destroy();
    this.anims = this.anims.filter((a) => a.t < 1);

    const L = ROOM_LAYOUT[lane];
    // 集荷のバン（販売の部屋だけ）
    this.vanG.clear();
    if (lane === 'ship') {
      this.vanT += dtSeconds;
      if (this.vanState === 'away' && this.boxesWaiting > 0) {
        this.vanState = 'in';
        this.vanT = 0;
      } else if (this.vanState === 'in' && this.vanT >= VAN.inSeconds) {
        this.vanState = 'load';
        this.vanT = 0;
      } else if (this.vanState === 'load' && this.vanT >= VAN.loadSeconds) {
        this.boxesWaiting = 0;
        this.vanState = 'out';
        this.vanT = 0;
      } else if (this.vanState === 'out' && this.vanT >= VAN.outSeconds) {
        this.vanState = 'away';
        this.vanT = 0;
      }
      const [px, py] = SALES.vanPark;
      let vy = py;
      if (this.vanState === 'in') {
        const k = Math.min(1, this.vanT / VAN.inSeconds);
        vy = VAN.fromY + (py - VAN.fromY) * (1 - (1 - k) * (1 - k));
      } else if (this.vanState === 'out') {
        const k = Math.min(1, this.vanT / VAN.outSeconds);
        vy = py + (VAN.toY - py) * k * k;
      }
      const iso = new Iso(this.vanG, L.frame);
      van(iso, pal, px, vy, SALES.road.z);
    }

    // 組み立て中：モニターのバー（OSを入れている様子）
    this.barG.clear();
    if (lane === 'asm') {
      let k = 0;
      const tasks = [s.player.task, ...s.workers.filter((w) => w.lane === 'asm').map((w) => w.task)];
      for (const t of tasks) if (t !== null && t.lane === 'asm') k = Math.max(k, 1 - t.remaining / t.total);
      if (k > 0) {
        const [mx, my] = ASSEMBLY.monitorAt;
        const z = ASSEMBLY.desk.top;
        const sy = my + 0.13 + 0.004 + 0.004;
        new Iso(this.barG, L.frame).planeY(sy, mx + 0.5, mx + 0.5 + 0.8 * k, z + 0.84, z + 0.9, pal.screenBar);
      }
    }
  }
}
