import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceMeters, shouldAcceptFix, isStoredPointFresh, MIN_MOVE_METERS } from './geo.ts';

const lviv = { lat: 49.8397, lng: 24.0297 };

test('відстань між відомими точками', () => {
  // Львів -> Київ ~ 470 км по прямій
  const d = distanceMeters(lviv, { lat: 50.4501, lng: 30.5234 });
  assert.ok(d > 460_000 && d < 480_000, String(d));
  assert.equal(Math.round(distanceMeters(lviv, lviv)), 0);
});

test('перше визначення приймаємо завжди', () => {
  assert.equal(shouldAcceptFix(null, lviv, 5000), true);
});

test('дрібний «дрейф» GPS не змінює місце', () => {
  const near = { lat: lviv.lat + 0.0003, lng: lviv.lng }; // ~33 м
  assert.equal(shouldAcceptFix(lviv, near, 20), false);
});

test('помітний рух змінює місце', () => {
  const moved = { lat: lviv.lat + 0.005, lng: lviv.lng }; // ~555 м
  assert.equal(shouldAcceptFix(lviv, moved, 20), true);
});

test('рух мусить перевищити половину похибки вимірювання', () => {
  const moved = { lat: lviv.lat + 0.002, lng: lviv.lng }; // ~222 м
  assert.equal(shouldAcceptFix(lviv, moved, 800), false); // похибка 800 м: 222 м - це шум
  assert.equal(shouldAcceptFix(lviv, moved, 100), true);
});

test('надто неточний сигнал не перебиває відоме місце', () => {
  const far = { lat: 50.45, lng: 30.52 };
  assert.equal(shouldAcceptFix(lviv, far, 50_000), false);
  assert.ok(MIN_MOVE_METERS > 0);
});

test('свіжість збереженої точки', () => {
  const now = 1_000_000_000_000;
  assert.equal(isStoredPointFresh(now - 60_000, now), true);
  assert.equal(isStoredPointFresh(now - 4 * 3600_000, now), false);
  assert.equal(isStoredPointFresh(0, now), false);
  assert.equal(isStoredPointFresh(now + 5000, now), false); // з майбутнього - підозріло
});
