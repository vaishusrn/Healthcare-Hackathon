export type PageParams = {
  cursor?: string;
  pageSize: number;
};

export type Pagination = {
  self: string;
  next?: string;
  prev?: string;
  has_more: boolean;
};

const defaultPageSize = 20;
const maxPageSize = 100;
const defaultPageFields = ["cursor", "page_size"] as const;

export function parsePageParams(
  url: URL,
  allowedFields: readonly string[] = defaultPageFields,
): PageParams {
  validateQueryParams(url, allowedFields);

  const rawPageSize = url.searchParams.get("page_size");
  const pageSize = rawPageSize ? Number(rawPageSize) : defaultPageSize;

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > maxPageSize) {
    throw new Error("page_size must be an integer between 1 and 100");
  }

  return {
    cursor: url.searchParams.get("cursor") ?? undefined,
    pageSize,
  };
}

export function validateQueryParams(
  url: URL,
  allowedFields: readonly string[] = [],
) {
  const allowed = new Set(allowedFields);
  const unknown = Array.from(url.searchParams.keys()).filter(
    (field) => !allowed.has(field),
  );

  if (unknown.length > 0) {
    throw new Error(`${unknown.join(", ")} must not be provided`);
  }
}

export function encodeCursor(publicId: string) {
  return Buffer.from(JSON.stringify({ public_id: publicId }), "utf8").toString(
    "base64url",
  );
}

export function decodeCursor(cursor?: string) {
  if (!cursor) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as { public_id?: unknown };

    if (
      typeof parsed.public_id !== "string" ||
      parsed.public_id.trim().length === 0
    ) {
      throw new Error("Invalid cursor");
    }

    return parsed.public_id;
  } catch {
    throw new Error("cursor is invalid");
  }
}

export function paginationFor(
  pathname: string,
  params: PageParams,
  nextPublicId?: string,
  extraParams?: Record<string, string>,
): Pagination {
  const search = new URLSearchParams();

  if (params.cursor) {
    search.set("cursor", params.cursor);
  }

  search.set("page_size", String(params.pageSize));

  for (const [key, value] of Object.entries(extraParams ?? {})) {
    search.set(key, value);
  }

  const self = `${pathname}?${search.toString()}`;

  if (!nextPublicId) {
    return {
      self,
      has_more: false,
    };
  }

  const nextSearch = new URLSearchParams(search);
  nextSearch.set("cursor", encodeCursor(nextPublicId));

  return {
    self,
    next: `${pathname}?${nextSearch.toString()}`,
    has_more: true,
  };
}
