import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { game, removePopup, useGame } from '../store/game';
import { PERSON, ROOM_LAYOUT, STAGE, peopleIn } from '../world/layout';
import { perMin, ratio, signedYen } from './format';
import { TrendingUp, Warehouse } from './icons';

/** 部屋の canvas を置く場所。PixiJS の部屋はここに1つだけ置き、中身は PixiJS が描く */
export function RoomStage({ onHost }: { onHost: (el: HTMLDivElement) => void }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (host.current) onHost(host.current);
  }, [onHost]);
  const screen = useGame((st) => st.view!.screen);
  return (
    <section className={`room room-${screen}`} aria-label="部屋" style={{ top: STAGE.top, height: STAGE.height }}>
      <div className="room-canvas" ref={host} />
      <NameTags />
      <HireBadge />
      <Popups />
      <ClearButton />
    </section>
  );
}

/** 部屋の人の名札（あなた・バイト） */
function NameTags() {
  // 写しが変わるたびに作り直す（人の位置は部屋ごとに決まっている）
  useGame((st) => st.view);
  const r = game();
  const lane = r.state.player.screen;
  const people = peopleIn(r.state, lane);
  return (
    <>
      {people.map((p) => (
        <span
          key={String(p.actor)}
          className={`name-tag${p.worker ? ' worker' : ''}`}
          style={{ left: p.x, top: p.y + PERSON.labelY }}
        >
          {p.worker ? 'バイト' : 'あなた'}
        </span>
      ))}
    </>
  );
}

/** 雇った直後の伸び（予想 → 60秒後に実測） */
function HireBadge() {
  const v = useGame(useShallow((st) => ({ badge: st.view!.hireBadge, screen: st.view!.screen })));
  if (v.badge === null) return null;
  const pos = ROOM_LAYOUT[v.screen].badge;
  const r = ratio(v.badge.after, v.badge.now);
  return (
    <div className="hire-badge" data-testid="hire-badge" data-measured={v.badge.measured} style={{ left: pos.x, top: pos.y }}>
      <TrendingUp size={22} strokeWidth={2.6} />
      <div>
        <b>{r ?? `+${perMin(v.badge.after)}`}</b>
        <small>
          {perMin(v.badge.now)}→{perMin(v.badge.after)}台/分
        </small>
      </div>
    </div>
  );
}

/** 売れた瞬間の「+¥16,320」 */
function Popups() {
  const v = useGame(useShallow((st) => ({ popups: st.popups, screen: st.view!.screen })));
  const pos = ROOM_LAYOUT[v.screen].popup;
  return (
    <>
      {v.popups.map((p) => (
        <span
          key={p.id}
          className={`popup ${p.kind}`}
          style={{ left: pos.x - (p.id % 2) * 16, top: pos.y + (p.id % 3) * 26 }}
          onAnimationEnd={() => removePopup(p.id)}
        >
          {signedYen(p.amount)}
        </span>
      ))}
    </>
  );
}

/** 所持金が貸し倉庫の初期費用に届いたら出す */
function ClearButton() {
  const ready = useGame((st) => st.view!.clearReady);
  if (!ready) return null;
  return (
    <button className="clear-btn" data-testid="move-warehouse" onClick={() => game().moveToWarehouse()}>
      <Warehouse size={20} strokeWidth={2.4} />
      貸し倉庫へ移る
    </button>
  );
}
