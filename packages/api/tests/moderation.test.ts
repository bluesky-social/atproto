import {
  moderateProfile,
  moderatePost,
  mock,
  interpretLabelValueDefinition,
} from '../src'
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
        prefs: {
          adultContentEnabled: true,
          labels: {
            porn: 'hide',
          },
          mods: [],
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
          mods: [],
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
          mods: [],
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
        prefs: {
          adultContentEnabled: true,
          labels: {
            porn: 'ignore',
          },
          mods: [
            {
              did: 'did:web:labeler.test',
              labels: { porn: 'ignore' },
            },
          ],
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
    ]) {
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
          mods: [
            {
              did: 'did:web:labeler.test',
              labels: {},
            },
          ],
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
          mods: [
            {
              did: 'did:web:labeler.test',
              labels: {},
            },
          ],
        },
      },
    )
    expect(res1.ui('contentList').filters[0].label.val).toBe('!hide')
    expect(res1.ui('contentList').filters[1].label.val).toBe('porn')
    expect(res1.ui('contentList').blurs[0].label.val).toBe('!hide')
    expect(res1.ui('contentMedia').blurs[0].label.val).toBe('porn')
  })

  it('Prioritizes custom label definitions', () => {
    const modOpts = {
      userDid: 'did:web:alice.test',
      prefs: {
        adultContentEnabled: true,
        labels: { porn: 'warn' },
        mods: [
          {
            did: 'did:web:labeler.test',
            labels: { porn: 'warn' },
          },
        ],
      },
      labelDefs: {
        'did:web:labeler.test': [
          interpretLabelValueDefinition({
            identifier: 'porn',
            blurs: 'none',
            severity: 'inform',
            defaultSetting: 'warn',
            locales: [],
          }),
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
    const modOpts = {
      userDid: 'did:web:alice.test',
      prefs: {
        adultContentEnabled: true,
        labels: {},
        mods: [
          {
            did: 'did:web:labeler.test',
            labels: {},
          },
        ],
      },
      labelDefs: {
        'did:web:labeler.test': [
          interpretLabelValueDefinition({
            identifier: '!hide',
            blurs: 'none',
            severity: 'inform',
            defaultSetting: 'warn',
            locales: [],
          }),
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

    expect(res.ui('profileList')).toBeModerationResult(['filter'])
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
    const modOpts = {
      userDid: 'did:web:alice.test',
      prefs: {
        adultContentEnabled: true,
        labels: {},
        mods: [
          {
            did: 'did:web:labeler.test',
            labels: { BadLabel: 'hide', 'bad/label': 'hide' },
          },
        ],
      },
      labelDefs: {
        'did:web:labeler.test': [
          interpretLabelValueDefinition({
            identifier: 'BadLabel',
            blurs: 'content',
            severity: 'inform',
            defaultSetting: 'warn',
            locales: [],
          }),
          interpretLabelValueDefinition({
            identifier: 'bad/label',
            blurs: 'content',
            severity: 'inform',
            defaultSetting: 'warn',
            locales: [],
          }),
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
})
