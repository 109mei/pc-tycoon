import { Fragment } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Lane } from '../core/types';
import { setScreen, useGame } from '../store/game';
import { ChevronRight, LANE_NAME, LaneIcon, User } from './icons';

const LANES: Lane[] = ['dis', 'asm', 'ship'];

/** 生産 → 制作 → 販売 の切り替え。たまっている量、詰まりの「！」、アルバイトの印 */
export function SwitchBar() {
  const v = useGame(
    useShallow((st) => ({
      screen: st.view!.screen,
      dis: st.view!.counts.dis,
      asm: st.view!.counts.asm,
      ship: st.view!.counts.ship,
      stuck: st.view!.bottleneck,
      wDis: st.view!.workersByLane.dis,
      wAsm: st.view!.workersByLane.asm,
      wShip: st.view!.workersByLane.ship,
    })),
  );
  const count: Record<Lane, number> = { dis: v.dis, asm: v.asm, ship: v.ship };
  const workers: Record<Lane, number> = { dis: v.wDis, asm: v.wAsm, ship: v.wShip };
  return (
    <nav className="switch-bar" aria-label="列の切り替え">
      {LANES.map((lane, i) => (
        <Fragment key={lane}>
          {i > 0 && <ChevronRight className="switch-arrow" size={20} strokeWidth={2.6} aria-hidden="true" />}
          <button
            className={`lane-btn lane-${lane}${v.screen === lane ? ' active' : ''}`}
            aria-pressed={v.screen === lane}
            data-testid={`switch-${lane}`}
            onClick={() => setScreen(lane)}
          >
            <LaneIcon lane={lane} size={19} strokeWidth={2.4} />
            <span className="lane-name">{LANE_NAME[lane]}</span>
            <span className="lane-count" data-testid={`count-${lane}`}>
              {count[lane]}
            </span>
            {v.stuck === lane && (
              <span className="bang" data-testid={`stuck-${lane}`} aria-label="詰まり">
                !
              </span>
            )}
            {workers[lane] > 0 && (
              <span className="worker-mark" aria-label={`アルバイト${workers[lane]}人`}>
                <User size={13} strokeWidth={2.8} />
                {workers[lane] > 1 && <small>{workers[lane]}</small>}
              </span>
            )}
          </button>
        </Fragment>
      ))}
    </nav>
  );
}
