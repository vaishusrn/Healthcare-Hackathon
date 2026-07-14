import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAll, fetchPage, getData } from "./client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => vi.restoreAllMocks());

describe("getData", () => {
  it("unwraps the data envelope", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ data: { id: "dep_1", name: "Kardiologie" } }),
    );
    const dep = await getData<{ id: string; name: string }>("/v1/departments/dep_1");
    expect(dep).toEqual({ id: "dep_1", name: "Kardiologie" });
  });

  it("throws with status on error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ title: "Not Found" }, 404),
    );
    await expect(getData("/v1/departments/nope")).rejects.toMatchObject({ status: 404 });
  });
});

describe("fetchAll", () => {
  it("follows pagination.next and concatenates data", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: "a" }], pagination: { self: "/v1/beds", next: "/v1/beds?cursor=x", has_more: true } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: "b" }], pagination: { self: "/v1/beds?cursor=x", has_more: false } }),
      );
    const rows = await fetchAll<{ id: string }>("/v1/beds");
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("fetchPage", () => {
  it("fetches a single page and extracts the next cursor", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        data: [{ id: "a" }, { id: "b" }],
        pagination: { self: "/v1/patients?page_size=50", next: "/v1/patients?page_size=50&cursor=xyz", has_more: true },
      }),
    );
    const page = await fetchPage<{ id: string }>("/v1/patients?page_size=50");
    expect(page.data.map((r) => r.id)).toEqual(["a", "b"]);
    expect(page.nextCursor).toBe("xyz");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("omits nextCursor when there is no further page", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ data: [{ id: "a" }], pagination: { self: "/v1/patients?page_size=50", has_more: false } }),
    );
    const page = await fetchPage<{ id: string }>("/v1/patients?page_size=50");
    expect(page.data.map((r) => r.id)).toEqual(["a"]);
    expect(page.nextCursor).toBeUndefined();
  });
});
