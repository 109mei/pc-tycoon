import { useRef, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Lane } from '../core/types';
import { closeSheet, game, hireSelected, refreshView, setHireLane, setThemeSetting, useGame } from '../store/game';
import { perMin, ratio, secs, yen } from './format';
import {
  Check,
  ChartNoAxesColumn,
  Clock,
  Copy,
  Download,
  FileText,
  JapaneseYen,
  LANE_VERB,
  LaneIcon,
  Lock,
  Moon,
  RotateCcw,
  Settings,
  Sun,
  SunMoon,
  TriangleAlert,
  Upload,
  User,
  X,
  Zap,
} from './icons';
import { Ring } from './Ring';

const LANES: Lane[] = ['dis', 'asm', 'ship'];

/** 下から引き出すシート。下へスワイプか×で閉じる */
function Sheet({ title, icon, tone, children, testId }: { title: string; icon: ReactNode; tone: string; children: ReactNode; testId: string }) {
  const start = useRef<{ y: number; id: number } | null>(null);
  const [drag, setDrag] = useState(0);
  const end = () => {
    if (drag > 70) closeSheet();
    start.current = null;
    setDrag(0);
  };
  return (
    <>
      <div className="sheet-backdrop" onClick={closeSheet} />
      <section
        className="sheet"
        role="dialog"
        aria-label={title}
        data-testid={testId}
        data-noswipe=""
        style={drag > 0 ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
      >
        <div
          className="sheet-grip"
          onPointerDown={(e) => {
            start.current = { y: e.clientY, id: e.pointerId };
            e.currentTarget.setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (start.current === null) return;
            const scale = e.currentTarget.getBoundingClientRect().width / e.currentTarget.offsetWidth || 1;
            setDrag(Math.max(0, (e.clientY - start.current.y) / scale));
          }}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <span className="grip-bar" />
          <div className="sheet-head">
            <span className={`sheet-icon ${tone}`}>{icon}</span>
            <h2>{title}</h2>
            <button className="sheet-close" aria-label="閉じる" data-testid="sheet-close" onClick={closeSheet} onPointerDown={(e) => e.stopPropagation()}>
              <X size={24} strokeWidth={2.4} />
            </button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </section>
    </>
  );
}

export function SheetHost() {
  const sheet = useGame((st) => st.sheet);
  if (sheet === 'staff') return <StaffSheet />;
  if (sheet === 'contract') return <ContractSheet />;
  if (sheet === 'acquire') return <AcquireSheet />;
  if (sheet === 'finance') return <FinanceSheet />;
  if (sheet === 'settings') return <SettingsSheet />;
  return null;
}

// ---------------------------------------------------------------- 社員（アルバイト）

function StaffSheet() {
  const v = useGame(
    useShallow((st) => {
      const view = st.view!;
      return {
        hireCost: view.hireCost,
        wage: view.wage,
        speed: view.workerSpeed,
        interval: view.payInterval,
        cash: view.cash,
        canHire: view.canHire,
        bill: view.billAfterHire,
        workers: view.workers,
        max: view.maxWorkers,
        stuck: view.bottleneck,
        counts: view.counts,
        lane: st.hireLane,
        forecast: st.forecast,
      };
    }),
  );
  const full = v.workers.length >= v.max;
  const left = v.cash - v.hireCost;
  const payOk = left >= v.bill;
  const f = v.forecast !== null && v.forecast.lane === v.lane ? v.forecast : null;
  const top = f ? Math.max(f.now, f.after, 0.1) : 1;
  return (
    <Sheet title="アルバイト" icon={<User size={24} strokeWidth={2.4} />} tone="tone-asm" testId="sheet-staff">
      {!full && (
        <>
          <div className="tiles">
            <div className="tile">
              <JapaneseYen size={20} strokeWidth={2.2} />
              <b>{yen(v.hireCost)}</b>
              <small>雇用費</small>
            </div>
            <div className="tile">
              <Clock size={20} strokeWidth={2.2} />
              <b>{yen(v.wage)}</b>
              <small>{v.interval}秒ごと</small>
            </div>
            <div className="tile">
              <Zap size={20} strokeWidth={2.2} />
              <b>×{v.speed}</b>
              <small>速さ</small>
            </div>
          </div>
          <div className="lane-pick" role="radiogroup" aria-label="担当">
            {LANES.map((lane) => (
              <button
                key={lane}
                role="radio"
                aria-checked={v.lane === lane}
                className={`pick lane-${lane}${v.lane === lane ? ' active' : ''}`}
                data-testid={`hire-lane-${lane}`}
                onClick={() => setHireLane(lane)}
              >
                <LaneIcon lane={lane} size={22} strokeWidth={2.4} />
                {LANE_VERB[lane]}
                {v.stuck === lane && <span className="pick-badge">{v.counts[lane]}</span>}
              </button>
            ))}
          </div>
          <div className="forecast" data-testid="forecast">
            <div className="fc-rows">
              <div className="fc-row">
                <span className="fc-label">今</span>
                <span className="fc-track">
                  <span className="fc-bar now" style={{ width: f ? `${(f.now / top) * 100}%` : '0%' }} />
                </span>
                <span className="fc-val">{f ? perMin(f.now) : '—'}台/分</span>
              </div>
              <div className="fc-row">
                <span className="fc-label">雇用後</span>
                <span className="fc-track">
                  <span className="fc-bar after" style={{ width: f ? `${(f.after / top) * 100}%` : '0%' }} />
                </span>
                <span className="fc-val good">{f ? perMin(f.after) : '—'}台/分</span>
              </div>
            </div>
            <div className="fc-ratio">{f ? (ratio(f.after, f.now) ?? `+${perMin(f.after)}`) : ''}</div>
          </div>
          <div className={`pay-check${payOk ? ' ok' : ' ng'}`} data-testid="pay-check">
            {payOk ? <Check size={20} strokeWidth={3} /> : <TriangleAlert size={18} strokeWidth={2.6} />}
            <b>{payOk ? '支払いOK' : '支払い不足'}</b>
            <span>
              残り {yen(left)} ／ 次 {yen(-v.bill)}
            </span>
          </div>
          <button className="btn-dark hire-btn" disabled={!v.canHire} data-testid="hire" onClick={hireSelected}>
            {yen(v.hireCost)}で雇う
          </button>
        </>
      )}
      {v.workers.length > 0 && (
        <ul className="worker-list" data-testid="worker-list">
          {v.workers.map((w, i) => (
            <li key={w.id}>
              <span className="worker-avatar">
                <User size={18} strokeWidth={2.6} />
              </span>
              <span className="worker-name">バイト{i + 1}</span>
              <span className="worker-lanes">
                {LANES.map((lane) => (
                  <button
                    key={lane}
                    className={`mini-pick lane-${lane}${w.lane === lane ? ' active' : ''}`}
                    aria-label={LANE_VERB[lane]}
                    aria-pressed={w.lane === lane}
                    onClick={() => {
                      game().reassignWorker(w.id, lane);
                      refreshView();
                    }}
                  >
                    <LaneIcon lane={lane} size={18} strokeWidth={2.4} />
                  </button>
                ))}
              </span>
            </li>
          ))}
          <li className="worker-count">
            {v.workers.length}/{v.max}
          </li>
        </ul>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------- 契約（下請け）

function ContractSheet() {
  const v = useGame(useShallow((st) => ({ offer: st.view!.offer, sub: st.view!.sub, priority: st.view!.subPriority })));
  return (
    <Sheet title="契約" icon={<FileText size={24} strokeWidth={2.4} />} tone="tone-deal" testId="sheet-contract">
      {v.offer !== null && (
        <div className="deal-card">
          <div className="deal-head">
            <span className="offer-ring">
              <Ring value={v.offer.fraction} size={34} width={3.5} color="var(--deal)" track="var(--line)" />
              <FileText size={15} strokeWidth={2.4} />
            </span>
            <b>下請け</b>
            <span className="deal-left">{secs(v.offer.left)}</span>
          </div>
          <div className="deal-grid">
            <span>{v.offer.units}台</span>
            <span>納期 {v.offer.deadline}秒</span>
            <span className="good">{yen(v.offer.fee)}/台</span>
            <span className="bad">違約 {yen(v.offer.penalty)}/台</span>
          </div>
          <button
            className="btn-deal wide"
            data-testid="accept-offer-sheet"
            onClick={() => {
              game().acceptSubcontract();
              refreshView();
            }}
          >
            受ける
          </button>
        </div>
      )}
      {v.sub !== null && (
        <div className="deal-card active" data-testid="sub-status">
          <div className="deal-head">
            <span className="offer-ring">
              <Ring value={v.sub.fraction} size={34} width={3.5} color="var(--deal)" track="var(--line)" />
              <Clock size={15} strokeWidth={2.4} />
            </span>
            <b>
              {v.sub.units - v.sub.left}/{v.sub.units}台
            </b>
            <span className="deal-left">{secs(v.sub.deadlineLeft)}</span>
          </div>
          <div className="deal-grid">
            <span>キット {v.sub.kits}</span>
            <span className="good">{yen(v.sub.fee)}/台</span>
            <span className="bad">違約 {yen(v.sub.left * v.sub.penalty)}</span>
            <button
              className={`toggle${v.priority ? ' on' : ''}`}
              role="switch"
              aria-checked={v.priority}
              onClick={() => {
                game().setSubcontractPriority(!v.priority);
                refreshView();
              }}
            >
              <span className="toggle-label">優先</span>
              <span className="toggle-track">
                <span className="toggle-knob" />
              </span>
            </button>
          </div>
        </div>
      )}
      {v.offer === null && v.sub === null && (
        <div className="empty">
          <FileText size={40} strokeWidth={1.8} />
        </div>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------- 買収（鍵）

function AcquireSheet() {
  return (
    <Sheet title="買収" icon={<Lock size={24} strokeWidth={2.4} />} tone="tone-muted" testId="sheet-acquire">
      <div className="empty locked-big">
        <Lock size={48} strokeWidth={1.8} />
        <b>段階4</b>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- 財務

function FinanceSheet() {
  const periods = useGame((st) => st.view!.periods);
  return (
    <Sheet title="財務" icon={<ChartNoAxesColumn size={24} strokeWidth={2.4} />} tone="tone-money" testId="sheet-finance">
      <table className="finance">
        <thead>
          <tr>
            <th />
            <th>売上</th>
            <th>費用</th>
            <th>利益</th>
            <th>台</th>
          </tr>
        </thead>
        <tbody>
          {periods.map((p, i) => (
            <tr key={i} className={p.current ? 'current' : undefined}>
              <th>{p.current ? '今' : `−${periods.length - 1 - i}`}</th>
              <td>{yen(p.revenue)}</td>
              <td>{yen(-p.costs)}</td>
              <td className={p.profit >= 0 ? 'good' : 'bad'}>{yen(p.profit)}</td>
              <td>{p.sold}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Sheet>
  );
}

// ---------------------------------------------------------------- 設定

function SettingsSheet() {
  const theme = useGame((st) => st.themeSetting);
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'copied' | 'loaded' | 'error'>('idle');
  const [confirm, setConfirm] = useState(false);
  return (
    <Sheet title="設定" icon={<Settings size={24} strokeWidth={2.4} />} tone="tone-muted" testId="sheet-settings">
      <div className="seg" role="radiogroup" aria-label="昼夜">
        {(
          [
            ['auto', '自動', SunMoon],
            ['day', '昼', Sun],
            ['night', '夜', Moon],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            role="radio"
            aria-checked={theme === key}
            className={theme === key ? 'active' : undefined}
            data-testid={`theme-${key}`}
            onClick={() => setThemeSetting(key)}
          >
            <Icon size={18} strokeWidth={2.4} />
            {label}
          </button>
        ))}
      </div>
      <div className="save-box">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setState('idle');
          }}
          spellCheck={false}
          aria-label="セーブのテキスト"
          data-testid="save-text"
        />
        <div className="save-actions">
          <button
            className="btn-outline"
            data-testid="export"
            onClick={() => {
              const t = game().exportSave();
              setText(t);
              navigator.clipboard?.writeText(t).then(
                () => setState('copied'),
                () => setState('idle'),
              );
            }}
          >
            <Download size={18} strokeWidth={2.4} />
            書き出し
            {state === 'copied' && <Copy size={16} strokeWidth={2.4} />}
          </button>
          <button
            className="btn-outline"
            data-testid="import"
            disabled={text.trim() === ''}
            onClick={() => {
              try {
                game().importSave(text);
                setThemeSetting(game().settings.theme);
                refreshView();
                setState('loaded');
              } catch {
                setState('error');
              }
            }}
          >
            <Upload size={18} strokeWidth={2.4} />
            読み込み
            {state === 'loaded' && <Check size={16} strokeWidth={3} />}
            {state === 'error' && <TriangleAlert size={16} strokeWidth={2.6} className="bad" />}
          </button>
        </div>
      </div>
      {confirm ? (
        <div className="confirm-row">
          <button className="btn-warn" data-testid="restart-yes" onClick={() => { game().restart(); closeSheet(); refreshView(); }}>
            <RotateCcw size={18} strokeWidth={2.4} />
            最初から
          </button>
          <button className="btn-outline" onClick={() => setConfirm(false)}>
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>
      ) : (
        <button className="btn-outline wide" data-testid="restart" onClick={() => setConfirm(true)}>
          <RotateCcw size={18} strokeWidth={2.4} />
          最初から
        </button>
      )}
    </Sheet>
  );
}
