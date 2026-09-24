import { z } from 'zod';
import type { GameState } from '../core/types';
import { LaneSchema } from '../data/schema';

/** 読み込んだセーブが壊れていないかを確かめる形（GameState と同じ形） */

const num = z.number();
const nullableNum = num.nullable();

const TaskSchema = z.object({
  lane: LaneSchema,
  remaining: num,
  total: num,
  kit: z.boolean(),
  subId: nullableNum,
});

const PeriodSchema = z.object({
  start: num,
  end: nullableNum,
  revenue: num,
  costs: num,
  sold: num,
});

export const GameStateSchema = z.object({
  schema: z.number().int(),
  seed: num,
  rng: z.number().int(),
  tick: z.number().int().nonnegative(),
  t: num,
  status: z.enum(['playing', 'bankrupt', 'cleared']),
  cash: num,
  junk: z.number().int().nonnegative(),
  parts: z.number().int().nonnegative(),
  pcs: z.number().int().nonnegative(),
  orders: z.array(z.object({ id: num, arrivedAt: num })),
  nextOrderAt: num,
  nextOrderId: num,
  nextPayAt: num,
  graceUntil: nullableNum,
  nextOfferAt: num,
  offer: z.object({ id: num, offeredAt: num, expiresAt: num }).nullable(),
  sub: z
    .object({
      id: num,
      units: num,
      kits: num,
      left: num,
      acceptedAt: num,
      deadline: num,
      fee: num,
      penalty: num,
    })
    .nullable(),
  nextSubId: num,
  autoBuy: z.boolean(),
  subPriority: z.boolean(),
  player: z.object({ screen: LaneSchema, holding: z.boolean(), task: TaskSchema.nullable() }),
  workers: z.array(
    z.object({
      id: num,
      lane: LaneSchema,
      task: TaskSchema.nullable(),
      resting: z.boolean(),
      hiredAt: num,
    }),
  ),
  nextWorkerId: num,
  bottleneck: z.object({
    shown: LaneSchema.nullable(),
    candidate: LaneSchema.nullable(),
    candidateSince: num,
    starvedSeconds: num,
  }),
  recent: z.object({
    income: z.array(z.tuple([num, num])),
    asm: z.array(z.tuple([num, num])),
    sold: z.array(num),
  }),
  finance: z.object({ current: PeriodSchema, history: z.array(PeriodSchema) }),
  hireEffect: z
    .object({
      at: num,
      lane: LaneSchema,
      forecastNow: num,
      forecastAfter: num,
      preCount: num,
      measuredNow: nullableNum,
      measuredAfter: nullableNum,
    })
    .nullable(),
  stats: z.object({
    sold: num,
    revenue: num,
    ordersArrived: num,
    ordersLost: num,
    assembled: num,
    kitsAssembled: num,
    disassembled: num,
    junkBought: num,
    hires: num,
    subsDone: num,
    subsFailed: num,
    penaltiesPaid: num,
    firstSaleAt: nullableNum,
    firstHireAt: nullableNum,
    clearReachedAt: nullableNum,
    clearedAt: nullableNum,
    bankruptAt: nullableNum,
    bankruptCash: nullableNum,
    minCash: num,
  }),
});

export const SettingsSchema = z.object({
  theme: z.enum(['auto', 'day', 'night']),
});

export const SaveDataSchema = z.object({
  saveVersion: z.number().int().positive(),
  savedAt: num,
  screen: LaneSchema,
  settings: SettingsSchema,
  state: GameStateSchema,
});

export type Settings = z.infer<typeof SettingsSchema>;

/** 形が GameState とずれたら型の検査で気づけるようにする */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const stateSchemaMatchesType: Same<z.infer<typeof GameStateSchema>, GameState> = true;
