import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { saveDirectLinkToken, getDirectLinkToken, DIRECT_LINK_DAYS } from './direct-link.ts';

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, v); },
};
const realNow = Date.now;
const DAY = 86400000;

beforeEach(() => { store.clear(); Date.now = realNow; });

test('tokens are kept per salon: a second salon does not overwrite the first', () => {
  saveDirectLinkToken(1, 'tok-a');
  saveDirectLinkToken(2, 'tok-b');
  assert.equal(getDirectLinkToken(1), 'tok-a');
  assert.equal(getDirectLinkToken(2), 'tok-b');
  assert.equal(getDirectLinkToken(3), undefined);
});

test('token is valid within the window and expires after it', () => {
  const t0 = realNow();
  Date.now = () => t0;
  saveDirectLinkToken(1, 'tok-a');
  Date.now = () => t0 + (DIRECT_LINK_DAYS - 1) * DAY;
  assert.equal(getDirectLinkToken(1), 'tok-a');
  Date.now = () => t0 + (DIRECT_LINK_DAYS + 1) * DAY;
  assert.equal(getDirectLinkToken(1), undefined);
});

test('a fresh click renews the window', () => {
  const t0 = realNow();
  Date.now = () => t0;
  saveDirectLinkToken(1, 'tok-a');
  Date.now = () => t0 + 25 * DAY;
  saveDirectLinkToken(1, 'tok-a');
  Date.now = () => t0 + 50 * DAY;
  assert.equal(getDirectLinkToken(1), 'tok-a');
});

test('garbage in storage is ignored', () => {
  store.set('direct_link_tokens', '{"1":"just-a-string"}');
  assert.equal(getDirectLinkToken(1), undefined);
  store.set('direct_link_tokens', 'not json');
  assert.equal(getDirectLinkToken(1), undefined);
});
