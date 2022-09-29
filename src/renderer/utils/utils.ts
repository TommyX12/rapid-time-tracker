import convert from 'color-convert';
import Color from 'color';
import { useCallback, useEffect, useReducer } from 'react';

export function padNum(num: number, digits: number) {
  return num.toString().padStart(digits, '0');
}

export function lerp(a: number, b: number, x: number) {
  return a + (b - a) * x;
}

export function linearMap(
  inStart: number,
  inEnd: number,
  outStart: number,
  outEnd: number,
  value: number
) {
  return (
    outStart + ((value - inStart) * (outEnd - outStart)) / (inEnd - inStart)
  );
}

export function clampedLinearMap(
  inStart: number,
  inEnd: number,
  outStart: number,
  outEnd: number,
  value: number
) {
  return Math.min(
    Math.max(linearMap(inStart, inEnd, outStart, outEnd, value), outStart),
    outEnd
  );
}

export function clamp(x: number, min: number, max: number) {
  return Math.min(Math.max(x, min), max);
}

export function random(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function generateColor() {
  const [r, g, b] = convert.hsl.rgb([
    random(0, 360),
    random(50, 100),
    random(50, 75),
  ]);
  return Color.rgb(r, g, b);
}

export function firstGeq<T, K>(
  array: T[],
  value: K,
  lessThan: (a: K, b: K) => boolean,
  keyAt: (item: T) => K
): number {
  let i: number;
  let first = 0;
  let step: number;
  let count: number = array.length;
  while (count > 0) {
    step = Math.floor(count / 2);
    i = first + step;
    if (lessThan(keyAt(array[i]), value)) {
      first = i + 1;
      count -= step + 1;
    } else count = step;
  }
  return first;
}

export function firstLessThan<T, K>(
  array: T[],
  value: K,
  lessThan: (a: K, b: K) => boolean,
  keyAt: (item: T) => K
): number {
  return firstGeq(array, value, lessThan, keyAt) - 1;
}

export class Counter<K> {
  private data = new Map<K, number>();

  add(key: K, amount: number) {
    this.data.set(key, (this.data.get(key) || 0) + amount);
  }

  get(key: K) {
    return this.data.get(key) || 0;
  }

  clear() {
    this.data = new Map<K, number>();
  }

  copyFrom(other: Counter<K>) {
    this.data.clear();
    other.data.forEach((count, key) => {
      this.data.set(key, count);
    });
  }
}

export function isOverlayOpen() {
  return document.body.classList.contains('bp4-overlay-open');
}

export function useGlobalShortcutKey(key: string, callback: () => void) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.target !== document.body) return;
      if (isOverlayOpen()) return;
      if (e.key === key) {
        callback();
        e.preventDefault();
      }
    };
    document.body.addEventListener('keydown', fn);
    return () => document.body.removeEventListener('keydown', fn);
  }, [key, callback]);
}

export type Notifier = number;
const INITIAL_NOTIFIER: Notifier = 0;

export function useNotifier() {
  const [notifier, dispatch] = useReducer((s: Notifier, a: number) => {
    return s + a;
  }, INITIAL_NOTIFIER);
  const notify = useCallback(() => {
    dispatch(1);
  }, [dispatch]);
  return [notifier, notify] as [Notifier, () => void];
}

export function prettyNumber(
  x: number,
  isPercentage = false,
  maxFractionalDigits = 1
) {
  let n = x;
  if (isPercentage) {
    n *= 100;
  }
  let result = n.toFixed(maxFractionalDigits);
  if (result.endsWith('0')) result = result.substring(0, result.length - 2);
  return isPercentage ? `${result}%` : result;
}
