import {
  moderateProfile,
  moderatePost,
  mock,
  ModerationOpts,
  InterprettedLabelValueDefinition,
  interpretLabelValueDefinition,
} from '../src'
import './util/moderation-behavior'

interface ScenarioResult {
  profileList?: string[]
  profileView?: string[]
  avatar?: string[]
  banner?: string[]
  displayName?: string[]
  contentList?: string[]
  contentView?: string[]
  contentMedia?: string[]
}

interface Scenario {
  blurs: 'content' | 'media' | 'none'
  severity: 'alert' | 'inform' | 'none'
  account: ScenarioResult
  profile: ScenarioResult
  post: ScenarioResult
}

const TESTS: Scenario[] = [
  {
    blurs: 'content',
    severity: 'alert',
    account: {
      profileList: ['filter', 'alert'],
      profileView: ['alert'],
      contentList: ['filter', 'blur'],
      contentView: ['alert'],
    },
    profile: {
      profileList: ['filter'],
      avatar: ['blur'],
      banner: ['blur'],
      displayName: ['blur'],
      contentList: ['filter'],
    },
    post: {
      profileList: ['filter'],
      contentList: ['filter', 'blur'],
      contentView: ['alert'],
    },
  },
  {
    blurs: 'content',
    severity: 'inform',
    account: {
      profileList: ['filter', 'inform'],
      profileView: ['inform'],
      contentList: ['filter', 'blur'],
      contentView: ['inform'],
    },
    profile: {
      profileList: ['filter'],
      avatar: ['blur'],
      banner: ['blur'],
      displayName: ['blur'],
      contentList: ['filter'],
    },
    post: {
      profileList: ['filter'],
      contentList: ['filter', 'blur'],
      contentView: ['inform'],
    },
  },
  {
    blurs: 'content',
    severity: 'none',
    account: {
      profileList: ['filter'],
      profileView: [],
      contentList: ['filter', 'blur'],
      contentView: [],
    },
    profile: {
      profileList: ['filter'],
      avatar: ['blur'],
      banner: ['blur'],
      displayName: ['blur'],
      contentList: ['filter'],
    },
    post: {
      profileList: ['filter'],
      contentList: ['filter', 'blur'],
      contentView: [],
    },
  },

  {
    blurs: 'media',
    severity: 'alert',
    account: {
      profileList: ['filter', 'alert'],
      profileView: ['alert'],
      avatar: ['blur'],
      banner: ['blur'],
      contentList: ['filter'],
      contentMedia: ['blur'],
    },
    profile: {
      profileList: ['filter'],
      profileView: ['alert'],
      avatar: ['blur'],
      banner: ['blur'],
      contentList: ['filter'],
    },
    post: {
      profileList: ['filter'],
      contentList: ['filter'],
      contentMedia: ['blur'],
    },
  },
  {
    blurs: 'media',
    severity: 'inform',
    account: {
      profileList: ['filter', 'inform'],
      profileView: ['inform'],
      avatar: ['blur'],
      banner: ['blur'],
      contentList: ['filter'],
      contentMedia: ['blur'],
    },
    profile: {
      profileList: ['filter'],
      profileView: ['inform'],
      avatar: ['blur'],
      banner: ['blur'],
      contentList: ['filter'],
    },
    post: {
      profileList: ['filter'],
      contentList: ['filter'],
      contentMedia: ['blur'],
    },
  },
  {
    blurs: 'media',
    severity: 'none',
    account: {
      profileList: ['filter'],
      avatar: ['blur'],
      banner: ['blur'],
      contentList: ['filter'],
      contentMedia: ['blur'],
    },
    profile: {
      profileList: ['filter'],
      avatar: ['blur'],
      banner: ['blur'],
      contentList: ['filter'],
    },
    post: {
      profileList: ['filter'],
      contentList: ['filter'],
      contentMedia: ['blur'],
    },
  },

  {
    blurs: 'none',
    severity: 'alert',
    account: {
      profileList: ['filter', 'alert'],
      profileView: ['alert'],
      contentList: ['filter', 'alert'],
      contentView: ['alert'],
    },
    profile: {
      profileList: ['filter'],
      profileView: ['alert'],
      contentList: ['filter'],
    },
    post: {
      profileList: ['filter'],
      contentList: ['filter', 'alert'],
      contentView: ['alert'],
    },
  },
  {
    blurs: 'none',
    severity: 'inform',
    account: {
      profileList: ['filter', 'inform'],
      profileView: ['inform'],
      contentList: ['filter', 'inform'],
      contentView: ['inform'],
    },
    profile: {
      profileList: ['filter'],
      profileView: ['inform'],
      contentList: ['filter'],
    },
    post: {
      profileList: ['filter'],
      contentList: ['filter', 'inform'],
      contentView: ['inform'],
    },
  },
  {
    blurs: 'none',
    severity: 'none',
    account: {
      profileList: ['filter'],
      contentList: ['filter'],
    },
    profile: {
      profileList: ['filter'],
      contentList: ['filter'],
    },
    post: {
      profileList: ['filter'],
      contentList: ['filter'],
    },
  },
]

