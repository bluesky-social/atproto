import { describe, expect, it } from 'vitest'
import { profileLinkUris } from '../../src/hydration/hydrator.js'
import { HydrationMap } from '../../src/hydration/util.js'
import { isAllowedProfileLinkUrl } from '../../src/views/profile-link-rules.js'

describe('isAllowedProfileLinkUrl', () => {
  it('allows https links', () => {
    expect(isAllowedProfileLinkUrl('https://ko-fi.com/kat')).toBe(true)
  })

  it('rejects other schemes and invalid URLs', () => {
    expect(isAllowedProfileLinkUrl('http://example.com')).toBe(false)
    expect(isAllowedProfileLinkUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedProfileLinkUrl('ftp://example.com')).toBe(false)
    expect(isAllowedProfileLinkUrl('example.com')).toBe(false)
  })

  it('rejects general-purpose shorteners and their subdomains', () => {
    expect(isAllowedProfileLinkUrl('https://bit.ly/abc')).toBe(false)
    expect(isAllowedProfileLinkUrl('https://www.tinyurl.com/abc')).toBe(false)
  })

  it('allows brand short links and lookalikes', () => {
    expect(isAllowedProfileLinkUrl('https://youtu.be/abc')).toBe(true)
    expect(isAllowedProfileLinkUrl('https://notbit.ly/abc')).toBe(true)
  })
})

describe('profileLinkUris', () => {
  const alice = 'did:plc:alice'
  const bob = 'did:plc:bob'
  const cid = 'bafyreie5737gdxlw5i64vzichcalba3z2v5n6icifvx5xytvske7mr3hpm'
  const linkUri = (did: string, rkey: string) =>
    `at://${did}/app.bsky.actor.link/${rkey}` as const

  const actorsWith = (links: { uri: string; cid: string }[]) =>
    new HydrationMap([
      [alice, { profile: { links } }],
    ]) as unknown as Parameters<typeof profileLinkUris>[1]

  it('keeps the profile order and skips refs outside the owner repo', () => {
    const actors = actorsWith([
      { uri: linkUri(alice, 'b'), cid },
      { uri: linkUri(bob, 'a'), cid },
      { uri: `at://${alice}/app.bsky.feed.post/a`, cid },
      { uri: linkUri(alice, 'a'), cid },
    ])
    expect(profileLinkUris([alice], actors)).toEqual([
      linkUri(alice, 'b'),
      linkUri(alice, 'a'),
    ])
  })

  it('only looks at the first 10 refs', () => {
    const actors = actorsWith(
      Array.from({ length: 12 }, (_, i) => ({
        uri: linkUri(alice, `r${i}`),
        cid,
      })),
    )
    expect(profileLinkUris([alice], actors)).toHaveLength(10)
  })

  it('handles profiles without links', () => {
    expect(profileLinkUris([alice, bob], new HydrationMap())).toEqual([])
  })
})
