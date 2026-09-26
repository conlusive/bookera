/**
 * Категорії закладів - ЄДИНИЙ список на весь сайт.
 *
 * Раніше їх було пʼять, і жоден не збігався з іншим: реєстрація знала
 * `wellness` і `home_services`, головна - `spa` і `home-services`,
 * налаштування - `beauty`. Заклад, зареєстрований як `wellness`, не
 * знаходився в «Масаж і SPA», а «Послуги на дому» не знаходились ніде.
 *
 * Тепер головна, реєстрація, налаштування закладу, картка й профіль
 * беруть категорії звідси. Бекенд має дзеркальний список
 * (app/core/categories.py) з тими самими кодами.
 *
 *   title - назва на кнопці категорії й у картці
 *   place - хто це, у множині: для заголовка «Барбершопи поблизу»
 *   terms - слова для пошуку: «педикюр» знаходить «Манікюр»
 *   main  - показувати в основному ряду чи в «Більше…»
 */
export type Category = { slug: string; title: string; place: string; terms: string[]; main: boolean };

export const CATEGORIES: Category[] = [
  { slug: 'hair', title: 'Волосся', place: 'Перукарні', main: true, terms: ['волос', 'перукар', 'стрижк', 'зачіск', 'фарбув', 'укладк', 'hair'] },
  { slug: 'barber', title: 'Барбершоп', place: 'Барбершопи', main: true, terms: ['барбер', 'barber', 'борід', 'бород', 'чоловіч'] },
  { slug: 'nails', title: 'Манікюр', place: 'Манікюрні студії', main: true, terms: ['манікюр', 'педикюр', 'нігт', 'nail', 'гель-лак'] },
  { slug: 'brows', title: 'Брови та вії', place: 'Студії брів і вій', main: true, terms: ['брів', 'брови', 'вії', 'вій', 'ламінув', 'lash', 'brow'] },
  { slug: 'skincare', title: 'Догляд за шкірою', place: 'Студії догляду', main: true, terms: ['догляд', 'шкір', 'чистк', 'пілінг', 'skin', 'facial'] },
  { slug: 'cosmetology', title: 'Косметологія', place: 'Косметологи', main: true, terms: ['косметолог', 'інʼєкц', "ін'єкц", 'ботокс', 'філер', 'естетичн'] },
  { slug: 'massage', title: 'Масаж і SPA', place: 'Масаж і SPA', main: true, terms: ['масаж', 'spa', 'спа', 'wellness', 'релакс'] },
  { slug: 'tattoo', title: 'Тату й пірсинг', place: 'Тату-студії', main: true, terms: ['тату', 'tattoo', 'пірсинг', 'piercing'] },
  { slug: 'epilation', title: 'Епіляція', place: 'Студії епіляції', main: true, terms: ['епіляц', 'депіляц', 'шугар', 'воск', 'лазерн'] },
  { slug: 'makeup', title: 'Макіяж', place: 'Візажисти', main: true, terms: ['макіяж', 'мейкап', 'візаж', 'makeup'] },
  { slug: 'home', title: 'Майстри з виїздом', place: 'Майстри з виїздом', main: false, terms: ['виїзд', 'на дому', 'додому'] },
  { slug: 'pets', title: 'Грумінг', place: 'Грумінг-салони', main: false, terms: ['грумінг', 'тварин', 'собак', 'котів', 'pet', 'groom'] },
  { slug: 'dentistry', title: 'Стоматологія', place: 'Стоматології', main: false, terms: ['стоматолог', 'зуб', 'dental'] },
  { slug: 'health', title: 'Здоровʼя', place: 'Центри здоровʼя', main: false, terms: ['здоров', 'самопочут', 'реабіліт', 'фізіо'] },
  // «Професійні послуги» нічого не описували - обʼєднано з «Інше».
  { slug: 'other', title: 'Інше', place: 'Заклади', main: false, terms: [] },
];

export const MAIN_CATEGORIES = CATEGORIES.filter(c => c.main);
export const MORE_CATEGORIES = CATEGORIES.filter(c => !c.main);

const BY_SLUG = new Map(CATEGORIES.map(c => [c.slug, c]));

/** Старі коди й назви -> код. Та сама таблиця, що на бекенді. */
const ALIASES: Record<string, string> = {
  'волосся': 'hair', 'перукарня': 'hair', 'перукарні': 'hair', 'салон краси': 'hair', beauty: 'hair', salon: 'hair',
  'барбер': 'barber', 'барбершоп': 'barber', 'барбершопи': 'barber',
  nail: 'nails', 'нігті': 'nails', 'манікюр': 'nails', 'манікюр і педикюр': 'nails', 'нігті та манікюр': 'nails',
  lashes: 'brows', 'брови': 'brows', 'брови та вії': 'brows',
  skin: 'skincare', 'догляд': 'skincare', 'догляд за шкірою': 'skincare',
  aesthetic: 'cosmetology', 'естетична медицина': 'cosmetology', 'косметологія': 'cosmetology',
  spa: 'massage', wellness: 'massage', 'масаж': 'massage', 'спа': 'massage', 'масаж та spa': 'massage', 'масаж і spa': 'massage', 'wellness & spa': 'massage',
  piercing: 'tattoo', 'тату': 'tattoo', 'пірсинг': 'tattoo', 'тату та пірсинг': 'tattoo', 'тату й пірсинг': 'tattoo', 'пірсинг студії': 'tattoo',
  hair_removal: 'epilation', 'hair-removal': 'epilation', 'епіляція': 'epilation', 'видалення волосся': 'epilation',
  'макіяж': 'makeup', 'макіяж та візаж': 'makeup',
  home_services: 'home', 'home-services': 'home', 'послуги на дому': 'home', 'майстри з виїздом': 'home',
  'домашні улюбленці': 'pets', 'грумінг': 'pets',
  'стоматологія': 'dentistry',
  "здоров'я": 'health', 'здоровʼя': 'health', "здоров'я та самопочуття": 'health',
  professional: 'other', 'професійні послуги': 'other', 'інше': 'other', 'інші послуги': 'other',
};

/** Будь-яке значення категорії -> код. Невідоме - «other». */
export function normalizeCategory(value: string | null | undefined): string {
  const key = String(value ?? '').trim().toLowerCase();
  if (BY_SLUG.has(key)) return key;
  return ALIASES[key] ?? 'other';
}

export function categoryTitle(value: string | null | undefined): string {
  return BY_SLUG.get(normalizeCategory(value))?.title ?? 'Інше';
}

export function categoryPlace(value: string | null | undefined): string {
  return BY_SLUG.get(normalizeCategory(value))?.place ?? 'Заклади';
}

/**
 * Чи належить заклад до категорії.
 *
 * За КОДОМ категорії, а не пошуком слів в описі: раніше барбершоп, що
 * пише в описі «догляд за бородою», потрапляв у «Догляд за шкірою».
 *
 * «Майстри з виїздом» - особливі: це не вид послуги, а формат. Сюди
 * потрапляє будь-який заклад, що працює з виїздом до клієнта
 * (workspace_type = client_place), - манікюр, масаж, макіяж.
 */
export function matchesCategory(biz: any, slug: string): boolean {
  if (slug === 'all') return true;
  if (slug === 'home' && biz?.workspace_type === 'client_place') return true;
  return normalizeCategory(biz?.category) === slug;
}

/** Сумісність зі старим кодом: код -> назва. */
export const categoryTitles: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.slug, c.title]));
