import { createRoot } from 'react-dom/client';
import type { Lane } from './core/types';
import { balance } from './data';
import { LocalStorageSaveStore, MemorySaveStore, type SaveStore } from './save';
import {
  openSheet,
  refreshView,
  setResolvedTheme,
  setRuntime,
  setScale,
  setScreen,
  setThemeSetting,
  showAway,
  useGame,
  type SheetKind,
} from './store/game';
import { GameRuntime } from './store/runtime';
import { App, computeScale } from './ui/App';
import './ui/styles.css';
import type { World } from './world/World';

const params = new URLSearchParams(window.location.search);
const seedParam = params.get('seed');
const speedParam = params.get('speed');
const debug = params.get('debug') === '1';

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! >>> 0;
}

/** ?seed=数字 で乱数の種を固定する（新しく始めるとき・やり直すとき） */
const fixedSeed = seedParam !== null && Number.isFinite(Number(seedParam)) ? Math.floor(Number(seedParam)) : null;
/** ?speed=倍率 で時間の進みを速める（0 で止める） */
const speed = speedParam !== null && Number.isFinite(Number(speedParam)) && Number(speedParam) >= 0 ? Number(speedParam) : 1;

function saveStore(): SaveStore {
  try {
    const probe = '__pct_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return new LocalStorageSaveStore(window.localStorage);
  } catch {
    return new MemorySaveStore();
  }
}

async function start(): Promise<void> {
  const runtime = new GameRuntime({
    bal: balance,
    store: saveStore(),
    seed: fixedSeed ?? randomSeed(),
    speed,
    now: () => Date.now(),
    newSeed: () => fixedSeed ?? randomSeed(),
  });
  const away = await runtime.boot();
  setRuntime(runtime);
  showAway(away);

  // 昼夜：設定が「自動」なら端末のダークモードに合わせる
  const dark = window.matchMedia('(prefers-color-scheme: dark)');
  const applyTheme = () => {
    const setting = useGame.getState().themeSetting;
    const theme = setting === 'auto' ? (dark.matches ? 'night' : 'day') : setting;
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'night' ? '#16213A' : '#CFEAF6');
    setResolvedTheme(theme);
  };
  applyTheme();
  dark.addEventListener('change', applyTheme);
  useGame.subscribe((st, prev) => {
    if (st.themeSetting !== prev.themeSetting) applyTheme();
  });

  const onResize = () => setScale(computeScale());
  onResize();
  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);

  refreshView();

  let world: World | null = null;
  let creating = false;
  const onRoomHost = (el: HTMLDivElement) => {
    if (world !== null || creating) return;
    creating = true;
    // PixiJS は部屋を出すときだけ読み込む
    void import('./world/World').then(async ({ World }) => {
      world = await World.create(el, useGame.getState().scale);
      useGame.subscribe((st, prev) => {
        if (st.scale !== prev.scale) world?.setScale(st.scale);
      });
    });
  };

  const root = document.getElementById('root')!;
  createRoot(root).render(<App onRoomHost={onRoomHost} />);

  // 更新の頻度を分ける：core は決まった刻み（タイマー）、React は1秒に uiHz 回、PixiJS は毎フレーム。
  // core をフレームに頼らず進めるので、フレームが間引かれても時間は遅れない
  window.setInterval(() => runtime.frame(performance.now()), balance.tickSeconds * 1000);
  window.setInterval(refreshView, 1000 / balance.display.uiHz);
  const loop = (now: number) => {
    runtime.frame(performance.now());
    world?.render(runtime.state, useGame.getState().theme, now, runtime.drainWorldEvents());
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      runtime.onHidden();
    } else {
      const summary = runtime.onVisible();
      if (summary !== null) showAway(summary);
      refreshView();
    }
  });
  window.addEventListener('pagehide', () => runtime.onHidden());

  if (debug) {
    // テストとスクリーンショット用の窓口（?debug=1 のときだけ）
    Object.assign(window, {
      __pct: {
        state: () => JSON.parse(JSON.stringify(runtime.state)),
        runBot: (seconds: number, opts?: { hire?: boolean; acceptSub?: boolean }) => {
          runtime.debugRunBot(seconds, opts);
          refreshView();
        },
        runUntilCash: (amount: number, maxSeconds = 900) => {
          runtime.debugRunUntilCash(amount, maxSeconds);
          refreshView();
        },
        hold: (seconds: number) => {
          runtime.debugHold(seconds);
          refreshView();
        },
        step: (seconds: number) => {
          runtime.debugStep(seconds);
          refreshView();
        },
        setParts: (parts: Record<string, number>) => {
          runtime.debugSetParts(parts);
          refreshView();
        },
        setScreen: (lane: Lane) => setScreen(lane),
        setTheme: (theme: 'auto' | 'day' | 'night') => setThemeSetting(theme),
        openSheet: (kind: SheetKind) => {
          openSheet(kind);
          refreshView();
        },
        save: () => runtime.save(),
        worldReady: () => world !== null,
      },
    });
  }
}

void start();
