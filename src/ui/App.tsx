import { useEffect, useRef } from 'react';
import type { Lane } from '../core/types';
import { setScreen, useGame } from '../store/game';
import { STAGE } from '../world/layout';
import { MoneyBar } from './MoneyBar';
import { Overlays } from './overlays';
import { LanePanel } from './panels';
import { RoomStage } from './RoomStage';
import { SheetHost } from './sheets';
import { SwitchBar } from './SwitchBar';
import { TabBar } from './TabBar';
import { WorkButton } from './WorkButton';

export const BASE_WIDTH = 390;
export const BASE_HEIGHT = 844;
const LANES: Lane[] = ['dis', 'asm', 'ship'];
/** 画面の切り替えとみなす横の移動（基準の画面でのピクセル） */
const SWIPE_MIN = 44;

function moveLane(dir: 1 | -1): void {
  const view = useGame.getState().view;
  if (view === null) return;
  const i = LANES.indexOf(view.screen) + dir;
  if (i >= 0 && i < LANES.length) setScreen(LANES[i]!);
}

/**
 * 画面全体。390×844 を基準に端末の幅に合わせて拡大縮小し、縦長の端末では上下に余白を足す。
 * スワイプは画面全体を包むこの要素で受け取る（部屋の canvas には取らせない）。
 */
export function App({ onRoomHost }: { onRoomHost: (el: HTMLDivElement) => void }) {
  const ready = useGame((st) => st.view !== null);
  const screen = useGame((st) => st.view?.screen ?? 'dis');
  const scale = useGame((st) => st.scale);
  const blocked = useGame((st) => st.sheet !== null || st.away !== null || (st.view !== null && st.view.status !== 'playing'));
  const start = useRef<{ x: number; y: number; id: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useGame.getState().sheet !== null) return;
      if (e.key === 'ArrowLeft') moveLane(-1);
      else if (e.key === 'ArrowRight') moveLane(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!ready) return null;
  const w = window.innerWidth;
  const h = window.innerHeight;
  return (
    <div
      className="frame"
      data-testid="frame"
      onPointerDown={(e) => {
        const target = e.target as Element;
        if (blocked || target.closest('[data-noswipe]')) {
          start.current = null;
          return;
        }
        start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      }}
      onPointerUp={(e) => {
        const s = start.current;
        start.current = null;
        if (s === null || s.id !== e.pointerId) return;
        const dx = (e.clientX - s.x) / scale;
        const dy = (e.clientY - s.y) / scale;
        if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.4) moveLane(dx < 0 ? 1 : -1);
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
    >
      <div
        className="app"
        data-lane={screen}
        style={{
          left: Math.max(0, (w - BASE_WIDTH * scale) / 2),
          top: Math.max(0, (h - BASE_HEIGHT * scale) / 2),
          transform: `scale(${scale})`,
        }}
      >
        <MoneyBar />
        <SwitchBar />
        <RoomStage onHost={onRoomHost} />
        <LanePanel />
        <WorkButton />
        <TabBar />
        <SheetHost />
        <Overlays />
      </div>
    </div>
  );
}

export function computeScale(): number {
  return Math.min(window.innerWidth / BASE_WIDTH, window.innerHeight / BASE_HEIGHT);
}

export { STAGE };
