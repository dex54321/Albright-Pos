export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const fmtN = (n: number) =>
  r2(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

export const fmt = (n: number) => "KES " + fmtN(n);

export const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return isFinite(n) ? n : 0;
};

export function todayStr(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dayRangeUTC(fromISO: string, toISO: string) {
  return {
    gte: new Date(fromISO + "T00:00:00.000Z"),
    lte: new Date(toISO + "T23:59:59.999Z"),
  };
}

export class AppError extends Error {
  status: number;
  needApproval: boolean;
  constructor(message: string, opts: { status?: number; needApproval?: boolean } = {}) {
    super(message);
    this.status = opts.status ?? 400;
    this.needApproval = !!opts.needApproval;
  }
}

export function pad6(n: number) {
  return String(n).padStart(6, "0");
}
