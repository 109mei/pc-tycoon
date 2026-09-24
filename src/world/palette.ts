import type { PartType } from '../core/types';
import { boxOf, type BoxColors } from './gfx';

export type Theme = 'day' | 'night';

/** 部屋の中の色（床・壁・家具は docs/rough の画像をもとに、写実寄りに足した） */
export interface RoomPalette {
  night: boolean;
  shadow: number;
  slabLeft: number;
  slabRight: number;
  wallLeft: number;
  wallRight: number;
  wallTop: number;
  wallEnd: number;
  baseboard: number;
  concrete: number;
  concreteSpot: number;
  wood: number;
  woodAlt: number;
  woodSeam: number;
  tile: number;
  tileAlt: number;
  tileGrout: number;
  windowFrame: number;
  glass: number;
  glassShine: number;
  sunlight: number;
  sunlightAlpha: number;
  lamp: number;
  lampAlpha: number;
  furniture: BoxColors;
  furnitureLeg: BoxColors;
  metal: BoxColors;
  metalDark: BoxColors;
  shelf: BoxColors;
  junk: BoxColors;
  junkPanel: number;
  junkDark: number;
  mat: number;
  matLine: number;
  bin: BoxColors;
  ewaste: BoxColors;
  /** 部品の色（種類ごと） */
  part: Record<PartType, BoxColors>;
  partMark: Record<PartType, number>;
  cardboard: BoxColors;
  cardboardInner: number;
  tape: number;
  label: number;
  pc: BoxColors;
  pcAccent: number;
  led: number;
  chair: BoxColors;
  bezel: BoxColors;
  screen: number;
  screenBar: number;
  screenGlow: boolean;
  poster: number;
  posterInner: number;
  plantPot: BoxColors;
  plant: number;
  plantDark: number;
  door: number;
  doorFrame: number;
  doorGlow: boolean;
  cork: number;
  slip: number;
  pin: number;
  printer: BoxColors;
  phone: number;
  phoneScreen: number;
  road: BoxColors;
  roadLine: number;
  curb: BoxColors;
  van: BoxColors;
  vanWindow: number;
  vanStripe: number;
  tire: number;
  kit: BoxColors;
  cart: BoxColors;
  tray: BoxColors;
  playerShirt: number;
  workerShirt: number;
  pants: number;
  skin: number;
  hair: number;
  playerRing: number;
  workerRing: number;
  ringDisc: number;
  ringTrack: number;
  /** 進み具合の輪の色（列ごと） */
  laneArc: { dis: number; asm: number; ship: number };
  /** 詰まりを知らせる床の縁の色（列の色） */
  laneEdge: { dis: number; asm: number; ship: number };
}

