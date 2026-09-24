import { useShallow } from 'zustand/react/shallow';
import { game, refreshView, showAway, useGame } from '../store/game';
import { duration, num, signedYen, yen } from './format';
import { Clock, Coffee, LANE_NAME, LaneIcon, Package, RotateCcw, TrendingUp, TriangleAlert, Trophy, User, X } from './icons';

function restart() {
  game().restart();
  refreshView();
}

/** 倒産・段階1クリア・戻ってきたときのまとめ */
export function Overlays() {
  const v = useGame(
    useShallow((st) => ({
      status: st.view!.status,
      stats: st.view!.stats,
      away: st.away,
    })),
  );
  if (v.status === 'bankrupt') {
    return (
      <div className="overlay" role="dialog" aria-label="倒産" data-testid="bankrupt">
        <div className="overlay-card">
          <span className="overlay-icon bad">
            <TriangleAlert size={40} strokeWidth={2.2} />
          </span>
          <h2>倒産</h2>
          <div className="stat-row bad">
            <Clock size={18} strokeWidth={2.4} />
            支払い不足
            <b>{yen(v.stats.bankruptCash ?? 0)}</b>
          </div>
          <button className="btn-dark wide" data-testid="restart-bankrupt" onClick={restart}>
            <RotateCcw size={20} strokeWidth={2.4} />
            最初から
          </button>
        </div>
      </div>
    );
  }
  if (v.status === 'cleared') {
    return (
      <div className="overlay" role="dialog" aria-label="段階1クリア" data-testid="cleared">
        <div className="overlay-card">
          <span className="overlay-icon good">
            <Trophy size={40} strokeWidth={2.2} />
          </span>
          <h2>段階1クリア</h2>
          <div className="stat-row">
            <Clock size={18} strokeWidth={2.4} />
            クリアまで
            <b>{duration(v.stats.clearedAt ?? 0)}</b>
          </div>
          <div className="stat-row">
            <Package size={18} strokeWidth={2.4} />
            売った台数
            <b>{num(v.stats.sold)}台</b>
          </div>
          <div className="stat-row">
            <User size={18} strokeWidth={2.4} />
            雇った人数
            <b>{num(v.stats.hires)}人</b>
          </div>
          <button className="btn-dark wide" data-testid="restart-cleared" onClick={restart}>
            <RotateCcw size={20} strokeWidth={2.4} />
            最初から
          </button>
        </div>
      </div>
    );
  }
  const a = v.away;
  if (a !== null) {
    return (
      <div className="overlay" role="dialog" aria-label="おかえり" data-testid="away">
        <div className="overlay-card">
          <span className="overlay-icon">
            <Clock size={40} strokeWidth={2.2} />
          </span>
          <h2>{duration(a.requestedSeconds)}</h2>
          <div className="stat-row">
            <TrendingUp size={18} strokeWidth={2.4} />
            売上
            <b className="good">{signedYen(a.revenue)}</b>
          </div>
          <div className="stat-row">
            <Package size={18} strokeWidth={2.4} />
            売った台数
            <b>{num(a.sold)}台</b>
          </div>
          <div className="stat-row">
            <X size={18} strokeWidth={2.4} />
            逃した注文
            <b className={a.lost > 0 ? 'bad' : undefined}>{num(a.lost)}件</b>
          </div>
          {a.bottleneck !== null && (
            <div className="stat-row">
              <TriangleAlert size={18} strokeWidth={2.4} />
              詰まり
              <b className={`lane-chip lane-${a.bottleneck}`}>
                <LaneIcon lane={a.bottleneck} size={16} strokeWidth={2.6} />
                {LANE_NAME[a.bottleneck]}
              </b>
            </div>
          )}
          {a.workersRested && (
            <div className="stat-row bad">
              <Coffee size={18} strokeWidth={2.4} />
              バイト休み
              <b>{yen(a.cashAfter)}</b>
            </div>
          )}
          <button className="btn-dark wide" data-testid="away-ok" onClick={() => showAway(null)}>
            OK
          </button>
        </div>
      </div>
    );
  }
  return null;
}
