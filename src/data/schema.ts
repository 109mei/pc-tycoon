import { z } from 'zod';

const yen = z.number().int().nonnegative();
const seconds = z.number().positive();
const count = z.number().int().nonnegative();

export const LaneSchema = z.enum(['dis', 'asm', 'ship']);

/** docs/balance.stage1.json（元の数値）の形。src/data/balance.json もこの部分は同じ値を持つ。 */
export const BalanceSchema = z.object({
  version: z.number().int().positive(),
  tickSeconds: z.number().positive().max(1),
  startCash: yen,
  junk: z.object({
    price: yen.positive(),
    partsYield: z
      .array(
        z.object({
          parts: z.number().int().positive(),
          probability: z.number().min(0).max(1),
        }),
      )
      .min(1)
      .refine((rows) => Math.abs(rows.reduce((a, r) => a + r.probability, 0) - 1) < 1e-9, {
        message: '部品の数の確率の合計が1ではない',
      }),
    autoBuy: z.object({
      enabledByDefault: z.boolean(),
      keepJunk: count,
      pauseWhenPartsAtLeast: count,
      pauseWhenPcsAtLeast: count,
    }),
  }),
  pc: z.object({
    partsPerPc: z.number().int().positive(),
    salePrice: yen.positive(),
    marketFeeRate: z.number().min(0).max(1),
    shippingCost: yen,
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
  }),
  bot: z.object({
    stockHighPcs: count,
    disassembleBelowPcSets: z.number().positive(),
    disassembleUpToPcSets: z.number().positive(),
    subUrgencyFactor: z.number().positive(),
    reserveWages: z.number().nonnegative(),
    secondHireDemandRatio: z.number().positive(),
    secondHireWindowSeconds: seconds,
    hireLanes: z.array(LaneSchema).min(1),
  }),
});

export const GameDataSchema = BalanceSchema.extend(TuningSchema.shape);

export type BalanceStage1 = z.infer<typeof BalanceSchema>;
export type Balance = z.infer<typeof GameDataSchema>;