const day: RoomPalette = {
  night: false,
  shadow: 0xa9cadb,
  slabLeft: 0xb4b9b1,
  slabRight: 0xc9cdc6,
  wallLeft: 0xe6e0d6,
  wallRight: 0xf2ede5,
  wallTop: 0xffffff,
  wallEnd: 0xcac4b9,
  baseboard: 0xd8d0c3,
  concrete: 0xd6dade,
  concreteSpot: 0xc9ced4,
  wood: 0xe3c69b,
  woodAlt: 0xdcbd90,
  woodSeam: 0xc9a877,
  tile: 0xece6dd,
  tileAlt: 0xe6dfd4,
  tileGrout: 0xd5ccbe,
  windowFrame: 0xffffff,
  glass: 0xa9dcf2,
  glassShine: 0xd9f1fb,
  sunlight: 0xfff4d6,
  sunlightAlpha: 0.55,
  lamp: 0xffe2a0,
  lampAlpha: 0,
  furniture: { top: 0xe9d1a8, left: 0xbf9f72, right: 0xd4b688 },
  furnitureLeg: { top: 0xb69568, left: 0x9d7d52, right: 0xb08f62 },
  metal: { top: 0xdde2e8, left: 0xaeb6c0, right: 0xc4cbd3 },
  metalDark: { top: 0x9aa3ae, left: 0x6f7883, right: 0x858e99 },
  shelf: { top: 0xe3e7ec, left: 0xb3bac3, right: 0xc9cfd6 },
  junk: { top: 0xd8d2c4, left: 0xa9a293, right: 0xc4bdad },
  junkPanel: 0xb8b1a1,
  junkDark: 0x5f5a50,
  mat: 0x2a8f84,
  matLine: 0x3aa196,
  bin: { top: 0x4a8fc7, left: 0x2f6a9a, right: 0x3b7db2 },
  ewaste: { top: 0xd35a4b, left: 0xa43d31, right: 0xbf4b3e },
  part: {
    board: { top: 0x3fae70, left: 0x23794a, right: 0x2f9461 },
    memory: { top: 0x5d8be6, left: 0x2f58b0, right: 0x3f6fd1 },
    storage: { top: 0x4a525e, left: 0x2c323b, right: 0x3a414c },
    power: { top: 0xc4ccd6, left: 0x8f99a6, right: 0xaab4c1 },
  },
  partMark: { board: 0xe3b23c, memory: 0x1f2a37, storage: 0xe3b23c, power: 0x4a525e },
  cardboard: { top: 0xdcb47c, left: 0xb3854a, right: 0xcaa064 },
  cardboardInner: 0xa0723a,
  tape: 0xe9d3a6,
  label: 0xffffff,
  pc: { top: 0x3d4450, left: 0x1f242c, right: 0x2c323b },
  pcAccent: 0x5aa9ff,
  led: 0x3be0a0,
  chair: { top: 0x3a414c, left: 0x1e232b, right: 0x2a3039 },
  bezel: { top: 0x3f444c, left: 0x1e232a, right: 0x2b313a },
  screen: 0x3f7fd9,
  screenBar: 0xffffff,
  screenGlow: false,
  poster: 0xc8641a,
  posterInner: 0xf6d5ae,
  plantPot: { top: 0xe0e4ea, left: 0xb3bac4, right: 0xc9cfd8 },
  plant: 0x4fa36a,
  plantDark: 0x2f7a48,
  door: 0xfff3d2,
  doorFrame: 0xffffff,
  doorGlow: false,
  cork: 0xc9a06a,
  slip: 0xffffff,
  pin: 0xd0473d,
  printer: { top: 0xf4f6f8, left: 0xc9d0d8, right: 0xdfe4ea },
  phone: 0x22272e,
  phoneScreen: 0x8fd6f5,
  road: { top: 0x979fa9, left: 0x6a727c, right: 0x80888f },
  roadLine: 0xffffff,
  curb: { top: 0xd3d6da, left: 0xa7abb1, right: 0xbcc0c5 },
  van: { top: 0xffffff, left: 0xd3dae3, right: 0xe9eef4 },
  vanWindow: 0x6f97c2,
  vanStripe: 0x3552c4,
  tire: 0x2a2f36,
  kit: { top: 0x8a63cf, left: 0x55309a, right: 0x6b3fb8 },
  cart: { top: 0xcfd5dc, left: 0x8f98a3, right: 0xa9b1bb },
  tray: { top: 0x3d4450, left: 0x262b33, right: 0x323841 },
  playerShirt: 0x2b3a52,
  workerShirt: 0xf08a2a,
  pants: 0x39414d,
  skin: 0xf2c6a0,
  hair: 0x3b2f2a,
  playerRing: 0x1f2a37,
  workerRing: 0xf08a2a,
  ringDisc: 0xffffff,
  ringTrack: 0xe3e8ee,
  laneArc: { dis: 0x1d7a74, asm: 0xb4560a, ship: 0x3552c4 },
  laneEdge: { dis: 0x1d7a74, asm: 0xb4560a, ship: 0x3552c4 },
};

