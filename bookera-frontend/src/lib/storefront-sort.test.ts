import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankBusinesses, effectiveKm, type SortBusiness, type SortContext, type SortRules } from './storefront-sort.ts';

// Правила, як з /businesses/ranking-rules
const RULES: SortRules = {
  weights: { quality_max: 45, proximity_max: 20, free_slots: 15, radar: 20 },
  proximity_radius_km: 10,
  nearby_radius_km: 15,
  radar_bonus_km: 2,
};

const biz = (id: number, over: Partial<SortBusiness> = {}): SortBusiness => ({
  id, rank_score: 30, is_radar_active: false, services: [{ price: 500 }], ...over,
});

function ctx(km: Record<number, number>, over: Partial<SortContext> = {}): SortContext {
  return {
    mode: 'distance', scope: 'near', rules: RULES, hasLocation: true,
    distanceKm: id => km[id], hasFreeSlots: () => false, ...over,
  };
}
const ids = (r: { items: { business: SortBusiness }[] }) => r.items.map(i => i.business.id);

test('Найближчі: від найближчого, без відстані - в кінці', () => {
  const list = [biz(1), biz(2), biz(3), biz(4)];
  const r = rankBusinesses(list, ctx({ 1: 5, 2: 1, 3: 3 }));
  assert.deepEqual(ids(r), [2, 3, 1, 4]);
  assert.equal(r.tiered, false);
});

test('Найближчі: Радар робить заклад ближчим на radar_bonus_km, але не більше', () => {
  const list = [biz(1), biz(2, { is_radar_active: true }), biz(3)];
  // 2 - 4.5 км, але з Радаром рахується як 2.5 км: випереджає 1 (3 км), але не 3 (1 км)
  assert.deepEqual(ids(rankBusinesses(list, ctx({ 1: 3, 2: 4.5, 3: 1 }))), [3, 2, 1]);
  assert.equal(effectiveKm(list[1], ctx({ 2: 1 })), 0, 'відстань не стає від’ємною');
});

test('Дешевші: спершу поруч за ціною, потім решта теж за ціною', () => {
  const list = [
    biz(1, { services: [{ price: 300 }] }),  // далеко, найдешевший
    biz(2, { services: [{ price: 700 }] }),  // поруч, дорогий
    biz(3, { services: [{ price: 400 }] }),  // поруч, дешевший
    biz(4, { services: [{ price: 350 }] }),  // далеко
  ];
  const r = rankBusinesses(list, ctx({ 1: 40, 2: 2, 3: 8, 4: 25 }, { mode: 'price' }));
  assert.deepEqual(ids(r), [3, 2, 1, 4]);
  assert.deepEqual(r.items.map(i => i.zone), ['near', 'near', 'far', 'far']);
  assert.equal(r.nearCount, 2);
  assert.equal(r.farCount, 2);
});

test('Дешевші, «По всьому місту»: чиста ціна без розподілу', () => {
  const list = [
    biz(1, { services: [{ price: 300 }] }),
    biz(2, { services: [{ price: 700 }] }),
    biz(3, { services: [{ price: 400 }] }),
  ];
  const r = rankBusinesses(list, ctx({ 1: 40, 2: 2, 3: 8 }, { mode: 'price', scope: 'all' }));
  assert.deepEqual(ids(r), [1, 3, 2]);
  assert.ok(r.items.every(i => i.zone === 'all'));
});

test('Дешевші: нічия за ціною - спершу Радар, потім ближчий; без цін - в кінці', () => {
  const list = [
    biz(1), biz(2, { is_radar_active: true }), biz(3),
    biz(4, { services: [] }),
  ];
  const r = rankBusinesses(list, ctx({ 1: 3, 2: 9, 3: 1, 4: 0 }, { mode: 'price' }));
  assert.deepEqual(ids(r), [2, 3, 1, 4]);
});

