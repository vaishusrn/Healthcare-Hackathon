import { existsSync, statSync } from "node:fs";
import { join, normalize, resolve, sep } from "node:path";

/** Extension → MIME map covering everything a Vite production build emits. */
const MIME_BY_EXT: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

function mimeFor(path: string): string {
  const dot = path.lastIndexOf(".");
  const ext = dot === -1 ? "" : path.slice(dot).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

/**
 * Locate the built frontend directory (must contain `index.html`). Honors the
 * `FRONTEND_DIR` env override first, then the container layout (`<app>/public`,
 * where the Dockerfile copies the build), then the local build output
 * (`<repo>/frontend/dist`). Returns `null` when no build is present, so the
 * server keeps working API-only.
 */
export function resolveFrontendDir(): string | null {
  const candidates = [
    process.env.FRONTEND_DIR,
    resolve(import.meta.dir, "../public"),
    resolve(import.meta.dir, "../frontend/dist"),
  ].filter((dir): dir is string => Boolean(dir));

  for (const dir of candidates) {
    if (existsSync(join(dir, "index.html"))) return resolve(dir);
  }
  return null;
}

type MutableHeaders = Record<string, string | number | boolean | undefined>;

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * Map a request pathname to a real file inside `frontendDir`, guarding against
 * path traversal. Returns the absolute file path, or `null` when the request
 * does not resolve to an existing file (the caller then serves the SPA shell).
 */
function resolveAsset(frontendDir: string, pathname: string): string | null {
  if (pathname === "/" || pathname === "") return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const relative = normalize(decoded).replace(/^\/+/, "");
  const full = resolve(frontendDir, relative);
  // Defense in depth: the resolved path must stay inside frontendDir.
  if (full !== frontendDir && !full.startsWith(frontendDir + sep)) return null;

  return isFile(full) ? full : null;
}

/**
 * Serve a static asset for `pathname`, falling back to `index.html` so the SPA
 * router can handle history-mode deep links on a hard refresh. Sets the
 * response `Content-Type`/`Cache-Control` on `set` and returns the file body.
 * Hashed `/assets/*` files are immutable; the HTML shell is always revalidated.
 */
export function respondWithStatic(
  frontendDir: string,
  pathname: string,
  set: { headers: MutableHeaders },
): ReturnType<typeof Bun.file> {
  const asset = resolveAsset(frontendDir, pathname);
  if (asset) {
    set.headers["Content-Type"] = mimeFor(asset);
    set.headers["Cache-Control"] = pathname.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate";
    return Bun.file(asset);
  }

  set.headers["Content-Type"] = "text/html; charset=utf-8";
  set.headers["Cache-Control"] = "no-cache";
  return Bun.file(join(frontendDir, "index.html"));
}
