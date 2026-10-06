import { describe, expect, it } from 'vitest'
import { parseCid } from '@atproto/lex'
import { getBetaProfileLinks } from '../../src/views/profile-links.js'

const CID = 'bafkreibq3lmclwphfiidatqr3jkvwrrxpcj3k27kb2zyx4gd4wngevqmta'
const icon = {
  $type: 'blob',
  ref: parseCid(CID),
  mimeType: 'image/png',
  size: 1024,
}
const iconUri = (cid: string) => `https://cdn.example/${cid}`

describe('getBetaProfileLinks', () => {
  it('returns links, icons and the Germ position', () => {
    expect(
      getBetaProfileLinks(
        {
          displayName: 'Kat',
          betaLinks: [
            { uri: 'https://ko-fi.com/kat', title: 'Tip jar' },
            { uri: 'https://example.com', icon },
          ],
          betaLinksGermIndex: 1,
        },
        iconUri,
      ),
    ).toEqual({
      betaLinks: [
        { uri: 'https://ko-fi.com/kat', title: 'Tip jar' },
        { uri: 'https://example.com', icon: `https://cdn.example/${CID}` },
      ],
      betaLinksGermIndex: 1,
    })
  })

  it('returns nothing for profiles without links', () => {
    expect(getBetaProfileLinks({ displayName: 'Kat' }, iconUri)).toBe(undefined)
    expect(getBetaProfileLinks({ betaLinks: [] }, iconUri)).toBe(undefined)
    expect(getBetaProfileLinks({ betaLinks: 'nope' }, iconUri)).toBe(undefined)
  })

  it('drops malformed links', () => {
    expect(
      getBetaProfileLinks(
        {
          betaLinks: [
            'not an object',
            { uri: 42 },
            { uri: 'javascript:alert(1)' },
            { uri: 'ftp://example.com' },
            { uri: 'example.com' },
            { uri: 'https://ok.example' },
          ],
        },
        iconUri,
      )?.betaLinks,
    ).toEqual([{ uri: 'https://ok.example' }])
  })

  it('caps the number of links at 10', () => {
    const betaLinks = Array.from({ length: 15 }, (_, i) => ({
      uri: `https://example.com/${i}`,
    }))
    expect(getBetaProfileLinks({ betaLinks }, iconUri)?.betaLinks).toHaveLength(
      10,
    )
  })

  it('caps titles at 40 graphemes without splitting emoji', () => {
    const [long, emoji, blank] =
      getBetaProfileLinks(
        {
          betaLinks: [
            { uri: 'https://a.example', title: 'x'.repeat(50) },
            { uri: 'https://b.example', title: 'x'.repeat(39) + '🛍️🛍️' },
            { uri: 'https://c.example', title: '   ' },
          ],
        },
        iconUri,
      )?.betaLinks ?? []
    expect(long.title).toBe('x'.repeat(40))
    expect(emoji.title).toBe('x'.repeat(39) + '🛍️')
    expect(blank.title).toBe(undefined)
  })

  it('ignores icons that are not images', () => {
    expect(
      getBetaProfileLinks(
        {
          betaLinks: [
            {
              uri: 'https://a.example',
              icon: { ...icon, mimeType: 'text/html' },
            },
            { uri: 'https://b.example', icon: 'not a blob' },
          ],
        },
        iconUri,
      )?.betaLinks,
    ).toEqual([{ uri: 'https://a.example' }, { uri: 'https://b.example' }])
  })

  it('ignores an invalid Germ position', () => {
    for (const betaLinksGermIndex of [-1, 1.5, '2', 0]) {
      expect(
        getBetaProfileLinks(
          { betaLinks: [{ uri: 'https://a.example' }], betaLinksGermIndex },
          iconUri,
        )?.betaLinksGermIndex,
      ).toBe(undefined)
    }
  })
})
