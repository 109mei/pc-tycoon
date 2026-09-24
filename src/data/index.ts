import raw from './balance.json';
import { GameDataSchema, type Balance } from './schema';

export const balance: Balance = GameDataSchema.parse(raw);

export type { Balance } from './schema';
