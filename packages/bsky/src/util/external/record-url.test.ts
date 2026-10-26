import { describe, expect, it } from 'vitest'
import { atUri } from '@atproto/lex'
import { app, social } from '../../lexicons/index.js'
import { buildExternalRecordUrl } from './record-url.js'

describe(buildExternalRecordUrl, () => {
  it('builds Grain gallery URLs for did:plc and did:web owners', () => {
    expect(
      buildExternalRecordUrl(
        atUri('did:plc:alice', social.grain.gallery.$type, '3kabc'),
      ),
    ).toBe('https://grain.social/profile/did:plc:alice/gallery/3kabc')
    expect(
      buildExternalRecordUrl(
        atUri('did:web:example.com', social.grain.gallery.$type, 'other'),
      ),
    ).toBe('https://grain.social/profile/did:web:example.com/gallery/other')
  })

  it('returns undefined for unsupported collections', () => {
    expect(
      buildExternalRecordUrl(
        atUri('did:plc:alice', app.bsky.feed.post.$type, '3kabc'),
      ),
    ).toBeUndefined()
  })

  it('returns undefined for handle hosts and missing record keys', () => {
    expect(
      buildExternalRecordUrl(
        atUri('alice.test', social.grain.gallery.$type, '3kabc'),
      ),
    ).toBeUndefined()
    expect(
      buildExternalRecordUrl(
        `at://did:plc:alice/${social.grain.gallery.$type}` as ReturnType<
          typeof atUri
        >,
      ),
    ).toBeUndefined()
  })
})
