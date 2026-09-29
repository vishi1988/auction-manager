import type { Unit } from '../types';

export const r2 = (x: number) => Math.round(x * 100) / 100;

export function money(amount: number | null | undefined, unit: Unit): string {
  if (amount == null) return '—';
  if (unit === 'pts') return amount.toLocaleString('en-IN') + ' pts';
  return '₹' + amount.toFixed(2) + ' ' + unit;
}

/** Short form without the unit, for tight spots like team buttons. */
export function amountShort(amount: number, unit: Unit): string {
  return unit === 'pts' ? amount.toLocaleString('en-IN') : '₹' + amount.toFixed(2);
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export const uid = (prefix: string) => prefix + '_' + Math.random().toString(36).slice(2, 9);
