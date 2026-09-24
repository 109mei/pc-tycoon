import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { game, refreshView, useGame } from '../store/game';
import { LANE_VERB, LaneIcon, User } from './icons';
import { Ring } from './Ring';

/**
 * 今いる列の作業ボタン。タップで1回、長押しで材料がある限り続ける。
 * 押した瞬間に1回目を始め、離したら次は始めない（作業中の分は完了まで進む）。
 */
export function WorkButton() {
  const v = useGame(
    useShallow((st) => {
      const view = st.view!;
      const lane = view.screen;
      return {
        lane,
        progress: view.playerProgress[lane],
        canWork: view.canWork[lane],
        holding: view.holding,
        worker: view.workersByLane[lane] > 0,
      };
    }),
  );
  const pressed = useRef(false);
  const release = () => {
    if (!pressed.current) return;
    pressed.current = false;
    game().workHold(false);
    refreshView();
  };
  const busy = v.progress !== null;
  return (
    <button
      className={`work-btn lane-${v.lane}${!v.canWork && !busy ? ' idle' : ''}${v.holding ? ' holding' : ''}`}
      data-testid="work"
      data-noswipe=""
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        pressed.current = true;
        game().workHold(true);
        refreshView();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
          e.preventDefault();
          game().workTap();
          refreshView();
        }
      }}
    >
      <span className="work-ring">
        <Ring value={v.progress ?? 0} size={58} width={5} color="var(--work-ring)" track="var(--work-track)" />
        <LaneIcon lane={v.lane} size={26} strokeWidth={2.4} />
      </span>
      <span className="verb">{LANE_VERB[v.lane]}</span>
      {v.worker && (
        <span className="baito">
          <User size={16} strokeWidth={2.6} />
          バイト
        </span>
      )}
    </button>
  );
}
