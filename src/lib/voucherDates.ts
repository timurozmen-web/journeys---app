import { formatDate } from './format';

// When a voucher can be used: one issued in the future (a renewal reward)
// says when it arrives; otherwise when it runs out, if known.
export function voucherDates(v: { earnedDate: string; expiryDate: string | null }, today: string): string {
  if (v.earnedDate > today) return `From ${formatDate(v.earnedDate)}${v.expiryDate ? ` · until ${formatDate(v.expiryDate)}` : ''}`;
  return v.expiryDate ? `Until ${formatDate(v.expiryDate)}` : '';
}