test('Заклад із Радаром за межею радіуса, але з бонусом, потрапляє в «поруч»', () => {
  const list = [biz(1, { services: [{ price: 900 }] }), biz(2, { is_radar_active: true, services: [{ price: 100 }] })];
  const r = rankBusinesses(list, ctx({ 1: 5, 2: 16 }, { mode: 'price' }));
  assert.deepEqual(r.items.map(i => i.zone), ['near', 'near']);
  assert.deepEqual(ids(r), [2, 1]);
  const r2 = rankBusinesses(list, ctx({ 1: 5, 2: 18 }, { mode: 'price' }));
  assert.deepEqual(ids(r2), [1, 2], '18 - 2 = 16 > 15: далеко');
});

test('Рекомендовані: найвищий бал поруч - першим, далекий лідер - після блоку «поруч»', () => {
  const list = [
    biz(1, { rank_score: 44 }),   // далеко, дуже якісний
    biz(2, { rank_score: 25 }),   // поруч
    biz(3, { rank_score: 35 }),   // поруч, кращий
  ];
  const r = rankBusinesses(list, ctx({ 1: 30, 2: 1, 3: 4 }, { mode: 'recommended' }));
  assert.deepEqual(ids(r), [3, 2, 1]);
  const all = rankBusinesses(list, ctx({ 1: 30, 2: 1, 3: 4 }, { mode: 'recommended', scope: 'all' }));
  // По всьому місту блок «поруч» не виділяється, але близькість лишається балами (до 20):
  // 3 = 35 + 12 = 47, 1 = 44 + 0, 2 = 25 + 18 = 43
  assert.deepEqual(ids(all), [3, 1, 2], 'далекий лідер (1) випереджає лише тих, хто слабший за нього навіть із балами за близькість');
  const far = rankBusinesses([biz(1, { rank_score: 44 }), biz(2, { rank_score: 25 })], ctx({ 1: 30, 2: 1 }, { mode: 'recommended', scope: 'all' }));
  assert.deepEqual(ids(far), [1, 2], '44 проти 25 + 18 = 43');
});

test('Рекомендовані: вільні вікна сьогодні додають бали', () => {
  const list = [biz(1, { rank_score: 30 }), biz(2, { rank_score: 30 })];
  const r = rankBusinesses(list, ctx({ 1: 3, 2: 3 }, { mode: 'recommended', hasFreeSlots: id => id === 2 }));
  assert.deepEqual(ids(r), [2, 1]);
});

test('Без місця людини розподілу на «поруч / далі» немає, порядок - за правилом режиму', () => {
  const list = [
    biz(1, { services: [{ price: 300 }] }), biz(2, { services: [{ price: 100 }] }),
  ];
  const r = rankBusinesses(list, ctx({}, { mode: 'price', hasLocation: false }));
  assert.deepEqual(ids(r), [2, 1]);
  assert.equal(r.tiered, false);
});

test('Без правил із сервера: рекомендовані - за вікнами, відгуками, рейтингом', () => {
  const list = [
    biz(1, { rank_score: null, rating: 5, reviews_count: 1 }),
    biz(2, { rank_score: null, rating: 4.8, reviews_count: 120 }),
  ];
  const r = rankBusinesses(list, ctx({ 1: 1, 2: 1 }, { mode: 'recommended', rules: null }));
  assert.deepEqual(ids(r), [2, 1], '4.8 зі ста відгуків вище за 5.0 з одного');
  assert.equal(r.tiered, false);
});

test('Порядок однозначний: не залежить від початкового порядку списку', () => {
  const base = [1, 2, 3, 4, 5, 6].map(i => biz(i, { rank_score: 30, services: [{ price: 500 }] }));
  const c = ctx({ 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3 }, { mode: 'price' });
  const a = ids(rankBusinesses(base, c));
  const b = ids(rankBusinesses([...base].reverse(), c));
  assert.deepEqual(a, b);
});