const night: RoomPalette = {
  ...day,
  night: true,
  shadow: 0x0c1322,
  slabLeft: 0x151e33,
  slabRight: 0x1c2741,
  wallLeft: 0x263250,
  wallRight: 0x2d3a5c,
  wallTop: 0x3a486b,
  wallEnd: 0x1f2942,
  baseboard: 0x222c46,
  concrete: 0x384257,
  concreteSpot: 0x323b4f,
  wood: 0x584330,
  woodAlt: 0x523e2c,
  woodSeam: 0x3f2f21,
  tile: 0x474855,
  tileAlt: 0x42434f,
  tileGrout: 0x393a45,
  windowFrame: 0x3a486b,
  glass: 0xffd66b,
  glassShine: 0xffe8a6,
  sunlight: 0xffd66b,
  sunlightAlpha: 0.18,
  lamp: 0xffd27a,
  lampAlpha: 0.42,
  furniture: { top: 0x846e4d, left: 0x5a4a33, right: 0x6f5c42 },
  furnitureLeg: { top: 0x5d4c35, left: 0x453827, right: 0x52432f },
  metal: { top: 0x5f6b82, left: 0x3f4a5e, right: 0x4d5870 },
  metalDark: { top: 0x4a5468, left: 0x2f3747, right: 0x3b4456 },
  shelf: { top: 0x5a6680, left: 0x3c4659, right: 0x4a556c },
  junk: { top: 0x8a8578, left: 0x5f5b52, right: 0x767166 },
  junkPanel: 0x6c675c,
  junkDark: 0x2c2a26,
  mat: 0x1e6d65,
  matLine: 0x28807a,
  bin: { top: 0x3b77a8, left: 0x234f73, right: 0x2d628d },
  ewaste: { top: 0xb04b3f, left: 0x7e3028, right: 0x963c33 },
  part: {
    board: { top: 0x379a63, left: 0x1e6a41, right: 0x288255 },
    memory: { top: 0x5078cf, left: 0x2a4d9b, right: 0x3761bb },
    storage: { top: 0x3d4450, left: 0x22272e, right: 0x30363f },
    power: { top: 0x9aa4b2, left: 0x68717e, right: 0x808a97 },
  },
  cardboard: { top: 0x9c7a50, left: 0x70542f, right: 0x86673f },
  cardboardInner: 0x5c4326,
  tape: 0xae9468,
  label: 0xd9dee7,
  pc: { top: 0x363d49, left: 0x1a1e25, right: 0x262b33 },
  chair: { top: 0x2c323c, left: 0x15191f, right: 0x1e232a },
  bezel: { top: 0x2c3139, left: 0x15191f, right: 0x1b2027 },
  screen: 0x6fb6ff,
  screenGlow: true,
  posterInner: 0xd9b88f,
  plantPot: { top: 0x7c8699, left: 0x4f586a, right: 0x646e81 },
  plant: 0x357a4c,
  plantDark: 0x215533,
  door: 0xffe9a8,
  doorFrame: 0x3a486b,
  doorGlow: true,
  cork: 0x8c6c45,
  slip: 0xe6eaf2,
  printer: { top: 0xb9c2ce, left: 0x7f8a99, right: 0x9aa5b3 },
  phone: 0x111418,
  phoneScreen: 0x9fe3ff,
  road: { top: 0x3c4455, left: 0x242a36, right: 0x303746 },
  roadLine: 0xc9d1dc,
  curb: { top: 0x5a6378, left: 0x3a4152, right: 0x485064 },
  van: { top: 0xc9d1dc, left: 0x8e99a8, right: 0xaab4c1 },
  vanWindow: 0xffd66b,
  tire: 0x111418,
  kit: { top: 0x7a55bd, left: 0x482a85, right: 0x5c36a0 },
  cart: { top: 0x6c7690, left: 0x444d62, right: 0x566078 },
  tray: { top: 0x2e343f, left: 0x1b1f26, right: 0x252a32 },
  playerShirt: 0xdfe6f2,
  pants: 0x283042,
  playerRing: 0xdfe6f2,
  ringDisc: 0x22304e,
  ringTrack: 0x34466b,
  laneArc: { dis: 0x3fb8ae, asm: 0xf6a04d, ship: 0x8fa2ff },
};

export function roomPalette(theme: Theme): RoomPalette {
  return theme === 'night' ? night : day;
}

export { boxOf };
