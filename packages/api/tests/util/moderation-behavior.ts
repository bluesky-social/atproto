import type {
  ModerationBehaviorScenario,
  ModerationBehaviors,
} from '../../definitions/moderation-behaviors'
import { ComAtprotoLabelDefs, ModerationOpts } from '../../src'
import { mock as m } from './index'

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
