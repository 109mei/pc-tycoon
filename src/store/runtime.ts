import * as core from '../core';
import type { AwaySummary, GameEvent, GameState, Lane } from '../core';
import type { Balance } from '../data/schema';
import { exportText, importText, SAVE_VERSION, type SaveData, type SaveStore, type Settings } from '../save';

export interface RuntimeOptions {
  bal: Balance;
  store: SaveStore;
  /** 新しく始めるときの乱数の種 */
  seed: number;
  /** 時間の進みの倍率（?speed=） */
  speed: number;
  /** 実際の時刻（ミリ秒）。ルール本体には渡さず、セーブと不在の計算にだけ使う */
  now: () => number;
  /** 最初からやり直すときの種を作る */
  newSeed: () => number;
}

/**
 * ルール本体を動かす係。状態の持ち主は core で、ここは命令を渡し、決まった刻みで進め、保存するだけ。
 * 画面（React）と部屋（PixiJS）はここから状態を読む。
 */
export class GameRuntime {
  state!: GameState;
  settings: Settings = { theme: 'auto' };
  readonly bal: Balance;
  private readonly store: SaveStore;
  private readonly speed: number;
  private readonly now: () => number;
  private readonly newSeed: () => number;
  private seed: number;
  private acc = 0;
  private lastFrameMs: number | null = null;
  private lastSaveMs = 0;
  private savedAt = 0;
  private hidden = false;
  private uiEvents: GameEvent[] = [];
  private worldEvents: GameEvent[] = [];

  constructor(opts: RuntimeOptions) {
    this.bal = opts.bal;
    this.store = opts.store;
    this.speed = opts.speed;
    this.now = opts.now;
    this.seed = opts.seed;
    this.newSeed = opts.newSeed;
  }

  /** セーブを読み込み、閉じていた間を進める。セーブがなければ新しく始める */
  async boot(): Promise<AwaySummary | null> {
    let data: SaveData | null = null;
    try {
      data = await this.store.load();
    } catch {
      data = null;
    }
    if (data === null) {
      this.state = core.createState(this.bal, this.seed);
      this.save();
      return null;
    }
    this.state = data.state;
    this.settings = data.settings;
    this.savedAt = data.savedAt;
    return this.catchUp((this.now() - data.savedAt) / 1000);
  }

  /** 閉じていた間の進行。短すぎる不在はまとめを出さない */
  private catchUp(seconds: number): AwaySummary | null {
    if (this.state.status !== 'playing' || !(seconds >= this.bal.tickSeconds)) return null;
    const summary = core.simulateAway(this.state, this.bal, seconds);
    core.returnFromAway(this.state, this.bal, summary.seconds);
    this.save();
    return summary.requestedSeconds >= this.bal.display.awaySummaryMinSeconds ? summary : null;
  }

  /** タイマーと毎フレームから呼ぶ。経った時間ぶん、決まった刻みでルール本体を進める */
  frame(nowMs: number): void {
    if (this.hidden) return;
    if (this.lastFrameMs === null) {
      this.lastFrameMs = nowMs;
      this.lastSaveMs = nowMs;
      return;
    }
    // 時刻が戻ったときは数えない（同じ時間を二重に進めないため）
    if (nowMs <= this.lastFrameMs) return;
    const dt = (nowMs - this.lastFrameMs) / 1000;
    this.lastFrameMs = nowMs;
    const tick = this.bal.tickSeconds;
    const maxTicks = this.bal.display.maxTicksPerFrame;
    this.acc += dt * this.speed;
    let n = 0;
    while (this.acc >= tick - 1e-9 && n < maxTicks) {
      this.push(core.step(this.state, this.bal));
      this.acc -= tick;
      n += 1;
    }
    if (n >= maxTicks) this.acc = 0;
    if (nowMs - this.lastSaveMs >= this.bal.save.autosaveSeconds * 1000) {
      this.lastSaveMs = nowMs;
      this.save();
    }
  }

  private push(ev: GameEvent[]): void {
    if (ev.length === 0) return;
    this.uiEvents.push(...ev);
    this.worldEvents.push(...ev);
  }

  /** 画面の効果（「+¥」など）に使う出来事を取り出す */
  drainEvents(): GameEvent[] {
    const out = this.uiEvents;
    this.uiEvents = [];
    return out;
  }

  /** 部屋の動き（部品が飛ぶ・バンが来る）に使う出来事を取り出す */
  drainWorldEvents(): GameEvent[] {
    const out = this.worldEvents;
    this.worldEvents = [];
    return out;
  }

  save(): void {
    const data: SaveData = {
      saveVersion: SAVE_VERSION,
      savedAt: this.now(),
      screen: this.state.player.screen,
      settings: { ...this.settings },
      state: this.state,
    };
    this.savedAt = data.savedAt;
    this.store.save(data).catch(() => undefined);
  }

