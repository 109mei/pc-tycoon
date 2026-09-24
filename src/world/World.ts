import { Application, Container, Graphics } from 'pixi.js';
import type { GameState, Lane } from '../core/types';
import type { Balance } from '../data/schema';
import { ROOM_LAYOUT, STAGE, peopleIn } from './layout';
import { roomPalette, type Theme } from './palette';
import { drawPeople, drawProgressRings } from './people';
import { drawRoomShell, roomScene } from './rooms';
import { drawEdgeGlow } from './shell';

/**
 * 部屋の描画（PixiJS）。ルール本体の状態を毎フレーム読んで描くだけで、状態は書き換えない。
 * 文字は描かない（名札や「+¥」は HTML 側）。
 */
export class World {
  private readonly shellG = new Graphics();
  private readonly glowG = new Graphics();
  private readonly sceneG = new Graphics();
  private readonly peopleG = new Graphics();
  private readonly ringsG = new Graphics();
  private lane: Lane | null = null;
  private theme: Theme | null = null;
  private sceneKey = '';
  private glowLane: Lane | null = null;

  private constructor(private readonly app: Application) {
    const root = new Container();
    root.addChild(this.shellG, this.glowG, this.sceneG, this.peopleG, this.ringsG);
    app.stage.addChild(root);
  }

  /** host の中に canvas を1つ置く。scale は基準の画面（390×844）からの拡大率 */
  static async create(host: HTMLElement, scale: number): Promise<World> {
    const app = new Application();
    await app.init({
      width: STAGE.width,
      height: STAGE.height,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: World.resolutionFor(scale),
      preference: 'webgl',
      autoStart: false,
      sharedTicker: false,
    });
    app.canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(app.canvas);
    return new World(app);
  }

  private static resolutionFor(scale: number): number {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return Math.min(4, Math.max(1, dpr * scale));
  }

  setScale(scale: number): void {
    const res = World.resolutionFor(scale);
    if (Math.abs(this.app.renderer.resolution - res) < 0.01) return;
    this.app.renderer.resolution = res;
    this.app.renderer.resize(STAGE.width, STAGE.height);
  }

  /** 毎フレーム呼ぶ。見ている部屋（今いる画面）を描く */
  render(s: GameState, bal: Balance, theme: Theme, nowMs: number): void {
    const lane = s.player.screen;
    const pal = roomPalette(theme);
    const L = ROOM_LAYOUT[lane];
    const roomChanged = lane !== this.lane || theme !== this.theme;
    if (roomChanged) {
      this.shellG.clear();
      drawRoomShell(this.shellG, lane, pal);
      this.lane = lane;
      this.theme = theme;
      this.sceneKey = '';
      this.glowLane = null;
    }

    // 詰まっている列なら床の縁を光らせる
    const stuck = s.bottleneck.shown === lane;
    if (stuck && this.glowLane !== lane) {
      this.glowG.clear();
      drawEdgeGlow(this.glowG, L, pal.laneEdge[lane]);
      this.glowLane = lane;
    }
    this.glowG.visible = stuck;
    if (stuck) this.glowG.alpha = 0.7 + 0.3 * Math.sin(nowMs / 260);

    const scene = roomScene(lane, s, bal);
    const key = `${theme}|${scene.key}`;
    if (key !== this.sceneKey) {
      this.sceneG.clear();
      scene.draw(this.sceneG, pal);
      this.sceneKey = key;
    }

    const people = peopleIn(s, lane);
    this.peopleG.clear();
    drawPeople(this.peopleG, pal, people);
    this.ringsG.clear();
    drawProgressRings(this.ringsG, pal, people, lane);

    this.app.render();
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}
