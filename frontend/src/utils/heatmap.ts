/** 出单率热力色：0% 淡灰，越高越绿 */
export function orderRateHeatColor(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return "#f5f5f5";
  if (rate <= 0) return "#ececec";
  const t = Math.min(rate / 100, 1);
  const r = Math.round(236 - t * 176);
  const g = Math.round(240 - t * 70);
  const b = Math.round(241 - t * 141);
  return `rgb(${r}, ${g}, ${b})`;
}
