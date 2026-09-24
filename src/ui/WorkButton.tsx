import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { game, refreshView, removeFloat, useGame } from '../store/game';
import type { WorkBlock } from '../store/view';
import { Hammer, LANE_VERB, LaneIcon, PartIcon, PcCase, ShoppingBag, User } from './icons';
import { Ring } from './Ring';

/** 押せないときに、足りない物をアイコンと数で出す */
function BlockPill({ block }: { block: WorkBlock }) {
  if (block === null) return null;
  return (
    <span className="block-pill" data-testid="work-block">
      {block.kind === 'junk' && <Hammer size={15} strokeWidth={2.6} />}
      {block.kind === 'parts' && block.missing.map((t) => <PartIcon key={t} part={t} size={15} strokeWidth={2.6} />)}
      {block.kind === 'pcs' && <PcCase size={15} strokeWidth={2.6} />}
      {block.kind === 'orders' && <ShoppingBag size={15} strokeWidth={2.6} />}
      <b>0</b>
    </span>
  );
}

/** 自分の作業で増えた物（分解で取れた部品・組み上がったPC） */
function Floats() {
  const floats = useGame((st) => st.floats);
  return (
    <>
      {floats.map((f) => (
        <span key={f.id} className="work-float" onAnimationEnd={() => removeFloat(f.id)}>
          {f.kind === 'pc' ? (
            <PcCase size={16} strokeWidth={2.6} />
          ) : (
            f.good.map((t) => <PartIcon key={t} part={t} size={15} strokeWidth={2.6} />)
          )}
          <b>+{f.kind === 'pc' ? 1 : f.good.length}</b>
        </span>
      ))}
    </>
  );
}

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
        block: view.block[lane],
        holding: view.holding,
        worker: view.workersByLane[lane] > 0,
        hint: view.hintLane === lane && !view.playerBusy,
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
    <div className="work-area">
      <Floats />
      <button
        className={`work-btn lane-${v.lane}${!v.canWork && !busy ? ' idle' : ''}${v.holding ? ' holding' : ''}${v.hint ? ' hint' : ''}`}
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
        {!busy && <BlockPill block={v.block} />}
        {v.worker && (
          <span className={`baito${!busy && v.block !== null ? ' compact' : ''}`}>
            <User size={16} strokeWidth={2.6} />
            {(busy || v.block === null) && 'バイト'}
          </span>
        )}
      </button>
    </div>
  );
}
