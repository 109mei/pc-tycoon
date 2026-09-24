import {
  Hammer,
  Package,
  Wrench,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';
import type { Lane } from '../core/types';

export {
  Check,
  ChartNoAxesColumn,
  ChevronRight,
  Clock,
  Coffee,
  Copy,
  Download,
  FileText,
  Hammer,
  Hourglass,
  Lock,
  Moon,
  Package,
  PcCase,
  RotateCcw,
  Settings,
  ShoppingBag,
  Smartphone,
  Sun,
  SunMoon,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Upload,
  User,
  Warehouse,
  Wrench,
  X,
  Zap,
  JapaneseYen,
} from 'lucide-react';

export const LANE_ICON: Record<Lane, LucideIcon> = { dis: Hammer, asm: Wrench, ship: Package };
export const LANE_NAME: Record<Lane, string> = { dis: '生産', asm: '制作', ship: '販売' };
export const LANE_VERB: Record<Lane, string> = { dis: '分解', asm: '組み立て', ship: '発送' };

export function LaneIcon({ lane, ...rest }: { lane: Lane } & LucideProps) {
  const Icon = LANE_ICON[lane];
  return <Icon {...rest} />;
}
