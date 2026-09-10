import type { NormalizedLink, NormalizedPageModel, SelectorConfig } from '../domain/models.js';

export const normalizeWhitespace = (value: string): string => value.replace(/\s+/gu, ' ').trim();

export function normalizeUrl(href: string, base: string): string {
  const url = new URL(href, base);
  url.searchParams.sort();
  return url.toString();
}

export function isInternalLink(href: string, base: string): boolean {
  return new URL(href, base).origin === new URL(base).origin;
}

export function modelFromDom(
  documentUrl: string,
  visibleText: string,
  sections: Array<{ key: string; text: string }>,
  links: Array<Pick<NormalizedLink, 'text' | 'href'>>,
  observations: NormalizedPageModel['observations'],
): NormalizedPageModel {
  const normalizedLinks = links
    .map((link) => ({
      text: normalizeWhitespace(link.text),
      rawHref: link.href,
      resolvedUrl: normalizeUrl(link.href, documentUrl),
      href: normalizeUrl(link.href, documentUrl),
      internal: isInternalLink(link.href, documentUrl),
    }))
    .sort((a, b) => `${a.text}\u0000${a.href}`.localeCompare(`${b.text}\u0000${b.href}`));
  return {
    sections: sections.map((section) => ({ ...section, text: normalizeWhitespace(section.text) })),
    visibleText: normalizeWhitespace(visibleText),
    links: normalizedLinks,
    internalLinks: normalizedLinks.filter((link) => link.internal),
    observations,
  };
}

export type SelectorMap = Record<string, SelectorConfig>;
