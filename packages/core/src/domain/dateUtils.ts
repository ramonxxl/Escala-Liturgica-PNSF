/** Dia da semana (0=domingo .. 6=sabado) de uma data ISO "YYYY-MM-DD", em horario local (evita bug de fuso). */
export function getWeekday(dateIso: string): number {
  const [year, month, day] = dateIso.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

/** Diferenca em dias entre duas datas ISO "YYYY-MM-DD" (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / msPerDay);
}
