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
    expect(res1.ui('avatar')).toBeModerationResult(
      ['blur'],
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
    expect(res2.ui('avatar')).toBeModerationResult(
      [],
      'post avatar',
      JSON.stringify(res1, null, 2),
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
    for (const k of [
      'profileList',
      'profileView',
      'avatar',
      'banner',
      'displayName',
      'contentList',
      'contentView',
      'contentMedia',
    ]) {
      expect(res1.ui(k)).toBeModerationResult(
        [],
        k,
        JSON.stringify(res1, null, 2),
      )
    }

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
    for (const k of [
      'profileList',
      'profileView',
      'avatar',
      'banner',
      'displayName',
      'contentList',
      'contentView',
      'contentMedia',
    ]) {
      expect(res2.ui(k)).toBeModerationResult(
        [],
        k,
        JSON.stringify(res2, null, 2),
      )
    }
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
    for (const k of [
      'profileList',
      'profileView',
      'avatar',
      'banner',
      'displayName',
      'contentList',
      'contentView',
      'contentMedia',
    ]) {
      expect(res1.ui(k)).toBeModerationResult(
        [],
        k,
        JSON.stringify(res1, null, 2),
      )
    }
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
    for (const k of [
      'profileList',
      'profileView',
      'avatar',
      'banner',
      'displayName',
      'contentList',
      'contentView',
      'contentMedia',
    ]) {
      expect(res1.ui(k)).toBeModerationResult(
        [],
        k,
        JSON.stringify(res1, null, 2),
      )
    }
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
    for (const k of [
      'profileList',
      'profileView',
      'avatar',
      'banner',
      'displayName',
      'contentList',
      'contentView',
      'contentMedia',
    ]) {
      expect(res2.ui(k)).toBeModerationResult(
        [],
        k,
        JSON.stringify(res2, null, 2),
      )
    }

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
    for (const k of [
      'profileList',
      'profileView',
      'avatar',
      'banner',
      'displayName',
      'contentList',
      'contentView',
      'contentMedia',
    ]) {
      expect(res3.ui(k)).toBeModerationResult(
        [],
        k,
        JSON.stringify(res3, null, 2),
      )
    }
  })

  it('Can manually apply hiding', () => {
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
        labels: [],
      }),
      {
        userDid: 'did:web:alice.test',
        adultContentEnabled: true,
        labelGroups: {},
        mods: [
          {
            did: 'did:web:labeler.test',
            enabled: true,
          },
        ],
      },
    )
    res1.addHidden(true)
    expect(res1.ui('contentList')).toBeModerationResult(
      ['filter', 'blur'],
      'contentList',
    )
    expect(res1.ui('contentView')).toBeModerationResult(['blur'], 'contentView')
  })

  it('Prioritizes filters and blurs correctly on merge', () => {
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
            src: 'did:web:labeler.test',
            uri: 'at://did:web:bob.test/app.bsky.post/fake',
            val: 'intolerant',
            cts: new Date().toISOString(),
          },
          {
            src: 'did:web:labeler.test',
            uri: 'at://did:web:bob.test/app.bsky.post/fake',
            val: '!hide',
            cts: new Date().toISOString(),
          },
        ],
      }),
      {
        userDid: 'did:web:alice.test',
        adultContentEnabled: true,
        labelGroups: {
          intolerance: 'hide',
        },
        mods: [
          {
            did: 'did:web:labeler.test',
            enabled: true,
          },
        ],
      },
    )
    expect(res1.ui('contentList').filters[0].label.val).toBe('!hide')
    expect(res1.ui('contentList').filters[1].label.val).toBe('intolerant')
    expect(res1.ui('contentList').blurs[0].label.val).toBe('!hide')
    expect(res1.ui('contentList').blurs[1].label.val).toBe('intolerant')

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
            src: 'did:web:labeler.test',
            uri: 'at://did:web:bob.test/app.bsky.post/fake',
            val: 'disgusting',
            cts: new Date().toISOString(),
          },
          {
            src: 'did:web:labeler.test',
            uri: 'at://did:web:bob.test/app.bsky.post/fake',
            val: 'porn',
            cts: new Date().toISOString(),
          },
        ],
      }),
      {
        userDid: 'did:web:alice.test',
        adultContentEnabled: false,
        labelGroups: {
          upsetting: 'hide',
        },
        mods: [
          {
            did: 'did:web:labeler.test',
            enabled: true,
          },
        ],
      },
    )

    expect(res2.ui('contentList').filters[0].label.val).toBe('porn')
    expect(res2.ui('contentList').filters[1].label.val).toBe('disgusting')
    expect(res2.ui('contentMedia').blurs[0].label.val).toBe('porn')
    expect(res2.ui('contentMedia').blurs[1].label.val).toBe('disgusting')
  })
})
