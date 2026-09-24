import { closeSheet, openSheet, useGame, type SheetKind } from '../store/game';
import { ChartNoAxesColumn, FileText, Lock, User } from './icons';

const TABS: { kind: SheetKind; label: string; icon: typeof User; locked?: boolean }[] = [
  { kind: 'staff', label: '社員', icon: User },
  { kind: 'contract', label: '契約', icon: FileText },
  { kind: 'acquire', label: '買収', icon: Lock, locked: true },
  { kind: 'finance', label: '財務', icon: ChartNoAxesColumn },
];

/** 経営タブ。押すと下から引き出すシートが開く */
export function TabBar() {
  const sheet = useGame((st) => st.sheet);
  const offers = useGame((st) => (st.view!.offer !== null ? 1 : 0));
  return (
    <nav className="tabs" aria-label="経営">
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = sheet === t.kind;
        return (
          <button
            key={t.kind}
            className={`tab${active ? ' active' : ''}${t.locked ? ' tab-locked' : ''}`}
            data-testid={`tab-${t.kind}`}
            aria-pressed={active}
            onClick={() => (active ? closeSheet() : openSheet(t.kind))}
          >
            <span className="tab-icon">
              <Icon size={24} strokeWidth={2.2} />
              {t.kind === 'contract' && offers > 0 && <span className="tab-badge">{offers}</span>}
            </span>
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
