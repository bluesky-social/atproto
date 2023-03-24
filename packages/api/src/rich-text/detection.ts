import TLDs from 'tlds'
import { AtpAgent } from '../agent'
import { AppBskyRichtextFacet } from '../client'
import { UnicodeString } from './unicode'

export type Facet = AppBskyRichtextFacet.Main

export async function detectFacets(
  agent: AtpAgent,
  text: UnicodeString,
): Promise<Facet[] | undefined> {
  let match
  const facets: Facet[] = []
  {
    // mentions
    const re = /(^|\s|\()(@)([a-zA-Z0-9.-]+)(\b)/g
    while ((match = re.exec(text.utf16))) {
      if (!isValidDomain(match[3]) && !match[3].endsWith('.test')) {
        continue // probably not a handle
      }

      const did = await agent
        .resolveHandle({ handle: match[3] })
        .catch((_) => undefined)
        .then((res) => res?.data.did)
      if (!did) {
        continue
      }

      const start = text.utf16.indexOf(match[3], match.index) - 1
      facets.push({
        $type: 'app.bsky.richtext.facet',
        index: {
          start: text.utf16IndexToUtf8Index(start),
          end: text.utf16IndexToUtf8Index(start + match[3].length + 1),
        },
        value: {
          $type: 'app.bsky.richtext.facet#mention',
          did: did,
        },
      })
    }
  }
  {
    // links
    const re =
      /(^|\s|\()((https?:\/\/[\S]+)|((?<domain>[a-z][a-z0-9]*(\.[a-z0-9]+)+)[\S]*))/gim
    while ((match = re.exec(text.utf16))) {
      let uri = match[2]
      if (!uri.startsWith('http')) {
        const domain = match.groups?.domain
        if (!domain || !isValidDomain(domain)) {
          continue
        }
        uri = `https://${uri}`
      }
      const start = text.utf16.indexOf(match[2], match.index)
      const index = { start, end: start + match[2].length }
      // strip ending puncuation
      if (/[.,;!?]$/.test(uri)) {
        uri = uri.slice(0, -1)
        index.end--
      }
      if (/[)]$/.test(uri) && !uri.includes('(')) {
        uri = uri.slice(0, -1)
        index.end--
      }
      facets.push({
        index: {
          start: text.utf16IndexToUtf8Index(index.start),
          end: text.utf16IndexToUtf8Index(index.end),
        },
        value: {
          type: 'app.bsky.richtext.facet#link',
          uri,
        },
      })
    }
  }
  return facets.length > 0 ? facets : undefined
}

function isValidDomain(str: string): boolean {
  return !!TLDs.find((tld) => {
    let i = str.lastIndexOf(tld)
    if (i === -1) {
      return false
    }
    return str.charAt(i - 1) === '.' && i === str.length - tld.length
  })
}
