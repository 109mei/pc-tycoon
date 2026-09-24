import { boxOf, type BoxColors } from './iso';

export type Theme = 'day' | 'night';

/** 部屋の中の色（床・壁・家具は docs/rough の画像から取った） */
export interface RoomPalette {
  shadow: number;
  slabLeft: number;
  slabRight: number;
  wallLeft: number;
  wallRight: number;
  wallTop: number;
  wallEnd: number;
  concrete: number;
  wood: number;
  woodPlank: number;
  tile: number;
  tileGrout: number;
  windowFrame: number;
  glass: number;
  glassGlow: boolean;
  furniture: BoxColors;
  metalPost: BoxColors;
  shelf: BoxColors;
  junk: BoxColors;
  junkSlot: number;
  mat: number;
  bin: BoxColors;
  parts: number[];
  cardboard: BoxColors;
  cardboardInner: number;
  tape: number;
  pc: BoxColors;
  led: number;
  board: number;
  chair: BoxColors;
  bezel: BoxColors;
  screen: number;
  screenGlow: boolean;
  posterFrame: number;
  posterInner: number;
  door: number;
  doorGlow: boolean;
  cork: number;
  slip: number;
  pin: number;
  printer: BoxColors;
  phone: number;
  phoneScreen: number;
  road: BoxColors;
  roadStripe: number;
  van: BoxColors;
  vanWindow: number;
  vanStripe: number;
  kit: BoxColors;
  lightPool: number;
  lightPoolAlpha: number;
  playerBody: number;
  workerBody: number;
  skin: number;
  hair: number;
  playerRing: number;
  workerRing: number;
  personShadow: number;
  ringDisc: number;
  ringTrack: number;
  /** 進み具合の輪の色（列ごと） */
  laneArc: { dis: number; asm: number; ship: number };
  /** 詰まりを知らせる床の縁の色（列の色） */
  laneEdge: { dis: number; asm: number; ship: number };
}

const PARTS = [0x4b78d6, 0xeef1f5, 0x3fa36b, 0xc8453c, 0x3f444c, 0xe3b23c];

const day: RoomPalette = {
  shadow: 0xb3d2e1,
  slabLeft: 0xb9beb6,
  slabRight: 0xcdd1ca,
  wallLeft: 0xe4ded4,
  wallRight: 0xf1ece4,
  wallTop: 0xffffff,
  wallEnd: 0xc9c3b8,
  concrete: 0xd9dde1,
  wood: 0xe6cba2,
  woodPlank: 0xdcbf93,
  tile: 0xece7df,
  tileGrout: 0xdcd4c6,
  windowFrame: 0xffffff,
  glass: 0xa9ddf3,
  glassGlow: false,
  furniture: { top: 0xe8d2ac, left: 0xc4a579, right: 0xd2b68d },
  metalPost: boxOf(0x8f97a1),
  shelf: { top: 0xdfe3e8, left: 0xb6bdc5, right: 0xc9ced5 },
  junk: { top: 0xb9c0c9, left: 0x8a929d, right: 0xa2aab4 },
  junkSlot: 0x6b7480,
  mat: 0x2a9d8f,
  bin: { top: 0x3aa59b, left: 0x257c76, right: 0x2e918a },
  parts: PARTS,
  cardboard: { top: 0xdcb47c, left: 0xb88a4e, right: 0xcda266 },
  cardboardInner: 0xa8783f,
  tape: 0xe9cf9f,
  pc: { top: 0x4a5260, left: 0x2b313a, right: 0x373e49 },
  led: 0x3be0a0,
  board: 0x3fa36b,
  chair: { top: 0x30363f, left: 0x1e232b, right: 0x262c35 },
  bezel: { top: 0x3f444c, left: 0x23282f, right: 0x2b313a },
  screen: 0x7fb6e8,
  screenGlow: false,
  posterFrame: 0xc8641a,
  posterInner: 0xf6d5ae,
  door: 0xfff3d2,
  doorGlow: false,
  cork: 0xc9a06a,
  slip: 0xffffff,
  pin: 0xc8453c,
  printer: { top: 0xf4f6f8, left: 0xcfd6de, right: 0xe3e8ee },
  phone: 0x2b313a,
  phoneScreen: 0x7fd0f5,
  road: { top: 0x9aa3ad, left: 0x6e7782, right: 0x848d98 },
  roadStripe: 0xffffff,
  van: { top: 0xffffff, left: 0xd5dce5, right: 0xe8edf3 },
  vanWindow: 0x7fa3c8,
  vanStripe: 0x3552c4,
  kit: { top: 0x8a63cf, left: 0x55309a, right: 0x6b3fb8 },
  lightPool: 0xfff6d8,
  lightPoolAlpha: 0,
  playerBody: 0x1f2a37,
  workerBody: 0xf08a2a,
  skin: 0xf2c6a0,
  hair: 0x3b2f2a,
  playerRing: 0x1f2a37,
  workerRing: 0xf08a2a,
  personShadow: 0x1f2a37,
  ringDisc: 0xffffff,
  ringTrack: 0xe3e8ee,
  laneArc: { dis: 0x1d7a74, asm: 0xb4560a, ship: 0x3552c4 },
  laneEdge: { dis: 0x1d7a74, asm: 0xb4560a, ship: 0x3552c4 },
};

