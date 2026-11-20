import type { TypedLexMap } from '@atproto/lex-data'
import { place, site, social } from '../../lexicons/index.js'

/** Detect a provider domain for cosmetic attribution, not verified provenance. */
export function getRecordProviderId(record: TypedLexMap): string | undefined {
  switch (record.$type) {
    case social.grain.gallery.$type:
      return 'grain.social'
    case place.stream.livestream.$type:
      return 'stream.place'
    case site.standard.document.$type:
    case site.standard.publication.$type: {
      const value =
        record.$type === site.standard.document.$type ? record.site : record.url
      if (typeof value !== 'string') return
      const url = URL.parse(value)
      if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:'))
        return
      return ['pckt.blog', 'leaflet.pub', 'offprint.app'].find(
        (domain) =>
          url.hostname === domain || url.hostname.endsWith(`.${domain}`),
      )
    }
    default:
      return
  }
}
