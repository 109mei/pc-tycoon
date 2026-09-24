/** 3つの列。dis＝生産（分解・検品）、asm＝制作（組み立て）、ship＝販売（出品・発送） */
export type Lane = 'dis' | 'asm' | 'ship';

export const LANES: readonly Lane[] = ['dis', 'asm', 'ship'];

/** 部品の種類。再生PCは1種類ずつ使って組む */
export type PartType = 'board' | 'memory' | 'storage' | 'power';

export const PART_TYPES: readonly PartType[] = ['board', 'memory', 'storage', 'power'];

/** 種類ごとの部品の数 */
export type Parts = Record<PartType, number>;

/** 作業をしている手。'player'＝自分、数値＝アルバイトの番号 */
export type Actor = 'player' | number;

export interface Task {
  lane: Lane;
  /** 残りの秒数 */
  remaining: number;
  /** 始めたときの秒数（進み具合の表示用） */
  total: number;
  /** 支給キットを使う組み立て（下請け） */
  kit: boolean;
  /** キットを使うとき、どの下請けのキットか */
  subId: number | null;
  /** 発送のとき、その注文の値段 */
  price: number | null;
}

export interface Worker {
  id: number;
  lane: Lane;
  task: Task | null;
  /** 不在中に給料を払えず休んでいる */
  resting: boolean;
  hiredAt: number;
}

export interface Order {
  id: number;
  arrivedAt: number;
  /** 注文したときの出品価格 */
  price: number;
}

export interface SubOffer {
  id: number;
  offeredAt: number;
  expiresAt: number;
}

export interface Subcontract {
  id: number;
  units: number;
  /** まだ使っていない支給キット（1台分の部品一式） */
  kits: number;
  /** まだ納めていない台数 */
  left: number;
  acceptedAt: number;
  deadline: number;
  fee: number;
  penalty: number;
}

/** 支払いの区切りごとの収支 */
export interface Period {
  start: number;
  end: number | null;
  revenue: number;
  costs: number;
  sold: number;
}

/** 雇った直後の伸びの表示 */
export interface HireEffect {
  at: number;
  lane: Lane;
  /** 雇うシートで出した予想（台/分） */
  forecastNow: number;
  forecastAfter: number;
  /** 雇う前の区間の組み立て台数 */
  preCount: number;
  /** 実測（台/分）。雇ってから決まった秒数たつまで null */
  measuredNow: number | null;
  measuredAfter: number | null;
}

export interface Stats {
  sold: number;
  revenue: number;
  ordersArrived: number;
  ordersLost: number;
  assembled: number;
  kitsAssembled: number;
  disassembled: number;
  junkBought: number;
  /** 検品で見つかった壊れた部品 */
  brokenParts: number;
  /** 新品で補った部品の数と、使ったお金 */
  newPartsBought: number;
  newPartsSpent: number;
  priceChanges: number;
  hires: number;
  subsDone: number;
  subsFailed: number;
  penaltiesPaid: number;
  firstSaleAt: number | null;
  firstHireAt: number | null;
  clearReachedAt: number | null;
  clearedAt: number | null;
  bankruptAt: number | null;
  bankruptCash: number | null;
  minCash: number;
}

export type Status = 'playing' | 'bankrupt' | 'cleared';

export interface BottleneckState {
  /** 表示している詰まりの列 */
  shown: Lane | null;
  /** 今いちばん詰まっている列（表示を切り替える前の候補） */
  candidate: Lane | null;
  candidateSince: number;
  /** 制作に手があるのに組み立てを始められない状態が続いた秒数 */
  starvedSeconds: number;
}

export interface GameState {
  schema: number;
  seed: number;
  /** 疑似乱数（mulberry32）の内部状態 */
  rng: number;
  tick: number;
  /** 始めてからの秒数（tick × tickSeconds） */
  t: number;
  status: Status;
  cash: number;
  junk: number;
  parts: Parts;
  pcs: number;
  orders: Order[];
  nextOrderAt: number;
  nextOrderId: number;
  /** 出品価格の段階（balance.market.priceLevels の番号） */
  priceLevel: number;
  nextPayAt: number;
  /** 猶予の終わり（秒）。猶予中でなければ null */
  graceUntil: number | null;
  nextOfferAt: number;
  offer: SubOffer | null;
  sub: Subcontract | null;
  nextSubId: number;
  autoBuy: boolean;
  subPriority: boolean;
  player: {
    /** 今いる画面＝自分の手がある列 */
    screen: Lane;
    holding: boolean;
    /** 作業中に押したタップ（手が空いたら1回だけ始める） */
    queued: boolean;
    task: Task | null;
  };
  workers: Worker[];
  nextWorkerId: number;
  bottleneck: BottleneckState;
  /** 直近の記録（表示とボット用）。古いものは捨てる */
  recent: {
    /** [時刻, 入金額] */
    income: [number, number][];
    /** [時刻, キットなら1] */
    asm: [number, number][];
    /** 売れた時刻 */
    sold: number[];
    /** 注文を逃した時刻 */
    lost: number[];
  };
  finance: {
    current: Period;
    history: Period[];
  };
  hireEffect: HireEffect | null;
  stats: Stats;
}

export type GameEvent =
  | { type: 'orderArrived'; id: number }
  | { type: 'orderLost'; id: number }
  | { type: 'offer' }
  | { type: 'offerExpired' }
  | { type: 'subAccepted' }
  | { type: 'subDone' }
  | { type: 'subFailed'; penalty: number }
  | { type: 'paid'; amount: number }
  | { type: 'graceStarted' }
  | { type: 'graceCleared' }
  | { type: 'bankrupt' }
  | { type: 'bought'; count: number; auto: boolean }
  | { type: 'partsBought'; types: PartType[]; cost: number }
  | { type: 'priceChanged'; level: number }
  | { type: 'taskStarted'; lane: Lane; by: Actor }
  | { type: 'disassembled'; good: PartType[]; broken: PartType[]; by: Actor }
  | { type: 'assembled'; kit: boolean; by: Actor }
  | { type: 'sold'; amount: number; price: number; by: Actor }
  | { type: 'subFee'; amount: number; by: Actor }
  | { type: 'hired'; lane: Lane; id: number }
  | { type: 'hireMeasured' }
  | { type: 'clearReady' }
  | { type: 'cleared' }
  | { type: 'workersRested' };
