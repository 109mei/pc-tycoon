/**
 * 手触りの目安（SPEC 5章）を測って表示する。npm run sim
 * ルール本体と Smart ボットを種を変えて100回動かした中央値。
 */
import { balance } from '../src/data';
import { formatSummary, measure, POLICIES } from '../tests/helpers/feel';

for (const name of Object.keys(POLICIES)) {
  const f = measure(balance, name);
  console.log(formatSummary(f));
}
