import { useShallow } from 'zustand/react/shallow';
import { openSheet, useGame } from '../store/game';
import { num, secs, yen } from './format';
import { Clock, Settings, TrendingUp, TriangleAlert, Warehouse } from './icons';

export function MoneyBar() {
  const v = useGame(
    useShallow((st) => {
      const view = st.view!;
      return {
        cash: view.cash,
        income: view.incomePerSec,
        pct: view.warehousePct,
        payIn: view.payIn,
        payAmount: view.payAmount,
        payShort: view.payShort,
        grace: view.graceLeft,
      };
    }),
  );
  const grace = v.grace !== null;
  return (
    <header className="money-bar card">
      <div className="mb-row">
        <div className={`cash${v.cash < 0 ? ' neg' : ''}`} data-testid="cash" data-value={Math.round(v.cash)}>
          {yen(v.cash)}
        </div>
        <div className="income pill-money" data-testid="income">
          <TrendingUp size={16} strokeWidth={2.6} />+{num(v.income)}/秒
        </div>
        <button className="gear" aria-label="設定" onClick={() => openSheet('settings')}>
          <Settings size={18} strokeWidth={2.2} />
        </button>
      </div>
      <div className="mb-row mb-sub">
        <Warehouse size={17} strokeWidth={2.2} className="muted-icon" />
        <div className="goal-bar" role="progressbar" aria-valuenow={Math.floor(v.pct)} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${v.pct}%` }} />
        </div>
        <span className="goal-pct">{Math.floor(v.pct)}%</span>
        <span className="divider" />
        {grace ? (
          <span className="grace" data-testid="grace">
            <TriangleAlert size={15} strokeWidth={2.6} />
            あと{secs(v.grace!)}で倒産
          </span>
        ) : (
          <span className={`pay${v.payShort ? ' short' : ''}`} data-testid="pay">
            {v.payShort ? (
              <TriangleAlert size={16} strokeWidth={2.6} />
            ) : (
              <Clock size={17} strokeWidth={2.2} className="muted-icon" />
            )}
            <b>{secs(v.payIn)}</b>
            <span className="bill">{yen(-v.payAmount)}</span>
          </span>
        )}
      </div>
    </header>
  );
}
