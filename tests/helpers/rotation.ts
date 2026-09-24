import { acceptSubcontract, buyJunk, hire, setScreen } from '../../src/core/commands';
import type { Policy } from '../../src/core/bot';
import { canStart, startPlayerTask } from '../../src/core/tasks';
import { LANES } from '../../src/core/types';

/** 切れたらまとめて買う台数（sim_stage1.py の Rotation と同じ） */
const BULK_BUY = 5;
/** 雇う列の順番 */
const HIRE_ORDER = ['dis', 'ship'] as const;

/**
 * 対照群：状況を見ない。分解→組立→発送を順番に回し、仕入れは切れたらまとめ買い、
 * 雇えるならすぐ雇う（分解担当から）。docs/sim_stage1.py の Rotation の移植。
 */
export function rotationPolicy(useSub = true): Policy {
  let i = 0;
  return {
    name: useSub ? 'rotation' : 'rotation_nosub',
    init(s) {
      s.autoBuy = false;
    },
    act(s, bal, ev) {
      if (s.junk === 0) ev.push(...buyJunk(s, bal, BULK_BUY));
      if (s.workers.length < bal.workers.maxCount && s.cash >= bal.workers.hireCost) {
        ev.push(...hire(s, bal, HIRE_ORDER[s.workers.length % 2]!));
      }
      if (useSub && s.offer !== null) ev.push(...acceptSubcontract(s, bal));
      if (s.player.task !== null) return;
      for (let k = 0; k < 3; k++) {
        const lane = LANES[(i + k) % 3]!;
        if (lane === 'asm' && s.sub !== null && s.sub.kits > 0 && !canStart(s, bal, 'asm', 'parts')) {
          i = (i + k + 1) % 3;
          setScreen(s, 'asm');
          startPlayerTask(s, bal, 'asm', 'kit', ev);
          return;
        }
        if (canStart(s, bal, lane, 'parts')) {
          i = (i + k + 1) % 3;
          setScreen(s, lane);
          startPlayerTask(s, bal, lane, 'parts', ev);
          return;
        }
      }
    },
  };
}
