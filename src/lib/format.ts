const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m: m - 1, d };
}

export function formatDate(iso: string) {
  const { y, m, d } = parts(iso);
  return `${d} ${MONTHS[m]} ${y}`;
}

// "11 - 18 August 2026" for a same-month range, "27 Feb - 1 Mar 2026" across
// months, "28 Dec 2026 - 3 Jan 2027" across years.
export function formatDateRange(startIso: string, endIso: string) {
  const s = parts(startIso);
  const e = parts(endIso);
  if (s.y === e.y && s.m === e.m) {
    return `${s.d} - ${e.d} ${MONTHS[s.m]} ${s.y}`;
  }
  if (s.y === e.y) {
    return `${s.d} ${MONTHS_SHORT[s.m]} - ${e.d} ${MONTHS_SHORT[e.m]} ${s.y}`;
  }
  return `${s.d} ${MONTHS_SHORT[s.m]} ${s.y} - ${e.d} ${MONTHS_SHORT[e.m]} ${e.y}`;
}

// Line-item amounts show 2dp only when under £100 and the cents aren't
// .00 (no point showing decimals that add nothing); headline/big totals
// always round to whole pounds.
export function formatMoney(n: number) {
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  const hasCents = Math.round(abs * 100) % 100 !== 0;
  const showDecimals = abs < 100 && hasCents;
  return `${sign}£${abs.toLocaleString(undefined, { minimumFractionDigits: showDecimals ? 2 : 0, maximumFractionDigits: showDecimals ? 2 : 0 })}`;
}
export function formatMoneyHeadline(n: number) {
  const sign = n < 0 ? '−' : '';
  return `${sign}£${Math.round(Math.abs(n)).toLocaleString()}`;
}
