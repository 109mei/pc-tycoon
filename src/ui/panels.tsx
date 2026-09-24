import { useShallow } from 'zustand/react/shallow';
import { game, refreshView, useGame } from '../store/game';
import { secs, yen } from './format';
import { FileText, Lock, Package, PcCase, ShoppingBag, Smartphone, Wrench } from './icons';
import { Ring } from './Ring';

/** 部品の四角の色（部屋の部品と同じ並び） */
const PART_COLORS = ['var(--part-a)', 'var(--part-b)', 'var(--part-c)'];
/** パネルに並べる四角・アイコンの上限（あふれた分は +n） */
const MAX_SQUARES = 16;
const MAX_PC_ICONS = 12;
const MAX_ORDER_ROWS = 3;

export function LanePanel() {
  const screen = useGame((st) => st.view!.screen);
  if (screen === 'dis') return <ProductionPanel />;
  if (screen === 'asm') return <AssemblyPanel />;
  return <SalesPanel />;
}

function Toggle({ on, onChange, label, testId }: { on: boolean; onChange: (v: boolean) => void; label: string; testId?: string }) {
  return (
    <button
      className={`toggle${on ? ' on' : ''}`}
      role="switch"
      aria-checked={on}
      data-testid={testId}
      onClick={() => {
        onChange(!on);
        refreshView();
      }}
    >
      <span className="toggle-label">{label}</span>
      <span className="toggle-track">
        <span className="toggle-knob" />
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- 生産

function ProductionPanel() {
  const v = useGame(
    useShallow((st) => {
      const view = st.view!;
      return {
        price: view.junkPrice,
        avg: view.avgYield,
        affordable: view.affordableJunk,
        auto: view.autoBuy,
        parts: view.counts.asm,
        stuck: view.bottleneck === 'asm',
      };
    }),
  );
  const buy = (n: number) => {
    game().buyJunk(n);
    refreshView();
  };
  return (
    <div className="panels">
      <section className="card panel-card lane-dis" aria-label="仕入れ">
        <div className="card-head">
          <Smartphone size={19} strokeWidth={2.3} className="lane-ink" />
          仕入れ
        </div>
        <div className="price">
          {yen(v.price)}
          <small>/台</small>
        </div>
        <div className="yield">
          <Wrench size={15} strokeWidth={2.4} />
          部品 平均{v.avg.toFixed(1)}個
        </div>
        <div className="buy-area">
          <Toggle label="自動" on={v.auto} onChange={(on) => game().setAutoBuy(on)} testId="auto-buy" />
          <div className="buy-row">
            <button className="btn-outline lane-dis" disabled={v.affordable < 1} onClick={() => buy(1)} data-testid="buy-1">
              ×1
            </button>
            <button className="btn-fill lane-dis" disabled={v.affordable < 1} onClick={() => buy(5)} data-testid="buy-5">
              ×5
            </button>
          </div>
        </div>
      </section>
      <section className="card panel-card lane-asm" aria-label="制作へ送った部品">
        <div className="card-head">
          <Wrench size={19} strokeWidth={2.3} className="lane-ink" />
          制作へ送った部品
        </div>
        <div className="big-count" data-testid="parts">
          {v.parts}
          <small>個</small>
        </div>
        <div className="squares">
          {Array.from({ length: Math.min(v.parts, MAX_SQUARES) }, (_, i) => (
            <span key={i} style={{ background: PART_COLORS[i % PART_COLORS.length] }} />
          ))}
          {v.parts > MAX_SQUARES && <em>+{v.parts - MAX_SQUARES}</em>}
        </div>
        {v.stuck && (
          <div className="stuck-pill">
            <Wrench size={16} strokeWidth={2.4} />
            制作で詰まり中
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- 制作

function AssemblyPanel() {
  const v = useGame(
    useShallow((st) => {
      const view = st.view!;
      return {
        price: view.salePrice,
        pcs: view.counts.ship,
        sub: view.sub,
        priority: view.subPriority,
      };
    }),
  );
  return (
    <div className="panels panels-asm">
      <section className="card panel-card lane-asm" aria-label="つくる物">
        <div className="card-head">
          <PcCase size={19} strokeWidth={2.3} className="lane-ink" />
          つくる物
        </div>
        <div className="product">
          <PcCase size={30} strokeWidth={2.2} className="lane-ink" />
          <div className="product-body">
            <div className="product-line">
              <b>再生PC</b>
              <span>{yen(v.price)}</span>
            </div>
            <div className="recipe">
              {PART_COLORS.concat('var(--part-d)').map((c, i) => (
                <span key={i} style={{ background: c }} />
              ))}
              <span className="recipe-arrow">›</span>
              <PcCase size={18} strokeWidth={2.2} />
            </div>
          </div>
        </div>
        {v.sub !== null ? (
          <>
            <div className="sub-box" data-testid="sub-box">
              <FileText size={16} strokeWidth={2.4} />
              <span className="sub-left">
                {v.sub.left}/{v.sub.units}台
              </span>
              <span className="sub-time">{secs(v.sub.deadlineLeft)}</span>
              <Toggle label="優先" on={v.priority} onChange={(on) => game().setSubcontractPriority(on)} testId="sub-priority" />
            </div>
            <div className="locked-row">
              <span className="locked-chip">
                <Lock size={13} strokeWidth={2.4} />
                事務用PC
              </span>
              <span className="locked-chip">
                <Lock size={13} strokeWidth={2.4} />
                ゲーミングPC
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="locked">
              <Lock size={15} strokeWidth={2.4} />
              事務用PC
            </div>
            <div className="locked">
              <Lock size={15} strokeWidth={2.4} />
              ゲーミングPC
            </div>
          </>
        )}
      </section>
      <section className="card panel-card lane-ship" aria-label="販売へ">
        <div className="card-head">
          <Package size={19} strokeWidth={2.3} className="lane-ink" />
          販売へ
        </div>
        <div className="big-count" data-testid="pcs">
          {v.pcs}
          <small>台</small>
        </div>
        <div className="pc-icons lane-ink">
          {Array.from({ length: Math.min(v.pcs, MAX_PC_ICONS) }, (_, i) => (
            <PcCase key={i} size={22} strokeWidth={2.2} />
          ))}
          {v.pcs > MAX_PC_ICONS && <em>+{v.pcs - MAX_PC_ICONS}</em>}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- 販売

function SalesPanel() {
  const v = useGame(
    useShallow((st) => {
      const view = st.view!;
      return { orders: view.orders, lost: view.lost, offer: view.offer, price: view.salePrice };
    }),
  );
  const rows = v.offer !== null ? MAX_ORDER_ROWS : MAX_ORDER_ROWS + 1;
  const shown = v.orders.slice(0, rows);
  return (
    <section className="card sales-card lane-ship" aria-label="フリマの注文">
      <div className="card-head">
        <Smartphone size={19} strokeWidth={2.3} className="lane-ink" />
        フリマの注文
        {v.orders.length > rows && <span className="more">+{v.orders.length - rows}</span>}
        <span className="lost-pill" data-testid="lost" data-value={v.lost}>
          × {v.lost}
        </span>
      </div>
      <ul className="orders" data-testid="orders" data-count={v.orders.length}>
        {shown.map((o) => (
          <li key={o.id} className={o.urgent ? 'urgent' : undefined}>
            <span className="order-ring">
              <Ring
                value={o.fraction}
                size={34}
                width={4}
                color={o.urgent ? 'var(--warn)' : 'var(--ship)'}
                track="var(--line)"
              />
              <ShoppingBag size={15} strokeWidth={2.4} />
            </span>
            <span className="order-name">再生PC</span>
            <span className="order-price">{yen(v.price)}</span>
            <span className="order-left">{secs(o.left)}</span>
          </li>
        ))}
      </ul>
      {v.offer !== null && (
        <div className="offer" data-testid="offer">
          <span className="offer-ring">
            <Ring value={v.offer.fraction} size={30} width={3} color="var(--deal)" track="var(--line)" />
            <FileText size={14} strokeWidth={2.4} />
          </span>
          <span className="offer-text">
            下請け {v.offer.units}台・{v.offer.deadline}秒・{yen(v.offer.fee)}/台
          </span>
          <button
            className="btn-deal"
            data-testid="accept-offer"
            onClick={() => {
              game().acceptSubcontract();
              refreshView();
            }}
          >
            受ける
          </button>
        </div>
      )}
    </section>
  );
}
