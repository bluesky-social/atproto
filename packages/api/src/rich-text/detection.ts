import TLDs from 'tlds'
import { AppBskyRichtextFacet } from '../client'
import { UnicodeString } from './unicode'

export type Facet = AppBskyRichtextFacet.Main

export function detectFacets(text: UnicodeString): Facet[] | undefined {
  let match: RegExpExecArray | null | undefined
  const facets: Facet[] = []
  {
    // mentions
    const re = /(^|\s|\()(@)([a-zA-Z0-9.-]+)(\b)/g
    while ((match = re.exec(text.utf16))) {
      if (!isValidDomain(match[3]) && !match[3].endsWith('.test')) {
        continue // probably not a handle
      }

      const start = text.utf16.indexOf(match[3], match.index) - 1
      facets.push({
        $type: 'app.bsky.richtext.facet',
        index: {
          byteStart: text.utf16IndexToUtf8Index(start),
          byteEnd: text.utf16IndexToUtf8Index(start + match[3].length + 1),
        },
        features: [
          {
            $type: 'app.bsky.richtext.facet#mention',
            did: match[3], // must be resolved afterwards
          },
        ],
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
      if (/[.,;:!?]$/.test(uri)) {
        uri = uri.slice(0, -1)
        index.end--
      }
      if (/[)]$/.test(uri) && !uri.includes('(')) {
        uri = uri.slice(0, -1)
        index.end--
      }
      facets.push({
        index: {
          byteStart: text.utf16IndexToUtf8Index(index.start),
          byteEnd: text.utf16IndexToUtf8Index(index.end),
        },
        features: [
          {
            $type: 'app.bsky.richtext.facet#link',
            uri,
          },
        ],
      })
    }
  }
  {
    const re = /(^|\s)#([^\d\s]\S*)(?=\s)?/g
    while ((match = re.exec(text.utf16))) {
      let [, leading, tag] = match

      const isEmojiTag = tag.charCodeAt(0) === 0xfe0f

      if (isEmojiTag) {
        // If the variation isn't an keycap, this isn't the hashtag emoji
        if (tag.charCodeAt(1) !== 0x20e3) continue

        // Normalize the tag
        tag = tag.slice(2)
      }

      // Strip ending punctuation
      tag = tag.trimEnd().replace(/\p{P}+$/gu, '')

      // Do not include empty tags, or tags that are over 64 characters long
      if (tag.length === 0 || tag.length > 64) continue

      const index = match.index + leading.length

      facets.push({
        index: {
          byteStart: text.utf16IndexToUtf8Index(index),
          byteEnd: text.utf16IndexToUtf8Index(index + 1 + tag.length),
        },
        features: [
          {
            $type: 'app.bsky.richtext.facet#tag',
            tag: tag,
          },
        ],
      })
    }
  }
  return facets.length > 0 ? facets : undefined
}

function isValidDomain(str: string): boolean {
  return !!TLDs.find((tld) => {
    const i = str.lastIndexOf(tld)
    if (i === -1) {
      return false
    }
    return str.charAt(i - 1) === '.' && i === str.length - tld.length
  })
}
