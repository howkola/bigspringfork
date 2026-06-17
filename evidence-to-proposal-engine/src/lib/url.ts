/* Slug lives in the path as /p/<slug> (the SPA fallback serves index.html for
   any path, so this works without a router). */

const SLUG_RE = /^[a-z0-9]{6,32}$/;

export function getSlugFromUrl(): string | null {
  const m = window.location.pathname.match(/^\/p\/([a-z0-9]+)\/?$/);
  return m && SLUG_RE.test(m[1]) ? m[1] : null;
}

export function setSlugUrl(slug: string): void {
  const next = `/p/${slug}`;
  if (window.location.pathname !== next) {
    window.history.pushState({ slug }, "", next);
  }
}

export function shareUrl(slug: string): string {
  return `${window.location.origin}/p/${slug}`;
}
