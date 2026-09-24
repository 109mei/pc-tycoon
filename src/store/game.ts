import { create } from 'zustand';
import type { AwaySummary, HireForecast, Lane } from '../core';
import type { Settings } from '../save';
import type { Theme } from '../world/palette';
import type { GameRuntime } from './runtime';
import { buildView, type ViewModel } from './view';

/**
 * 画面（React）への橋渡し。ルール本体の写し（view）と、画面だけの状態（開いているシートなど）を持つ。
 * 所持金などは1秒に10回ほど写し直す。書き換えはすべて runtime の命令を通す。
 */

export type SheetKind = 'staff' | 'contract' | 'acquire' | 'finance' | 'settings';

export interface Popup {
  id: number;
  amount: number;
  kind: 'sale' | 'fee';
}

export interface GameStore {
  view: ViewModel | null;
  sheet: SheetKind | null;
  hireLane: Lane;
  forecast: (HireForecast & { lane: Lane }) | null;
  away: AwaySummary | null;
  popups: Popup[];
  themeSetting: Settings['theme'];
  theme: Theme;
  /** 基準の画面（390×844）からの拡大率 */
  scale: number;
}

export const useGame = create<GameStore>(() => ({
  view: null,
  sheet: null,
  hireLane: 'asm',
  forecast: null,
  away: null,
  popups: [],
  themeSetting: 'auto',
  theme: 'day',
  scale: 1,
}));

/** 「+¥」を一度の写し直しで出す数と、同時に出す数の上限 */
const MAX_NEW_POPUPS = 2;
const MAX_POPUPS = 4;

let runtime: GameRuntime | null = null;
let popupId = 1;
let forecastAt = -Infinity;

export function setRuntime(r: GameRuntime): void {
  runtime = r;
  useGame.setState({ themeSetting: r.settings.theme });
}

export function game(): GameRuntime {
  if (runtime === null) throw new Error('runtime がまだない');
  return runtime;
}

/** ルール本体の写しを作り直す（1秒に10回ほど） */
export function refreshView(): void {
  const r = game();
  const patch: Partial<GameStore> = { view: buildView(r.state, r.bal) };
  const popups: Popup[] = [];
  for (const e of r.drainEvents()) {
    if (e.type === 'sold') popups.push({ id: popupId++, amount: e.amount, kind: 'sale' });
    else if (e.type === 'subFee') popups.push({ id: popupId++, amount: e.amount, kind: 'fee' });
  }
  const st = useGame.getState();
  // 早送りなどで一度にたくさん来ても、重ならないよう新しい分だけ出す
  if (popups.length > 0) patch.popups = [...st.popups, ...popups.slice(-MAX_NEW_POPUPS)].slice(-MAX_POPUPS);
  // 雇うシートを開いている間は、予想を1秒ごとに出し直す
  if (st.sheet === 'staff' && r.state.t - forecastAt >= 1) updateForecast(st.hireLane);
  useGame.setState(patch);
}

function updateForecast(lane: Lane): void {
  const r = game();
  forecastAt = r.state.t;
  const f = r.forecast(lane);
  useGame.setState({ forecast: { ...f, lane } });
}

export function removePopup(id: number): void {
  useGame.setState((st) => ({ popups: st.popups.filter((p) => p.id !== id) }));
}

// ------------------------------------------------------------ 画面の操作

export function openSheet(kind: SheetKind): void {
  if (kind === 'staff') {
    const r = game();
    const stuck = r.state.bottleneck.shown;
    const taken = new Set(r.state.workers.map((w) => w.lane));
    const lane: Lane = stuck ?? (['asm', 'dis', 'ship'] as const).find((l) => !taken.has(l)) ?? 'asm';
    useGame.setState({ hireLane: lane });
    updateForecast(lane);
  }
  useGame.setState({ sheet: kind });
}

export function closeSheet(): void {
  useGame.setState({ sheet: null });
}

export function setHireLane(lane: Lane): void {
  useGame.setState({ hireLane: lane });
  updateForecast(lane);
}

export function hireSelected(): void {
  const r = game();
  const { hireLane, forecast } = useGame.getState();
  const f = forecast !== null && forecast.lane === hireLane ? forecast : r.forecast(hireLane);
  if (r.hire(hireLane, { now: f.now, after: f.after })) {
    useGame.setState({ sheet: null });
    refreshView();
  }
}

export function setScreen(lane: Lane): void {
  game().setScreen(lane);
  refreshView();
}

export function showAway(summary: AwaySummary | null): void {
  useGame.setState({ away: summary });
}

export function setThemeSetting(theme: Settings['theme']): void {
  game().setTheme(theme);
  useGame.setState({ themeSetting: theme });
}

export function setResolvedTheme(theme: Theme): void {
  if (useGame.getState().theme !== theme) useGame.setState({ theme });
}

export function setScale(scale: number): void {
  if (useGame.getState().scale !== scale) useGame.setState({ scale });
}
