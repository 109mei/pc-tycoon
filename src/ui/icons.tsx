import {
  CircuitBoard,
  Hammer,
  HardDrive,
  MemoryStick,
  Package,
  PlugZap,
  Wrench,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';
import type { Lane, PartType } from '../core/types';

export {
  Check,
  ChartNoAxesColumn,
  ChevronRight,
  CircuitBoard,
  Clock,
  Coffee,
  Copy,
  Download,
  FileText,
  Hammer,
  HardDrive,
  Hourglass,
  Lock,
  MemoryStick,
  Minus,
  Moon,
  Package,
  PcCase,
  PlugZap,
  Plus,
  Recycle,
  RotateCcw,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Star,
  Sun,
  SunMoon,
  Timer,
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

export const PART_ICON: Record<PartType, LucideIcon> = {
  board: CircuitBoard,
  memory: MemoryStick,
  storage: HardDrive,
  power: PlugZap,
};
export const PART_NAME: Record<PartType, string> = {
  board: 'マザーボード',
  memory: 'メモリ',
  storage: 'ストレージ',
  power: '電源',
};

export function LaneIcon({ lane, ...rest }: { lane: Lane } & LucideProps) {
  const Icon = LANE_ICON[lane];
  return <Icon {...rest} />;
}

export function PartIcon({ part, ...rest }: { part: PartType } & LucideProps) {
  const Icon = PART_ICON[part];
  return <Icon {...rest} />;
}
