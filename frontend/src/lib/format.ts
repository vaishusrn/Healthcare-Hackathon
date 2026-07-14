export const formatCurrency = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
export const formatPct = (n: number) => `${n}%`;
export const fullName = (first: string, last: string) => `${first} ${last}`;
export const formatDateTime = (date: string, time?: string | null) =>
  time ? `${date} ${time}` : date;
