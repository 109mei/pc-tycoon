import { z } from 'zod';

const yen = z.number().int().nonnegative();
const seconds = z.number().positive();
const count = z.number().int().nonnegative();
const rate = z.number().min(0).max(1);

export const LaneSchema = z.enum(['dis', 'asm', 'ship']);
export const PartTypeSchema = z.enum(['board', 'memory', 'storage', 'power']);

/** 部品の種類ごとの値（マザーボード・メモリ・ストレージ・電源） */
const perPart = <T extends z.ZodType>(v: T) =>
  z.object({ board: v, memory: v, storage: v, power: v });

/** docs/balance.stage1.json（元の数値）の形。src/data/balance.json もこの部分は同じ値を持つ。 */
export const BalanceSchema = z.object({
  version: z.number().int().positive(),
  tickSeconds: z.number().positive().max(1),
  startCash: yen,
  junk: z.object({
    price: yen.positive(),
    /** 分解したとき、その部品が使える（壊れていない）確率 */
    goodRate: perPart(rate),
    autoBuy: z.object({
      enabledByDefault: z.boolean(),
      keepJunk: count,
      pauseWhenSetsAtLeast: count,
      pauseWhenPcsAtLeast: count,
      /** 次の支払いまでこの秒数を切ったら、支払い額を残して買う */
      reserveWithinSeconds: z.number().nonnegative(),
    }),
  }),
  /** 足りない部品を新品で補うときの値段 */
  newParts: z.object({
    price: perPart(yen.positive()),
  }),
  pc: z.object({
    marketFeeRate: z.number().min(0).max(1),
    shippingCost: yen,
  }),
  /** 出品価格の段階。評価（売った件数）が minReviews 以上で選べる */
  market: z
    .object({
      priceLevels: z
        .array(
          z.object({
            price: yen.positive(),
            demand: z.number().positive(),
            minReviews: count,
          }),
        )
        .min(1),
      defaultLevel: count,
    })
    .refine((m) => m.defaultLevel < m.priceLevels.length, { message: 'defaultLevel が段階の外' })
    .refine((m) => m.priceLevels.every((l, i, a) => i === 0 || a[i - 1]!.price < l.price), {
      message: '出品価格は安い順に並べる',
    }),
  taskSeconds: z.object({
    disassemble: seconds,
    assemble: seconds,
    ship: seconds,
  }),
  orders: z.object({
    baseIntervalSeconds: seconds,
    growthPerSale: z.number().nonnegative(),
    maxMultiplier: z.number().min(1),
    patienceSeconds: seconds,
  }),
  payments: z.object({
    intervalSeconds: seconds,
    utility: yen,
    rent: yen,
    graceSeconds: seconds,
  }),
  workers: z.object({
    hireCost: yen,
    wage: yen,
    speed: z.number().positive(),
    maxCount: count,
  }),
  subcontract: z.object({
    firstOfferAtSeconds: z.number().nonnegative(),
    offerEverySeconds: seconds,
    offerExpiresSeconds: seconds,
    units: z.number().int().positive(),
    deadlineSeconds: seconds,
    feePerUnit: yen,
    penaltyPerUnit: yen,
  }),
  stage1: z.object({
    clearCash: yen.positive(),
  }),
  save: z.object({
    autosaveSeconds: seconds,
    offlineMaxSeconds: seconds,
  }),
});

/** 試作で足した調整値（詰まりの判定・表示・ボット）。元の数値には含まれない。 */
export const TuningSchema = z.object({
  bottleneck: z.object({
    starvedSecondsPerPoint: seconds,
    minScore: z.number().positive(),
    holdSeconds: z.number().nonnegative(),
  }),
  display: z.object({
    uiHz: z.number().positive().max(60),
    incomeWindowSeconds: seconds,
    orderUrgentSeconds: seconds,
    hireForecastSeconds: seconds,
    hireMeasurePreSeconds: seconds,
    hireMeasurePostSeconds: seconds,
    hireBadgeMeasuredSeconds: seconds,
    awaySummaryMinSeconds: z.number().nonnegative(),
    financePeriods: z.number().int().positive(),
    shippedBoxSeconds: seconds,
    maxTicksPerFrame: z.number().int().positive(),
    /** 支払いが足りないとき、残り何秒から知らせるか */
    payWarnSeconds: seconds,
    /** 序盤の導き：この件数を売るまで、次に手を使う列を光らせる */
    hintUntilSales: count,
    /** 導き：手が空いてからこの秒数で光らせる */
    hintIdleSeconds: z.number().nonnegative(),
    /** 新品で補うボタンを出すのは、足りない部品がこの種類数までのとき（全部を新品で買うと損になるため） */
    buyMissingMaxTypes: count,
  }),
  bot: z.object({
    stockHighPcs: count,
    disassembleBelowSets: z.number().positive(),
    disassembleUpToSets: z.number().positive(),
    subUrgencyFactor: z.number().positive(),
    reserveWages: z.number().nonnegative(),
    secondHireDemandRatio: z.number().positive(),
    secondHireWindowSeconds: seconds,
    hireLanes: z.array(LaneSchema).min(1),
    /** 値段を見直す間隔と、そのとき見る直近の秒数 */
    priceReviewSeconds: seconds,
    priceWindowSeconds: seconds,
    /** この件数以上を逃したら値上げ */
    raiseWhenLostAtLeast: count,
    /** 値下げはこの段階まで */
    priceFloorLevel: count,
    /** 新品で補うのは、足りない種類がこの数以下で、どれもジャンク1台の値段のこの倍まで安いとき */
    newPartsMaxMissing: count,
    newPartsMaxPriceRatio: z.number().positive(),
  }),
});

export const GameDataSchema = BalanceSchema.extend(TuningSchema.shape);

export type BalanceStage1 = z.infer<typeof BalanceSchema>;
export type Balance = z.infer<typeof GameDataSchema>;
