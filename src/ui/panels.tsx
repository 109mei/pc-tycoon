import { useShallow } from 'zustand/react/shallow';
import { PART_TYPES } from '../core/types';
import { buyMissingParts, game, refreshView, setPriceLevel, useGame } from '../store/game';
import { secs, yen } from './format';
import {
  FileText,
  Lock,
  Minus,
  PartIcon,
  PcCase,
  Plus,
  Recycle,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Star,
  Timer,
  Wrench,
} from './icons';
import { Ring } from './Ring';

/** 注文の輪を並べる数の上限（あふれた分は +n） */
const MAX_ORDER_CHIPS = 5;

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

// ---------------------------------------------------------------- 生産：仕入れと検品

function ProductionPanel() {
  const v = useGame(
    useShallow((st) => {
      const view = st.view!;
      return {
        price: view.junkPrice,
        affordable: view.affordableJunk,
        auto: view.autoBuy,
        parts: view.parts,
        sets: view.sets,
        broken: view.brokenParts,
        inspection: st.inspection,
        avg: view.goodParts,
      };
    }),
  );
  const buy = (n: number) => {
    game().buyJunk(n);
    refreshView();
  };
  // 足りない色は、0個か、ほかより少ない種類にだけ付ける
  const counts = PART_TYPES.map((t) => v.parts[t]);
  const low = Math.min(...counts);
  const isScarce = (n: number) => n === low && (low === 0 || Math.max(...counts) > low);
  return (
    <div className="panels">
      <section className="card panel-card lane-dis" aria-label="仕入れ">
        <div className="card-head">
          <Smartphone size={18} strokeWidth={2.3} className="lane-ink" />
          仕入れ
          <span className="head-right">
            <Toggle label="自動" on={v.auto} onChange={(on) => game().setAutoBuy(on)} testId="auto-buy" />
          </span>
        </div>
        <div className="price">
          {yen(v.price)}
          <small>/台</small>
        </div>
        <div className="yield">
          <Wrench size={14} strokeWidth={2.4} />
          部品 平均{v.avg.toFixed(1)}個
        </div>
        <div className="buy-row">
          <button className="btn-outline lane-dis" disabled={v.affordable < 1} onClick={() => buy(1)} data-testid="buy-1">
            ×1
          </button>
          <button className="btn-fill lane-dis" disabled={v.affordable < 1} onClick={() => buy(5)} data-testid="buy-5">
            ×5
          </button>
        </div>
      </section>
      <section className="card panel-card lane-asm" aria-label="部品">
        <div className="card-head">
          <Wrench size={18} strokeWidth={2.3} className="lane-ink" />
          部品
          <span className="head-right broken" title="捨てた部品" data-testid="broken">
            <Recycle size={15} strokeWidth={2.4} />
            {v.broken}
          </span>
        </div>
        <div className="part-grid" data-testid="parts">
          {PART_TYPES.map((t) => (
            <span key={t} className={`part-count part-${t}${isScarce(v.parts[t]) ? ' scarce' : ''}`} data-testid={`part-${t}`}>
              <PartIcon part={t} size={17} strokeWidth={2.3} />
              <b>{v.parts[t]}</b>
            </span>
          ))}
        </div>
        <div className="inspect-strip" aria-label="直前の検品">
          {v.inspection !== null &&
            PART_TYPES.map((t) => {
              const ok = v.inspection!.good.includes(t);
              return (
                <span key={`${v.inspection!.n}-${t}`} className={`inspect-dot part-${t}${ok ? ' ok' : ' ng'}`}>
                  <PartIcon part={t} size={13} strokeWidth={2.6} />
                </span>
              );
            })}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- 制作：部品をそろえて組む

function AssemblyPanel() {
  const v = useGame(
    useShallow((st) => {
      const view = st.view!;
      return {
        price: view.price,
        parts: view.parts,
        sets: view.sets,
        missing: view.missing,
        cost: view.missingCost,
        offerBuy: view.offerBuyMissing,
        canBuy: view.canBuyMissing,
        sub: view.sub,
        priority: view.subPriority,
      };
    }),
  );
  return (
    <div className="panels panels-asm">
      <section className="card panel-card lane-asm" aria-label="つくる物">
        <div className="card-head">
          <PcCase size={18} strokeWidth={2.3} className="lane-ink" />
          つくる物
        </div>
        <div className="product">
          <div className="product-line">
            <b>再生PC</b>
            <span>{yen(v.price)}</span>
          </div>
          <div className="recipe" data-testid="recipe">
            {PART_TYPES.map((t) => (
              <span key={t} className={`recipe-part part-${t}${v.parts[t] > 0 ? ' have' : ' need'}`}>
                <PartIcon part={t} size={15} strokeWidth={2.4} />
              </span>
            ))}
            <span className="recipe-arrow">›</span>
            <PcCase size={18} strokeWidth={2.2} />
          </div>
        </div>
        {v.sub !== null ? (
          <div className="sub-box" data-testid="sub-box">
            <FileText size={15} strokeWidth={2.4} />
            <span className="sub-left">
              {v.sub.left}/{v.sub.units}台
            </span>
            <span className="sub-time">{secs(v.sub.deadlineLeft)}</span>
            <Toggle label="優先" on={v.priority} onChange={(on) => game().setSubcontractPriority(on)} testId="sub-priority" />
          </div>
        ) : (
          <div className="locked-row">
            <span className="locked-chip">
              <Lock size={12} strokeWidth={2.4} />
              事務用PC
            </span>
            <span className="locked-chip">
              <Lock size={12} strokeWidth={2.4} />
              ゲーミングPC
            </span>
          </div>
        )}
      </section>
      <section className="card panel-card lane-ship sets-card" aria-label="組める台数">
        <div className="card-head">
          <Wrench size={18} strokeWidth={2.3} className="lane-ink-asm" />
          組める
        </div>
        {!v.offerBuy ? (
          <div className="big-count" data-testid="sets">
            {v.sets}
            <small>台</small>
          </div>
        ) : (
          <>
            <div className="missing-row" data-testid="missing">
              {v.missing.map((t) => (
                <span key={t} className={`missing-part part-${t}`}>
                  <PartIcon part={t} size={18} strokeWidth={2.4} />
                </span>
              ))}
            </div>
            <button className="btn-new" disabled={!v.canBuy} onClick={buyMissingParts} data-testid="buy-missing">
              <ShoppingCart size={17} strokeWidth={2.4} />
              {yen(v.cost)}
            </button>
          </>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- 販売：値段と注文

function SalesPanel() {
  const v = useGame(
    useShallow((st) => {
      const view = st.view!;
      return {
        orders: view.orders,
        lost: view.lost,
        offer: view.offer,
        level: view.priceLevel,
        levels: view.priceLevels,
        price: view.price,
        net: view.saleNet,
        interval: view.orderInterval,
        reviews: view.reviews,
      };
    }),
  );
  const up = v.levels[v.level + 1];
  const down = v.levels[v.level - 1];
  const shown = v.orders.slice(0, MAX_ORDER_CHIPS);
  return (
    <section className="card sales-card lane-ship" aria-label="フリマの注文">
      <div className="card-head">
        <Smartphone size={18} strokeWidth={2.3} className="lane-ink" />
        フリマの注文
        <span className="reviews" data-testid="reviews">
          <Star size={14} strokeWidth={2.6} />
          {v.reviews}
        </span>
        <span className="lost-pill" data-testid="lost" data-value={v.lost}>
          × {v.lost}
        </span>
      </div>
      <div className="price-row">
        <button
          className="step-btn"
          aria-label="値下げ"
          data-testid="price-down"
          disabled={down === undefined}
          onClick={() => setPriceLevel(v.level - 1)}
        >
          <Minus size={20} strokeWidth={2.8} />
        </button>
        <div className="price-now" data-testid="price" data-value={v.price}>
          <b>{yen(v.price)}</b>
          <small>手取り {yen(v.net)}</small>
        </div>
        <button
          className="step-btn"
          aria-label="値上げ"
          data-testid="price-up"
          disabled={up === undefined || up.locked}
          onClick={() => setPriceLevel(v.level + 1)}
        >
          {up !== undefined && up.locked ? (
            <span className="step-lock">
              <Lock size={13} strokeWidth={2.6} />
              <small>
                <Star size={10} strokeWidth={3} />
                {up.minReviews}
              </small>
            </span>
          ) : (
            <Plus size={20} strokeWidth={2.8} />
          )}
        </button>
        <span className="order-rate" data-testid="order-rate">
          <Timer size={15} strokeWidth={2.4} />
          {v.interval.toFixed(1)}秒
        </span>
      </div>
      <div className="order-chips" data-testid="orders" data-count={v.orders.length}>
        {shown.map((o) => (
          <span key={o.id} className={`order-chip${o.urgent ? ' urgent' : ''}`}>
            <Ring value={o.fraction} size={40} width={4} color={o.urgent ? 'var(--warn)' : 'var(--ship)'} track="var(--line)" />
            <b>{Math.ceil(o.left - 1e-6)}</b>
          </span>
        ))}
        {v.orders.length > MAX_ORDER_CHIPS && <em>+{v.orders.length - MAX_ORDER_CHIPS}</em>}
        {v.orders.length === 0 && (
          <span className="order-chip waiting" aria-label="注文待ち">
            <ShoppingBag size={16} strokeWidth={2.4} />
          </span>
        )}
      </div>
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
