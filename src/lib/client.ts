export class ApiError extends Error {
  needApproval?: boolean;
}

export async function api<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
  });
  const json = await res.json().catch(() => ({ ok: false, error: "Server returned an invalid response" }));
  if (!json.ok) {
    const e = new ApiError(json.error || "Something went wrong");
    e.needApproval = json.needApproval;
    throw e;
  }
  return json.data as T;
}

export const fmtN = (n: number) =>
  (Math.round(((n || 0) + Number.EPSILON) * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
export const fmt = (n: number) => "KES " + fmtN(n || 0);