const night: RoomPalette = {
  ...day,
  shadow: 0x0e1525,
  slabLeft: 0x18223a,
  slabRight: 0x1f2b47,
  wallLeft: 0x28344f,
  wallRight: 0x2f3c5c,
  wallTop: 0x3b4a6c,
  wallEnd: 0x222c45,
  concrete: 0x3b4559,
  wood: 0x5b4631,
  woodPlank: 0x503d2a,
  tile: 0x4a4b57,
  tileGrout: 0x3e3f4a,
  windowFrame: 0x3b4a6c,
  glass: 0xffd66b,
  glassGlow: true,
  furniture: { top: 0x846e4d, left: 0x5e4d35, right: 0x735f45 },
  metalPost: boxOf(0x5c6573),
  shelf: { top: 0x55607a, left: 0x3c4559, right: 0x48526a },
  junk: { top: 0x737d8b, left: 0x505866, right: 0x626b79 },
  junkSlot: 0x3c434f,
  mat: 0x1f7068,
  bin: { top: 0x2a7f78, left: 0x1a5752, right: 0x216863 },
  parts: [0x4169c0, 0xc9ced8, 0x358c5b, 0xb23b33, 0x2c3037, 0xc99d33],
  cardboard: { top: 0x9c7a50, left: 0x755836, right: 0x8a6a43 },
  cardboardInner: 0x5f4629,
  tape: 0xae9468,
  pc: { top: 0x3d4452, left: 0x1f242c, right: 0x2b313a },
  chair: { top: 0x252a33, left: 0x15191f, right: 0x1b2027 },
  bezel: { top: 0x2c3139, left: 0x15191f, right: 0x1b2027 },
  screen: 0x9fe3ff,
  screenGlow: true,
  posterFrame: 0xb4560a,
  posterInner: 0xf6d5ae,
  door: 0xffe9a8,
  doorGlow: true,
  cork: 0x8c6c45,
  slip: 0xe6eaf2,
  printer: { top: 0xb9c2ce, left: 0x7f8a99, right: 0x9aa5b3 },
  phone: 0x15191f,
  phoneScreen: 0x9fe3ff,
  road: { top: 0x3f4758, left: 0x262c38, right: 0x323948 },
  roadStripe: 0xc9d1dc,
  van: { top: 0xc9d1dc, left: 0x8e99a8, right: 0xaab4c1 },
  vanWindow: 0xffd66b,
  kit: { top: 0x7a55bd, left: 0x482a85, right: 0x5c36a0 },
  lightPool: 0xffe3a0,
  lightPoolAlpha: 0.22,
  personShadow: 0x000000,
  ringDisc: 0x22304e,
  ringTrack: 0x34466b,
  laneArc: { dis: 0x3fb8ae, asm: 0xf6a04d, ship: 0x8fa2ff },
};

export function roomPalette(theme: Theme): RoomPalette {
  return theme === 'night' ? night : day;
}
