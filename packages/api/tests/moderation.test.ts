import { moderateProfile, moderatePost, mock } from '../src'
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
        labelGroups: {
          porn: 'hide',
        },
        mods: [],
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
        labelGroups: {
          porn: 'ignore',
        },
        mods: [],
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
        labelGroups: {
          porn: 'hide',
        },
        mods: [],
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
        labelGroups: {
          porn: 'ignore',
        },
        mods: [],
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

  it('Ignores labels disabled moderators or disabled label groups for a moderator', () => {
    // porn (moderator disabled)
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
        labelGroups: {
          porn: 'hide',
        },
        mods: [
          {
            did: 'did:web:labeler.test',
            enabled: false,
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

    // porn (label group disabled)
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
        labelGroups: {
          porn: 'ignore',
        },
        mods: [
          {
            did: 'did:web:labeler.test',
            enabled: true,
            disabledLabelGroups: ['porn'],
          },
        ],
      },
    )
    expect(res2.avatar).toBeModerationResult(
      {},
      'post avatar',
      JSON.stringify(res2, null, 2),
      true,
    )
  })

  it('Ignores labels from unknown mods', () => {
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
        labelGroups: {
          porn: 'hide',
        },
        mods: [],
      },
    )
    expect(res1.avatar).toBeModerationResult(
      {},
      'post avatar',
      JSON.stringify(res1, null, 2),
      true,
    )
  })

  it('Ignores labels applied to the wrong targets', () => {
    const res1 = moderateProfile(
      mock.profileViewBasic({
        handle: 'bob.test',
        displayName: 'Bob',
        labels: [
          {
            src: 'did:web:labeler.test',
            uri: 'at://did:web:bob.test/app.bsky.actor.profile/self',
            val: 'rude',
            cts: new Date().toISOString(),
          },
        ],
      }),
      {
        userDid: 'did:web:alice.test',
        adultContentEnabled: true,
        labelGroups: {
          rude: 'hide',
        },
        mods: [
          {
            did: 'did:web:labeler.test',
            enabled: true,
          },
        ],
      },
    )
    expect(res1.account).toBeModerationResult(
      {},
      '',
      JSON.stringify(res1, null, 2),
      true,
    )
    expect(res1.profile).toBeModerationResult(
      {},
      '',
      JSON.stringify(res1, null, 2),
      true,
    )
    expect(res1.avatar).toBeModerationResult(
      {},
      '',
      JSON.stringify(res1, null, 2),
      true,
    )

    const res2 = moderateProfile(
      mock.profileViewBasic({
        handle: 'bob.test',
        displayName: 'Bob',
        labels: [
          {
            src: 'did:web:labeler.test',
            uri: 'at://did:web:bob.test/',
            val: 'disgusting',
            cts: new Date().toISOString(),
          },
        ],
      }),
      {
        userDid: 'did:web:alice.test',
        adultContentEnabled: true,
        labelGroups: {
          disgusting: 'hide',
        },
        mods: [
          {
            did: 'did:web:labeler.test',
            enabled: true,
          },
        ],
      },
    )
    expect(res2.account).toBeModerationResult(
      {},
      '',
      JSON.stringify(res2, null, 2),
      true,
    )
    expect(res2.profile).toBeModerationResult(
      {},
      '',
      JSON.stringify(res2, null, 2),
      true,
    )
    expect(res2.avatar).toBeModerationResult(
      {},
      '',
      JSON.stringify(res2, null, 2),
      true,
    )

    const res3 = moderatePost(
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
            src: 'did:web:labeler.test',
            uri: 'at://did:web:bob.test/app.bsky.post/fake',
            val: 'bot',
            cts: new Date().toISOString(),
          },
        ],
      }),
      {
        userDid: 'did:web:alice.test',
        adultContentEnabled: true,
        labelGroups: {
          bot: 'hide',
        },
        mods: [
          {
            did: 'did:web:labeler.test',
            enabled: true,
          },
        ],
      },
    )
    expect(res3.content).toBeModerationResult(
      {},
      '',
      JSON.stringify(res3, null, 2),
      true,
    )
    expect(res3.embed).toBeModerationResult(
      {},
      '',
      JSON.stringify(res3, null, 2),
      true,
    )
    expect(res3.avatar).toBeModerationResult(
      {},
      '',
      JSON.stringify(res3, null, 2),
      true,
    )
  })
})
