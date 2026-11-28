import type {
  ComAtprotoLabelDefs,
  LabelPreference,
  ModerationOpts,
} from '../index.js'
import { mock as m } from '../mocker.js'

export type ModerationTestSuiteResultFlag =
  'filter' | 'blur' | 'alert' | 'inform' | 'noOverride'

export interface ModerationTestSuiteScenario {
  cfg: string
  subject: 'post' | 'profile' | 'userlist' | 'feedgen'
  author: string
  quoteAuthor?: string
  labels: {
    post?: string[]
    profile?: string[]
    account?: string[]
    quotedPost?: string[]
    quotedAccount?: string[]
  }
  behaviors: {
    profileList?: ModerationTestSuiteResultFlag[]
    profileView?: ModerationTestSuiteResultFlag[]
    avatar?: ModerationTestSuiteResultFlag[]
    banner?: ModerationTestSuiteResultFlag[]
    displayName?: ModerationTestSuiteResultFlag[]
    contentList?: ModerationTestSuiteResultFlag[]
    contentView?: ModerationTestSuiteResultFlag[]
    contentMedia?: ModerationTestSuiteResultFlag[]
  }
}

export type SuiteUsers = Record<
  string,
  {
    blocking: boolean
    blockingByList: boolean
    blockedBy: boolean
    muted: boolean
    mutedByList: boolean
  }
>

export type SuiteConfigurations = Record<
  string,
  {
    authed?: boolean
    adultContentEnabled?: boolean
    settings?: Record<string, LabelPreference>
  }
>

export type SuiteScenarios = Record<string, ModerationTestSuiteScenario>

export class ModerationBehaviorSuiteRunner {
  constructor(
    public users: SuiteUsers,
    public configurations: SuiteConfigurations,
    public scenarios: SuiteScenarios,
  ) {}

  postScenario(scenario: ModerationTestSuiteScenario) {
    if (scenario.subject !== 'post') {
      throw new Error('Scenario subject must be "post"')
    }
    const author = this.profileViewBasic(scenario.author, scenario.labels)
    return m.postView({
      record: m.post({
        text: 'Post text',
      }),
      author,
      labels: (scenario.labels.post || []).map((val) =>
        m.label({ val, uri: `at://${author.did}/app.bsky.feed.post/fake` }),
      ),
      embed: scenario.quoteAuthor
        ? m.embedRecordView({
            record: m.post({
              text: 'Quoted post text',
            }),
            labels: (scenario.labels.quotedPost || []).map((val) =>
              m.label({
                val,
                uri: `at://${author.did}/app.bsky.feed.post/fake`,
              }),
            ),
            author: this.profileViewBasic(scenario.quoteAuthor, {
              account: scenario.labels.quotedAccount,
            }),
          })
        : undefined,
    })
  }

  profileScenario(scenario: ModerationTestSuiteScenario) {
    if (scenario.subject !== 'profile') {
      throw new Error('Scenario subject must be "profile"')
    }
    return this.profileViewBasic(scenario.author, scenario.labels)
  }

  profileViewBasic(
    name: string,
    scenarioLabels: ModerationTestSuiteScenario['labels'],
  ) {
    const def = this.users[name]

    const labels: ComAtprotoLabelDefs.Label[] = []
    if (scenarioLabels.account) {
      for (const l of scenarioLabels.account) {
        labels.push(m.label({ val: l, uri: `did:web:${name}` }))
      }
    }
    if (scenarioLabels.profile) {
      for (const l of scenarioLabels.profile) {
        labels.push(
          m.label({
            val: l,
            uri: `at://did:web:${name}/app.bsky.actor.profile/self`,
          }),
        )
      }
    }

    return m.profileViewBasic({
      handle: `${name}.test`,
      labels,
      viewer: m.actorViewerState({
        muted: def.muted || def.mutedByList,
        mutedByList: def.mutedByList
          ? m.listViewBasic({ name: 'Fake List' })
          : undefined,
        blockedBy: def.blockedBy,
        blocking:
          def.blocking || def.blockingByList
            ? 'at://did:web:self.test/app.bsky.graph.block/fake'
            : undefined,
        blockingByList: def.blockingByList
          ? m.listViewBasic({ name: 'Fake List' })
          : undefined,
      }),
    })
  }

  moderationOpts(scenario: ModerationTestSuiteScenario): ModerationOpts {
    return {
      userDid:
        this.configurations[scenario.cfg].authed === false
          ? ''
          : 'did:web:self.test',
      prefs: {
        adultContentEnabled: Boolean(
          this.configurations[scenario.cfg]?.adultContentEnabled,
        ),
        labels: this.configurations[scenario.cfg].settings || {},
        labelers: [
          {
            did: 'did:plc:fake-labeler',
            labels: {},
          },
        ],
        mutedWords: [],
        hiddenPosts: [],
      },
    }
  }
}
