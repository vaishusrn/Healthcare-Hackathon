import type { ItemResponse, ListResponse } from "./types";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new ApiError(res.status, `${init?.method ?? "GET"} ${path} -> ${res.status}`);
  return res;
}

export async function getData<T>(path: string): Promise<T> {
  const res = await request(path);
  const body = (await res.json()) as ItemResponse<T>;
  return body.data;
}

export async function postData<T>(path: string, body?: unknown): Promise<T> {
  const res = await request(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
  const parsed = (await res.json()) as ItemResponse<T>;
  return parsed.data;
}

export async function fetchAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = path;
  while (next) {
    const res = await request(next);
    const body = (await res.json()) as ListResponse<T>;
    out.push(...body.data);
    next = body.pagination.has_more ? body.pagination.next : undefined;
  }
  return out;
}

export async function fetchPage<T>(path: string): Promise<{ data: T[]; nextCursor?: string }> {
  const res = await request(path);
  const body = (await res.json()) as ListResponse<T>;
  if (!body.pagination.has_more || !body.pagination.next) {
    return { data: body.data };
  }
  const queryString = body.pagination.next.split("?")[1] ?? "";
  const nextCursor = new URLSearchParams(queryString).get("cursor") ?? undefined;
  return { data: body.data, nextCursor };
}
