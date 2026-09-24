const nf = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 });

/** ¥43,960（マイナスは −¥1,500） */
export function yen(n: number): string {
  const v = Math.round(n);
  return v < 0 ? `−¥${nf.format(-v)}` : `¥${nf.format(v)}`;
}

/** +¥16,320 / −¥1,500 */
export function signedYen(n: number): string {
  const v = Math.round(n);
  return v < 0 ? `−¥${nf.format(-v)}` : `+¥${nf.format(v)}`;
}

export function num(n: number): string {
  return nf.format(Math.round(n));
}

/** 残り秒数（切り上げ） */
export function secs(n: number): string {
  return `${Math.max(0, Math.ceil(n - 1e-6))}秒`;
}

/** 経過した時間（3分12秒 / 1時間5分） */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}時間${m}分`;
  if (m > 0) return `${m}分${r}秒`;
  return `${r}秒`;
}

/** 台/分（小数は1桁まで） */
export function perMin(n: number): string {
  const v = Math.round(n * 10) / 10;
  return Number.isInteger(v) ? `${v}` : v.toFixed(1);
}

export function ratio(after: number, now: number): string | null {
  if (!(now > 0)) return null;
  return `×${(after / now).toFixed(1)}`;
}
