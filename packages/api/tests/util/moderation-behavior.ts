import { ModerationUI, ModerationOpts, ComAtprotoLabelDefs } from '../../src'
import type {
  ModerationBehaviors,
  ModerationBehaviorScenario,
  ModerationBehaviorResult,
} from '../../definitions/moderation-behaviors'
import { mock as m } from './index'

expect.extend({
  toBeModerationResult(
    actual: ModerationUI,
    expected: ModerationBehaviorResult | undefined,
    context: string,
    stringifiedResult: string,
    ignoreCause = false,
  ) {
    const fail = (msg: string) => ({
      pass: false,
      message: () => `${msg}. Full result: ${stringifiedResult}`,
    })
    let cause = actual.cause?.type as string
    if (actual.cause?.type === 'label') {
      cause = `label:${actual.cause.labelDef.id}`
    } else if (actual.cause?.type === 'muted') {
      if (actual.cause.source.type === 'list') {
        cause = 'muted-by-list'
      }
    } else if (actual.cause?.type === 'blocking') {
      if (actual.cause.source.type === 'list') {
        cause = 'blocking-by-list'
      }
    }
    if (!expected) {
      if (!ignoreCause && actual.cause) {
        return fail(`${context} expected to be a no-op, got ${cause}`)
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
      if (!ignoreCause && cause !== expected.cause) {
        return fail(`${context} expected to be ${expected.cause}, got ${cause}`)
      }
      if (!!actual.alert !== !!expected.alert) {
        return fail(
          `${context} expected to be alert=${expected.alert || false}, got ${
            actual.alert || false
          }`,
        )
      }
      if (!!actual.blur !== !!expected.blur) {
        return fail(
          `${context} expected to be blur=${expected.blur || false}, got ${
            actual.blur || false
          }`,
        )
      }
      if (!!actual.filter !== !!expected.filter) {
        return fail(
          `${context} expected to be filter=${expected.filter || false}, got ${
            actual.filter || false
          }`,
        )
      }
      if (!!actual.noOverride !== !!expected.noOverride) {
        return fail(
          `${context} expected to be noOverride=${
            expected.noOverride || false
          }, got ${actual.noOverride || false}`,
        )
      }
    }
    return { pass: true, message: () => '' }
  },
})

export class ModerationBehaviorSuiteRunner {
  constructor(public suite: ModerationBehaviors) {}

  postScenario(scenario: ModerationBehaviorScenario) {
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

  profileScenario(scenario: ModerationBehaviorScenario) {
    if (scenario.subject !== 'profile') {
      throw new Error('Scenario subject must be "profile"')
    }
    return this.profileViewBasic(scenario.author, scenario.labels)
  }

  profileViewBasic(
    name: string,
    scenarioLabels: ModerationBehaviorScenario['labels'],
  ) {
    const def = this.suite.users[name]

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

  moderationOpts(scenario: ModerationBehaviorScenario): ModerationOpts {
    return {
      userDid:
        this.suite.configurations[scenario.cfg].authed === false
          ? ''
          : 'did:web:self.test',
      adultContentEnabled: Boolean(
        this.suite.configurations[scenario.cfg].adultContentEnabled,
      ),
      labels: this.suite.configurations[scenario.cfg].settings,
      labelers: [
        {
          labeler: {
            did: 'did:plc:fake-labeler',
            displayName: 'Fake Labeler',
          },
          labels: this.suite.configurations[scenario.cfg].settings,
        },
      ],
    }
  }
}
