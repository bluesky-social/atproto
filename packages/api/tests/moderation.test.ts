import { moderateProfile, moderatePost } from '../src'
import { mock } from './util'
import './util/moderation-behavior'

describe('Moderation', () => {
  it('Applies self-labels on profiles according to the global preferences', () => {
    // porn (hide)
    const res1 = moderateProfile(
      mock.profileViewBasic({
        handle: 'bob.test',
        displayName: 'Bob',
        labels: [
          {
            src: 'did:web:bob.test',
            uri: 'at://did:web:bob.test/app.bsky.actor.profile/self',
            val: 'porn',
            cts: new Date().toISOString(),
          },
        ],
      }),
      {
        userDid: 'did:web:alice.test',
        adultContentEnabled: true,
        labels: {
          porn: 'hide',
        },
        labelers: [],
      },
    )
    expect(res1.account).toBeModerationResult(
      {},
      'post content',
      JSON.stringify(res1, null, 2),
    )
    expect(res1.profile).toBeModerationResult(
      {},
      'post content',
      JSON.stringify(res1, null, 2),
    )
    expect(res1.avatar).toBeModerationResult(
      { blur: true },
      'post avatar',
      JSON.stringify(res1, null, 2),
      true,
    )

    // porn (ignore)
    const res2 = moderateProfile(
      mock.profileViewBasic({
        handle: 'bob.test',
        displayName: 'Bob',
        labels: [
          {
            src: 'did:web:bob.test',
            uri: 'at://did:web:bob.test/app.bsky.actor.profile/self',
            val: 'porn',
            cts: new Date().toISOString(),
          },
        ],
      }),
      {
        userDid: 'did:web:alice.test',
        adultContentEnabled: true,
        labels: {
          porn: 'ignore',
        },
        labelers: [],
      },
    )
    expect(res2.account).toBeModerationResult(
      {},
      'post content',
      JSON.stringify(res2, null, 2),
    )
    expect(res2.profile).toBeModerationResult(
      {},
      'post content',
      JSON.stringify(res2, null, 2),
    )
    expect(res2.avatar).toBeModerationResult(
      {},
      'post avatar',
      JSON.stringify(res2, null, 2),
      true,
    )
  })

  it('Applies self-labels on posts according to the global preferences', () => {
    // porn (hide)
    const res1 = moderatePost(
      mock.postView({
        record: {
          text: 'Hello',
          createdAt: new Date().toISOString(),
        },
        author: mock.profileViewBasic({
          handle: 'bob.test',
          displayName: 'Bob',
        }),
        labels: [
          {
            src: 'did:web:bob.test',
            uri: 'at://did:web:bob.test/app.bsky.actor.profile/self',
            val: 'porn',
            cts: new Date().toISOString(),
          },
        ],
      }),
      {
        userDid: 'did:web:alice.test',
        adultContentEnabled: true,
        labels: {
          porn: 'hide',
        },
        labelers: [],
      },
    )
    expect(res1.content).toBeModerationResult(
      { cause: 'label:porn', filter: true },
      'post content',
      JSON.stringify(res1, null, 2),
    )
    expect(res1.embed).toBeModerationResult(
      { cause: 'label:porn', blur: true },
      'post content',
      JSON.stringify(res1, null, 2),
    )
    expect(res1.avatar).toBeModerationResult(
      {},
      'post avatar',
      JSON.stringify(res1, null, 2),
      true,
    )

    // porn (ignore)
    const res2 = moderatePost(
      mock.postView({
        record: {
          text: 'Hello',
          createdAt: new Date().toISOString(),
        },
        author: mock.profileViewBasic({
          handle: 'bob.test',
          displayName: 'Bob',
        }),
        labels: [
          {
            src: 'did:web:bob.test',
            uri: 'at://did:web:bob.test/app.bsky.actor.profile/self',
            val: 'porn',
            cts: new Date().toISOString(),
          },
        ],
      }),
      {
        userDid: 'did:web:alice.test',
        adultContentEnabled: true,
        labels: {
          porn: 'ignore',
        },
        labelers: [],
      },
    )
    expect(res2.content).toBeModerationResult(
      {},
      'post content',
      JSON.stringify(res2, null, 2),
    )
    expect(res2.embed).toBeModerationResult(
      {},
      'post content',
      JSON.stringify(res2, null, 2),
    )
    expect(res2.avatar).toBeModerationResult(
      {},
      'post avatar',
      JSON.stringify(res2, null, 2),
      true,
    )
  })

  it('Applies labeler labels according to the per-labeler then global preferences', () => {
    // porn (ignore for labeler, hide for global)
    const res1 = moderateProfile(
      mock.profileViewBasic({
        handle: 'bob.test',
        displayName: 'Bob',
        labels: [
          {
            src: 'did:web:labeler.test',
            uri: 'at://did:web:bob.test/app.bsky.actor.profile/self',
            val: 'porn',
            cts: new Date().toISOString(),
          },
        ],
      }),
      {
        userDid: 'did:web:alice.test',
        adultContentEnabled: true,
        labels: {
          porn: 'hide',
        },
        labelers: [
          {
            labeler: {
              did: 'did:web:labeler.test',
              displayName: 'Labeler',
            },
            labels: {
              porn: 'ignore',
            },
          },
        ],
      },
    )
    expect(res1.avatar).toBeModerationResult(
      {},
      'post avatar',
      JSON.stringify(res1, null, 2),
      true,
    )

    // porn (hide for labeler, ignore for global)
    const res2 = moderateProfile(
      mock.profileViewBasic({
        handle: 'bob.test',
        displayName: 'Bob',
        labels: [
          {
            src: 'did:web:labeler.test',
            uri: 'at://did:web:bob.test/app.bsky.actor.profile/self',
            val: 'porn',
            cts: new Date().toISOString(),
          },
        ],
      }),
      {
        userDid: 'did:web:alice.test',
        adultContentEnabled: true,
        labels: {
          porn: 'ignore',
        },
        labelers: [
          {
            labeler: {
              did: 'did:web:labeler.test',
              displayName: 'Labeler',
            },
            labels: {
              porn: 'hide',
            },
          },
        ],
      },
    )
    expect(res2.avatar).toBeModerationResult(
      { blur: true },
      'post avatar',
      JSON.stringify(res2, null, 2),
      true,
    )

    // porn (unspecified for labeler, hide for global)
    const res3 = moderateProfile(
      mock.profileViewBasic({
        handle: 'bob.test',
        displayName: 'Bob',
        labels: [
          {
            src: 'did:web:labeler.test',
            uri: 'at://did:web:bob.test/app.bsky.actor.profile/self',
            val: 'porn',
            cts: new Date().toISOString(),
          },
        ],
      }),
      {
        userDid: 'did:web:alice.test',
        adultContentEnabled: true,
        labels: {
          porn: 'hide',
        },
        labelers: [
          {
            labeler: {
              did: 'did:web:labeler.test',
              displayName: 'Labeler',
            },
            labels: {},
          },
        ],
      },
    )
    expect(res3.avatar).toBeModerationResult(
      { blur: true },
      'post avatar',
      JSON.stringify(res3, null, 2),
      true,
    )
  })

  /*
  TODO enable when 3P labeler support is addded
  it('Ignores labels from unknown labelers', () => {
    const res1 = moderateProfile(
      mock.profileViewBasic({
        handle: 'bob.test',
        displayName: 'Bob',
        labels: [
          {
            src: 'did:web:rando.test',
            uri: 'at://did:web:bob.test/app.bsky.actor.profile/self',
            val: 'porn',
            cts: new Date().toISOString(),
          },
        ],
      }),
      {
        userDid: 'did:web:alice.test',
        adultContentEnabled: true,
        labels: {
          porn: 'hide',
        },
        labelers: [],
      },
    )
    expect(res1.avatar).toBeModerationResult(
      {},
      'post avatar',
      JSON.stringify(res1, null, 2),
      true,
    )
  })*/
})
