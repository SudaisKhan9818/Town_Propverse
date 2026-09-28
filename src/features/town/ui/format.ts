// format.ts — human micro-copy helpers for town UI.

import type { CivicKind, PlotSize, UnitStatus } from '@/src/shared/types/town';
import { COLORS } from '@/src/shared/theme/tokens';

/** PKR in the units buyers actually say: Crore / Lakh. */
export function formatPkr(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return '—';
  if (value >= 10_000_000) return `PKR ${(value / 10_000_000).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  if (value >= 100_000) return `PKR ${(value / 100_000).toFixed(1).replace(/\.0$/, '')} Lakh`;
  return `PKR ${value.toLocaleString('en-PK')}`;
}

export const SIZE_LABEL: Record<PlotSize, string> = {
  '5marla': '5 Marla',
  '7marla': '7 Marla',
  '12marla': '12 Marla',
};

export const STATUS: Record<UnitStatus, { label: string; color: string }> = {
  free: { label: 'Free', color: COLORS.statusFree },
  allotted: { label: 'Allotted', color: COLORS.statusAllotted },
  rented: { label: 'Rented', color: COLORS.statusRented },
};

export const CIVIC_LABEL: Record<CivicKind, string> = {
  school: 'School',
  hospital: 'Hospital',
  police: 'Police',
  fire: 'Fire & Rescue',
  wapda: 'Utilities',
  park: 'Park',
  market: 'Market',
  masjid: 'Masjid',
};

/** "+92 309 4842579" → "+92 309 ••• ••79". */
export function maskPhone(raw: string | undefined): string {
  if (!raw) return '—';
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 6) return raw;
  const last = digits.slice(-2);
  const head = raw.trim().split(/\s+/).slice(0, 2).join(' ');
  return `${head} ••• ••${last}`;
}

export function initials(name: string | undefined): string {
  if (!name) return '·';
  const words = name.replace(/^(Dr|Mr|Mrs|Ms|Insp|Engr|Stn|Maulana|Mian|Sheikh)\.?\s+/i, '').split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? '') + (words[1]?.[0] ?? '');
}

export function formatDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(`${value}T00:00:00`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
