/**
 * Відмінювання за числом: plural(21, 'візит', 'візити', 'візитів') -> «візит».
 * Українські правила: 1, 21, 31 - однина; 2-4, 22-24 - «few»; 5-20, 25-30 і 11-14 - «many».
 * Просте «n >= 5» помиляється на 11-14 та 21+.
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.trunc(n));
  const m10 = abs % 10;
  const m100 = abs % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
