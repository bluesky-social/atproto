import {
  ModerationUI,
  ModerationOpts,
  ComAtprotoLabelDefs,
  LabelPreference,
} from '../../src'
import { mock as m } from '../../src/mocker'

export type ModerationTestSuiteResultFlag =
  | 'filter'
  | 'blur'
  | 'alert'
  | 'inform'
  | 'noOverride'

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

expect.extend({
  toBeModerationResult(
    actual: ModerationUI,
    expected: ModerationTestSuiteResultFlag[] | undefined,
    context = '',
    stringifiedResult: string | undefined = undefined,
    _ignoreCause = false,
  ) {
    const fail = (msg: string) => ({
      pass: false,
      message: () =>
        `${msg}.${
          stringifiedResult ? ` Full result: ${stringifiedResult}` : ''
        }`,
    })
    // let cause = actual.causes?.type as string
    // if (actual.cause?.type === 'label') {
    //   cause = `label:${actual.cause.labelDef.id}`
    // } else if (actual.cause?.type === 'muted') {
    //   if (actual.cause.source.type === 'list') {
    //     cause = 'muted-by-list'
    //   }
    // } else if (actual.cause?.type === 'blocking') {
    //   if (actual.cause.source.type === 'list') {
    //     cause = 'blocking-by-list'
    //   }
    // }
    if (!expected) {
      // if (!ignoreCause && actual.cause) {
      //   return fail(`${context} expected to be a no-op, got ${cause}`)
      // }
      if (actual.inform) {
        return fail(`${context} expected to be a no-op, got inform=true`)
      }
      if (actual.alert) {
        return fail(`${context} expected to be a no-op, got alert=true`)
      }
      if (actual.blur) {
        return fail(`${context} expected to be a no-op, got blur=true`)
      }
      if (actual.filter) {
        return fail(`${context} expected to be a no-op, got filter=true`)
      }
      if (actual.noOverride) {
        return fail(`${context} expected to be a no-op, got noOverride=true`)
      }
    } else {
      // if (!ignoreCause && cause !== expected.cause) {
      //   return fail(`${context} expected to be ${expected.cause}, got ${cause}`)
      // }
      const expectedInform = expected.includes('inform')
      if (!!actual.inform !== expectedInform) {
        return fail(
          `${context} expected to be inform=${expectedInform}, got ${
            actual.inform || false
          }`,
        )
      }
      const expectedAlert = expected.includes('alert')
      if (!!actual.alert !== expectedAlert) {
        return fail(
          `${context} expected to be alert=${expectedAlert}, got ${
            actual.alert || false
          }`,
        )
      }
      const expectedBlur = expected.includes('blur')
      if (!!actual.blur !== expectedBlur) {
        return fail(
          `${context} expected to be blur=${expectedBlur}, got ${
            actual.blur || false
          }`,
        )
      }
      const expectedFilter = expected.includes('filter')
      if (!!actual.filter !== expectedFilter) {
        return fail(
          `${context} expected to be filter=${expectedFilter}, got ${
            actual.filter || false
          }`,
        )
      }
      const expectedNoOverride = expected.includes('noOverride')
      if (!!actual.noOverride !== expectedNoOverride) {
        return fail(
          `${context} expected to be noOverride=${expectedNoOverride}, got ${
            actual.noOverride || false
          }`,
        )
      }
    }
    return { pass: true, message: () => '' }
  },
})

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