describe('Moderation: custom labels', () => {
  const scenarios = TESTS.flatMap((test) => [
    {
      blurs: test.blurs,
      severity: test.severity,
      target: 'post',
      expected: test.post,
    },
    {
      blurs: test.blurs,
      severity: test.severity,
      target: 'profile',
      expected: test.profile,
    },
    {
      blurs: test.blurs,
      severity: test.severity,
      target: 'account',
      expected: test.account,
    },
  ])
  it.each(scenarios)(
    'blurs=$blurs, severity=$severity, target=$target',
    ({ blurs, severity, target, expected }) => {
      let res
      if (target === 'post') {
        res = moderatePost(
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
              mock.label({
                val: 'custom',
                uri: 'at://did:web:bob.test/app.bsky.feed.post/fake',
                src: 'did:web:labeler.test',
              }),
            ],
          }),
          modOpts(blurs, severity),
        )
      } else if (target === 'profile') {
        res = moderateProfile(
          mock.profileViewBasic({
            handle: 'bob.test',
            displayName: 'Bob',
            labels: [
              mock.label({
                val: 'custom',
                uri: 'at://did:web:bob.test/app.bsky.actor.profile/self',
                src: 'did:web:labeler.test',
              }),
            ],
          }),
          modOpts(blurs, severity),
        )
      } else {
        res = moderateProfile(
          mock.profileViewBasic({
            handle: 'bob.test',
            displayName: 'Bob',
            labels: [
              mock.label({
                val: 'custom',
                uri: 'did:web:bob.test',
                src: 'did:web:labeler.test',
              }),
            ],
          }),
          modOpts(blurs, severity),
        )
        expect(res.ui('profileList')).toBeModerationResult(
          expected.profileList || [],
        )
        expect(res.ui('profileView')).toBeModerationResult(
          expected.profileView || [],
        )
        expect(res.ui('avatar')).toBeModerationResult(expected.avatar || [])
        expect(res.ui('banner')).toBeModerationResult(expected.banner || [])
        expect(res.ui('displayName')).toBeModerationResult(
          expected.displayName || [],
        )
        expect(res.ui('contentList')).toBeModerationResult(
          expected.contentList || [],
        )
        expect(res.ui('contentView')).toBeModerationResult(
          expected.contentView || [],
        )
        expect(res.ui('contentMedia')).toBeModerationResult(
          expected.contentMedia || [],
        )
      }
    },
  )
})

function modOpts(blurs: string, severity: string): ModerationOpts {
  return {
    userDid: 'did:web:alice.test',
    prefs: {
      adultContentEnabled: true,
      labels: {},
      mods: [
        {
          did: 'did:web:labeler.test',
          labels: { custom: 'hide' },
        },
      ],
    },
    labelDefs: {
      'did:web:labeler.test': [makeCustomLabel(blurs, severity)],
    },
  }
}

function makeCustomLabel(
  blurs: string,
  severity: string,
): InterprettedLabelValueDefinition {
  return interpretLabelValueDefinition({
    identifier: 'custom',
    blurs,
    severity,
    defaultSetting: 'warn',
    locales: [],
  })
}
