"use client";

export class ClientApiError extends Error {
  constructor(message: string, public status: number, public issues?: { path: string; message: string }[], public code?: string) {
    super(message);
  }
}

/** JSON fetch with friendly errors. Never surfaces stack traces. */
export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown; signal?: AbortSignal; keepalive?: boolean } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
      keepalive: opts.keepalive,
      credentials: "same-origin",
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ClientApiError("Network error — check your connection and try again.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ClientApiError(data.error ?? "Something went wrong.", res.status, data.issues, data.code);
  return data as T;
}
