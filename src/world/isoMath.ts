/**
 * アイソメトリック（30°）の座標の計算だけ（PixiJS を使わない。画面の部品からも使う）。
 * 部屋の床の奥の角が (0,0,0)。x は右手前、y は左手前、z は上。単位は u ピクセル。
 */
export interface IsoFrame {
  /** 床の奥の角の画面上の位置 */
  ox: number;
  oy: number;
  /** 1マスの長さ（ピクセル） */
  u: number;
}

export const COS30 = Math.cos(Math.PI / 6);

export function project(f: IsoFrame, x: number, y: number, z = 0): { x: number; y: number } {
  return { x: f.ox + (x - y) * COS30 * f.u, y: f.oy + (x + y) * 0.5 * f.u - z * f.u };
}
