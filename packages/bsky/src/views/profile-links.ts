import { getBlobCidString, getBlobMime, isBlobRef } from '@atproto/lex'

// Profile links beta. The Bluesky app writes links into unofficial fields on
// the profile record. They aren't in a lexicon yet, so any client can put
// anything there; only well-formed links are returned.
const LINKS_FIELD = 'betaLinks'
const GERM_INDEX_FIELD = 'betaLinksGermIndex'

export const MAX_BETA_LINKS = 10
export const MAX_BETA_LINK_TITLE_GRAPHEMES = 40

const ICON_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

export type BetaProfileLink = {
  uri: string
  title?: string
  /** Image URL for the site's favicon, stored as a blob on the record. */
  icon?: string
}

/**
 * Unspecced, beta-only fields on profileViewDetailed. Removed once links move
 * to their own records.
 */
export type BetaProfileLinksView = {
  betaLinks: BetaProfileLink[]
  /** Where the Germ DM button sits among the links. */
  betaLinksGermIndex?: number
}

export function getBetaProfileLinks(
  record: unknown,
  iconUri: (cid: string) => string,
): BetaProfileLinksView | undefined {
  if (!record || typeof record !== 'object') return
  const fields = record as Record<string, unknown>
  const rawLinks = fields[LINKS_FIELD]
  if (!Array.isArray(rawLinks)) return

  const betaLinks: BetaProfileLink[] = []
  for (const raw of rawLinks) {
    if (betaLinks.length >= MAX_BETA_LINKS) break
    const link = parseLink(raw, iconUri)
    if (link) betaLinks.push(link)
  }
  if (betaLinks.length === 0) return

  const germIndex = fields[GERM_INDEX_FIELD]
  return {
    betaLinks,
    betaLinksGermIndex:
      typeof germIndex === 'number' &&
      Number.isInteger(germIndex) &&
      germIndex > 0
        ? germIndex
        : undefined,
  }
}

function parseLink(
  raw: unknown,
  iconUri: (cid: string) => string,
): BetaProfileLink | undefined {
  if (!raw || typeof raw !== 'object') return
  const { uri, title, icon } = raw as Record<string, unknown>
  if (typeof uri !== 'string' || !isWebUrl(uri)) return

  const link: BetaProfileLink = { uri }
  if (typeof title === 'string') {
    const trimmed = truncateGraphemes(
      title.trim(),
      MAX_BETA_LINK_TITLE_GRAPHEMES,
    )
    if (trimmed) link.title = trimmed
  }
  if (
    isBlobRef(icon, { strict: false }) &&
    ICON_MIME_TYPES.has(getBlobMime(icon))
  ) {
    link.icon = iconUri(getBlobCidString(icon))
  }
  return link
}

function isWebUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

const segmenter = new Intl.Segmenter()

function truncateGraphemes(value: string, max: number): string {
  let out = ''
  let count = 0
  for (const { segment } of segmenter.segment(value)) {
    if (count === max) break
    out += segment
    count++
  }
  return out.trim()
}
