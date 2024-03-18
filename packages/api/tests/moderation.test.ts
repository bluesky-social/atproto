import {
  moderateProfile,
  moderatePost,
  mock,
  interpretLabelValueDefinition,
} from '../src'
import './util/moderation-behavior'
import { ModerationOpts } from '../dist'

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
        prefs: {
          adultContentEnabled: true,
          labels: {
            porn: 'hide',
          },
          labelers: [],
          hiddenPosts: [],
          mutedWords: [],
        },
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
        prefs: {
          adultContentEnabled: true,
          labels: {
            porn: 'ignore',
          },
          labelers: [],
          hiddenPosts: [],
          mutedWords: [],
        },
      },
    )
    expect(res2.ui('avatar')).toBeModerationResult(
      [],
      'post avatar',
      JSON.stringify(res1, null, 2),
      true,
    )
  })

  it('Ignores labels from unsubscribed moderators or ignored labels for a moderator', () => {
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
        prefs: {
          adultContentEnabled: true,
          labels: {
            porn: 'hide',
          },
          labelers: [],
          hiddenPosts: [],
          mutedWords: [],
        },
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
    ] as const) {
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
        prefs: {
          adultContentEnabled: true,
          labels: {
            porn: 'ignore',
          },
          labelers: [
            {
              did: 'did:web:labeler.test',
              labels: { porn: 'ignore' },
            },
          ],
          hiddenPosts: [],
          mutedWords: [],
        },
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
    ] as const) {
      expect(res2.ui(k)).toBeModerationResult(
        [],
        k,
        JSON.stringify(res2, null, 2),
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
        prefs: {
          adultContentEnabled: true,
          labels: {},
          labelers: [
            {
              did: 'did:web:labeler.test',
              labels: {},
            },
          ],
          hiddenPosts: [],
          mutedWords: [],
        },
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
            val: 'porn',
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
        prefs: {
          adultContentEnabled: true,
          labels: {
            porn: 'hide',
          },
          labelers: [
            {
              did: 'did:web:labeler.test',
              labels: {},
            },
          ],
          hiddenPosts: [],
          mutedWords: [],
        },
      },
    )
    expect((res1.ui('contentList').filters[0] as any).label.val).toBe('!hide')
    expect((res1.ui('contentList').filters[1] as any).label.val).toBe('porn')
    expect((res1.ui('contentList').blurs[0] as any).label.val).toBe('!hide')
    expect((res1.ui('contentMedia').blurs[0] as any).label.val).toBe('porn')
  })

  it('Prioritizes custom label definitions', () => {
    const modOpts: ModerationOpts = {
      userDid: 'did:web:alice.test',
      prefs: {
        adultContentEnabled: true,
        labels: { porn: 'warn' },
        labelers: [
          {
            did: 'did:web:labeler.test',
            labels: { porn: 'warn' },
          },
        ],
        hiddenPosts: [],
        mutedWords: [],
      },
      labelDefs: {
        'did:web:labeler.test': [
          interpretLabelValueDefinition(
            {
              identifier: 'porn',
              blurs: 'none',
              severity: 'inform',
              locales: [],
              defaultSetting: 'warn',
            },
            'did:web:labeler.test',
          ),
        ],
      },
    }
    const res = moderatePost(
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
            val: 'porn',
            cts: new Date().toISOString(),
          },
        ],
      }),
      modOpts,
    )
    expect(res.ui('profileList')).toBeModerationResult([])
    expect(res.ui('profileView')).toBeModerationResult([])
    expect(res.ui('avatar')).toBeModerationResult([])
    expect(res.ui('banner')).toBeModerationResult([])
    expect(res.ui('displayName')).toBeModerationResult([])
    expect(res.ui('contentList')).toBeModerationResult(['inform'])
    expect(res.ui('contentView')).toBeModerationResult(['inform'])
    expect(res.ui('contentMedia')).toBeModerationResult([])
  })

  it('Doesnt allow custom behaviors to override imperative labels', () => {
    const modOpts: ModerationOpts = {
      userDid: 'did:web:alice.test',
      prefs: {
        adultContentEnabled: true,
        labels: {},
        labelers: [
          {
            did: 'did:web:labeler.test',
            labels: {},
          },
        ],
        hiddenPosts: [],
        mutedWords: [],
      },
      labelDefs: {
        'did:web:labeler.test': [
          interpretLabelValueDefinition(
            {
              identifier: '!hide',
              blurs: 'none',
              severity: 'inform',
              locales: [],
              defaultSetting: 'warn',
            },
            'did:web:labeler.test',
          ),
        ],
      },
    }
    const res = moderatePost(
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
            val: '!hide',
            cts: new Date().toISOString(),
          },
        ],
      }),
      modOpts,
    )

    expect(res.ui('profileList')).toBeModerationResult([])
    expect(res.ui('profileView')).toBeModerationResult([])
    expect(res.ui('avatar')).toBeModerationResult([])
    expect(res.ui('banner')).toBeModerationResult([])
    expect(res.ui('displayName')).toBeModerationResult([])
    expect(res.ui('contentList')).toBeModerationResult([
      'filter',
      'blur',
      'noOverride',
    ])
    expect(res.ui('contentView')).toBeModerationResult(['blur', 'noOverride'])
    expect(res.ui('contentMedia')).toBeModerationResult([])
  })

  it('Ignores invalid label value names', () => {
    const modOpts: ModerationOpts = {
      userDid: 'did:web:alice.test',
      prefs: {
        adultContentEnabled: true,
        labels: {},
        labelers: [
          {
            did: 'did:web:labeler.test',
            labels: { BadLabel: 'hide', 'bad/label': 'hide' },
          },
        ],
        hiddenPosts: [],
        mutedWords: [],
      },
      labelDefs: {
        'did:web:labeler.test': [
          interpretLabelValueDefinition(
            {
              identifier: 'BadLabel',
              blurs: 'content',
              severity: 'inform',
              locales: [],
              defaultSetting: 'warn',
            },
            'did:web:labeler.test',
          ),
          interpretLabelValueDefinition(
            {
              identifier: 'bad/label',
              blurs: 'content',
              severity: 'inform',
              locales: [],
              defaultSetting: 'warn',
            },
            'did:web:labeler.test',
          ),
        ],
      },
    }
    const res = moderatePost(
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
            val: 'BadLabel',
            cts: new Date().toISOString(),
          },
          {
            src: 'did:web:labeler.test',
            uri: 'at://did:web:bob.test/app.bsky.post/fake',
            val: 'bad/label',
            cts: new Date().toISOString(),
          },
        ],
      }),
      modOpts,
    )

    expect(res.ui('profileList')).toBeModerationResult([])
    expect(res.ui('profileView')).toBeModerationResult([])
    expect(res.ui('avatar')).toBeModerationResult([])
    expect(res.ui('banner')).toBeModerationResult([])
    expect(res.ui('displayName')).toBeModerationResult([])
    expect(res.ui('contentList')).toBeModerationResult([])
    expect(res.ui('contentView')).toBeModerationResult([])
    expect(res.ui('contentMedia')).toBeModerationResult([])
  })

  it('Custom labels can set the default setting', () => {
    const modOpts: ModerationOpts = {
      userDid: 'did:web:alice.test',
      prefs: {
        adultContentEnabled: true,
        labels: {},
        labelers: [
          {
            did: 'did:web:labeler.test',
            labels: {},
          },
        ],
        hiddenPosts: [],
        mutedWords: [],
      },
      labelDefs: {
        'did:web:labeler.test': [
          interpretLabelValueDefinition(
            {
              identifier: 'default-hide',
              blurs: 'content',
              severity: 'inform',
              defaultSetting: 'hide',
              locales: [],
            },
            'did:web:labeler.test',
          ),
          interpretLabelValueDefinition(
            {
              identifier: 'default-warn',
              blurs: 'content',
              severity: 'inform',
              defaultSetting: 'warn',
              locales: [],
            },
            'did:web:labeler.test',
          ),
          interpretLabelValueDefinition(
            {
              identifier: 'default-ignore',
              blurs: 'content',
              severity: 'inform',
              defaultSetting: 'ignore',
              locales: [],
            },
            'did:web:labeler.test',
          ),
        ],
      },
    }
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
            val: 'default-hide',
            cts: new Date().toISOString(),
          },
        ],
      }),
      modOpts,
    )

    expect(res1.ui('profileList')).toBeModerationResult([])
    expect(res1.ui('profileView')).toBeModerationResult([])
    expect(res1.ui('avatar')).toBeModerationResult([])
    expect(res1.ui('banner')).toBeModerationResult([])
    expect(res1.ui('displayName')).toBeModerationResult([])
    expect(res1.ui('contentList')).toBeModerationResult(['filter', 'blur'])
    expect(res1.ui('contentView')).toBeModerationResult(['inform'])
    expect(res1.ui('contentMedia')).toBeModerationResult([])

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
            val: 'default-warn',
            cts: new Date().toISOString(),
          },
        ],
      }),
      modOpts,
    )

    expect(res2.ui('profileList')).toBeModerationResult([])
    expect(res2.ui('profileView')).toBeModerationResult([])
    expect(res2.ui('avatar')).toBeModerationResult([])
    expect(res2.ui('banner')).toBeModerationResult([])
    expect(res2.ui('displayName')).toBeModerationResult([])
    expect(res2.ui('contentList')).toBeModerationResult(['blur'])
    expect(res2.ui('contentView')).toBeModerationResult(['inform'])
    expect(res2.ui('contentMedia')).toBeModerationResult([])

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
            val: 'default-ignore',
            cts: new Date().toISOString(),
          },
        ],
      }),
      modOpts,
    )

    expect(res3.ui('profileList')).toBeModerationResult([])
    expect(res3.ui('profileView')).toBeModerationResult([])
    expect(res3.ui('avatar')).toBeModerationResult([])
    expect(res3.ui('banner')).toBeModerationResult([])
    expect(res3.ui('displayName')).toBeModerationResult([])
    expect(res3.ui('contentList')).toBeModerationResult([])
    expect(res3.ui('contentView')).toBeModerationResult([])
    expect(res3.ui('contentMedia')).toBeModerationResult([])
  })

  it('Custom labels can require adult content to be enabled', () => {
    const modOpts: ModerationOpts = {
      userDid: 'did:web:alice.test',
      prefs: {
        adultContentEnabled: false,
        labels: { adult: 'ignore' },
        labelers: [
          {
            did: 'did:web:labeler.test',
            labels: {
              adult: 'ignore',
            },
          },
        ],
        hiddenPosts: [],
        mutedWords: [],
      },
      labelDefs: {
        'did:web:labeler.test': [
          interpretLabelValueDefinition(
            {
              identifier: 'adult',
              blurs: 'content',
              severity: 'inform',
              defaultSetting: 'hide',
              adultOnly: true,
              locales: [],
            },
            'did:web:labeler.test',
          ),
        ],
      },
    }
    const res = moderatePost(
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
            val: 'adult',
            cts: new Date().toISOString(),
          },
        ],
      }),
      modOpts,
    )

    expect(res.ui('profileList')).toBeModerationResult([])
    expect(res.ui('profileView')).toBeModerationResult([])
    expect(res.ui('avatar')).toBeModerationResult([])
    expect(res.ui('banner')).toBeModerationResult([])
    expect(res.ui('displayName')).toBeModerationResult([])
    expect(res.ui('contentList')).toBeModerationResult([
      'filter',
      'blur',
      'noOverride',
    ])
    expect(res.ui('contentView')).toBeModerationResult(['blur', 'noOverride'])
    expect(res.ui('contentMedia')).toBeModerationResult([])
  })

  it('Adult content disabled forces the preference to hide', () => {
    const modOpts: ModerationOpts = {
      userDid: 'did:web:alice.test',
      prefs: {
        adultContentEnabled: false,
        labels: { porn: 'ignore' },
        labelers: [
          {
            did: 'did:web:labeler.test',
            labels: {},
          },
        ],
        hiddenPosts: [],
        mutedWords: [],
      },
      labelDefs: {},
    }
    const res = moderatePost(
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
            val: 'porn',
            cts: new Date().toISOString(),
          },
        ],
      }),
      modOpts,
    )

    expect(res.ui('profileList')).toBeModerationResult([])
    expect(res.ui('profileView')).toBeModerationResult([])
    expect(res.ui('avatar')).toBeModerationResult([])
    expect(res.ui('banner')).toBeModerationResult([])
    expect(res.ui('displayName')).toBeModerationResult([])
    expect(res.ui('contentList')).toBeModerationResult(['filter'])
    expect(res.ui('contentView')).toBeModerationResult([])
    expect(res.ui('contentMedia')).toBeModerationResult(['blur', 'noOverride'])
  })
})
