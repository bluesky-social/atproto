import { describe, expect, it } from 'vitest'
import { TID } from '@atproto/common-web'
import {
  getSavedFeedType,
  savedFeedsToUriArrays,
  validateSavedFeed,
} from './util.js'

let i = 0
const feedUri = () => `at://bob.com/app.bsky.feed.generator/${i++}`
const listUri = () => `at://bob.com/app.bsky.graph.list/${i++}`

describe(savedFeedsToUriArrays, () => {
  it(`splits saved and pinned feed uris`, () => {
    const { saved, pinned } = savedFeedsToUriArrays([
      {
        id: '',
        type: 'feed',
        value: 'a',
        pinned: true,
      },
      {
        id: '',
        type: 'feed',
        value: 'b',
        pinned: false,
      },
      {
        id: '',
        type: 'feed',
        value: 'c',
        pinned: true,
      },
    ])
    expect(saved).toStrictEqual(['a', 'b', 'c'])
    expect(pinned).toStrictEqual(['a', 'c'])
  })
})

describe(getSavedFeedType, () => {
  it(`works`, () => {
    expect(getSavedFeedType('at://foo.com')).toBe('unknown')
    expect(getSavedFeedType(feedUri())).toBe('feed')
    expect(getSavedFeedType(listUri())).toBe('list')
    expect(
      getSavedFeedType('at://did:plc:fake/app.bsky.graph.follow/fake'),
    ).toBe('unknown')
  })
})

describe(validateSavedFeed, () => {
  it(`throws if missing id`, () => {
    // really only checks length at time of writing
    expect(() =>
      validateSavedFeed({
        id: '',
        type: 'feed',
        value: feedUri(),
        pinned: false,
      }),
    ).toThrow()
  })

  it(`does not throw if a UUID is used as id`, () => {
    // really only checks length at time of writing
    expect(() =>
      validateSavedFeed({
        id: '497dcba3-ecbf-4587-a2dd-5eb0665e6880',
        type: 'feed',
        value: feedUri(),
        pinned: false,
      }),
    ).not.toThrow()
  })

  it(`throws if mismatched types`, () => {
    expect(() =>
      validateSavedFeed({
        id: TID.nextStr(),
        type: 'list',
        value: feedUri(),
        pinned: false,
      }),
    ).toThrow()
    expect(() =>
      validateSavedFeed({
        id: TID.nextStr(),
        type: 'feed',
        value: listUri(),
        pinned: false,
      }),
    ).toThrow()
  })

  it(`ignores values it can't validate`, () => {
    expect(() =>
      validateSavedFeed({
        id: TID.nextStr(),
        type: 'timeline',
        value: 'following',
        pinned: false,
      }),
    ).not.toThrow()
    expect(() =>
      validateSavedFeed({
        id: TID.nextStr(),
        type: 'unknown',
        value: 'could be @nyt4!ng',
        pinned: false,
      }),
    ).not.toThrow()
  })
})