  /** 画面が隠れたとき：保存して止める */
  onHidden(): void {
    if (this.hidden) return;
    core.workHold(this.state, this.bal, this.state.player.screen, false);
    this.save();
    this.hidden = true;
  }

  /** 戻ってきたとき：隠れていた間を不在として進める */
  onVisible(): AwaySummary | null {
    if (!this.hidden) return null;
    this.hidden = false;
    this.lastFrameMs = null;
    this.acc = 0;
    return this.catchUp((this.now() - this.savedAt) / 1000);
  }

  // ------------------------------------------------------------ 命令

  get screen(): Lane {
    return this.state.player.screen;
  }

  workTap(): void {
    this.push(core.workTap(this.state, this.bal, this.state.player.screen));
  }

  workHold(pressed: boolean): void {
    this.push(core.workHold(this.state, this.bal, this.state.player.screen, pressed));
  }

  setScreen(lane: Lane): void {
    core.setScreen(this.state, lane);
  }

  buyJunk(count: number): void {
    this.push(core.buyJunk(this.state, this.bal, count));
  }

  setAutoBuy(on: boolean): void {
    core.setAutoBuy(this.state, on);
  }

  buyMissingParts(): void {
    this.push(core.buyMissingParts(this.state, this.bal));
  }

  setPriceLevel(level: number): void {
    this.push(core.setPriceLevel(this.state, this.bal, level));
  }

  forecast(lane: Lane): core.HireForecast {
    return core.forecastHire(this.state, this.bal, lane);
  }

  hire(lane: Lane, forecast?: core.HireForecast): boolean {
    const ev = core.hire(this.state, this.bal, lane, forecast ? { forecast } : {});
    this.push(ev);
    if (ev.length > 0) this.save();
    return ev.length > 0;
  }

  reassignWorker(id: number, lane: Lane): void {
    core.reassignWorker(this.state, id, lane);
    this.save();
  }

  acceptSubcontract(): void {
    const ev = core.acceptSubcontract(this.state, this.bal);
    this.push(ev);
    if (ev.length > 0) this.save();
  }

  setSubcontractPriority(on: boolean): void {
    core.setSubcontractPriority(this.state, on);
  }

  moveToWarehouse(): void {
    const ev = core.moveToWarehouse(this.state, this.bal);
    this.push(ev);
    if (ev.length > 0) this.save();
  }

  restart(): void {
    this.seed = this.newSeed();
    this.state = core.restart(this.bal, this.seed);
    this.uiEvents = [];
    this.worldEvents = [];
    this.acc = 0;
    this.save();
  }

  setTheme(theme: Settings['theme']): void {
    this.settings = { ...this.settings, theme };
    this.save();
  }

  exportSave(): string {
    return exportText({
      saveVersion: SAVE_VERSION,
      savedAt: this.now(),
      screen: this.state.player.screen,
      settings: { ...this.settings },
      state: this.state,
    });
  }

  /** 書き出したテキストを読み込む。読めなければ例外 */
  importSave(text: string): void {
    const data = importText(text);
    this.state = data.state;
    this.settings = data.settings;
    this.uiEvents = [];
    this.worldEvents = [];
    this.acc = 0;
    this.save();
  }

  // ------------------------------------------------------------ テスト・スクリーンショット用（?debug=1 のときだけ公開）

  /** Smart ボットで seconds 秒進める */
  debugRunBot(seconds: number, opts: { hire?: boolean; acceptSub?: boolean } = {}): void {
    const policy = core.smartPolicy({ hire: opts.hire ?? true, useSub: opts.acceptSub ?? true });
    core.runPolicy(this.state, this.bal, seconds, policy, (ev) => {
      this.push(ev);
    });
  }

  /** 所持金が amount 以上になるまで Smart ボットで進める（雇わない） */
  debugRunUntilCash(amount: number, maxSeconds: number): void {
    const policy = core.smartPolicy({ hire: false });
    core.runPolicy(this.state, this.bal, maxSeconds, policy, (ev, s) => {
      this.push(ev);
      return s.cash >= amount;
    });
  }

  /** 今の画面で長押しを続けたまま seconds 秒進める */
  debugHold(seconds: number): void {
    core.workHold(this.state, this.bal, this.state.player.screen, true);
    const n = Math.round(seconds / this.bal.tickSeconds);
    for (let i = 0; i < n; i++) this.push(core.step(this.state, this.bal));
    core.workHold(this.state, this.bal, this.state.player.screen, false);
  }

  /** テストの準備：部品の数を決める（?debug=1 のときだけ） */
  debugSetParts(parts: Partial<core.Parts>): void {
    for (const t of core.PART_TYPES) if (parts[t] !== undefined) this.state.parts[t] = Math.max(0, Math.floor(parts[t]!));
  }

  debugStep(seconds: number): void {
    const n = Math.round(seconds / this.bal.tickSeconds);
    for (let i = 0; i < n; i++) this.push(core.step(this.state, this.bal));
  }
}
