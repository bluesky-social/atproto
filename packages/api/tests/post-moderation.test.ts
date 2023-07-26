import {
  moderatePost,
  moderateProfile,
  moderateUserList,
  moderateFeedGenerator,
  ModerationUI,
  ModerationOpts,
  LabelDefinitionPreference,
  ComAtprotoLabelDefs,
} from '../src'
import type {
  ModerationBehaviors,
  ModerationBehaviorScenario,
  ModerationBehaviorResult,
} from '../definitions/moderation-behaviors'
import { mock as m } from './_util'
import { readFileSync } from 'fs'
import { join } from 'path'

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
    const cause =
      actual.cause?.type === 'label'
        ? `label:${actual.cause.labelDef.id}`
        : actual.cause?.type
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
    return { pass: true }
  },
})

const suite: ModerationBehaviors = JSON.parse(
  readFileSync(
    join(__dirname, '..', 'definitions', 'post-moderation-behaviors.json'),
    'utf8',
  ),
)

const suiteRunner = {
  profileViewBasic(
    name: string,
    scenarioLabels: ModerationBehaviorScenario['labels'],
  ) {
    const def = suite.users[name]

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
        muted: def.muted,
        mutedByList: def.mutedByList
          ? m.listViewBasic({ name: 'Fake List' })
          : undefined,
        blockedBy: def.blockedBy,
        blocking: def.blocking
          ? 'at://did:web:self.test/app.bsky.graph.block/fake'
          : undefined,
      }),
    })
  },

  post(scenario: ModerationBehaviorScenario) {
    const author = suiteRunner.profileViewBasic(
      scenario.author,
      scenario.labels,
    )
    return m.postView({
      record: m.post({
        text: 'Post text',
      }),
      author,
      labels: (scenario.labels.post || []).map((val) =>
        m.label({ val, uri: `at://${author.did}/app.bsky.post/fake` }),
      ),
      embed: scenario.quoteAuthor
        ? m.embedRecordView({
            record: m.post({
              text: 'Quoted post text',
            }),
            labels: (scenario.labels.quotedPost || []).map((val) =>
              m.label({ val, uri: `at://${author.did}/app.bsky.post/fake` }),
            ),
            author: suiteRunner.profileViewBasic(scenario.quoteAuthor, {
              account: scenario.labels.quotedAccount,
            }),
          })
        : undefined,
    })
  },

  moderationOpts(scenario: ModerationBehaviorScenario): ModerationOpts {
    return {
      userDid: 'did:web:self.test',
      adultContentEnabled: Boolean(
        suite.configurations[scenario.cfg].adultContentEnabled,
      ),
      labelerSettings: [
        {
          labeler: {
            did: 'did:plc:fake-labeler',
            displayName: 'Fake Labeler',
          },
          settings: suite.configurations[scenario.cfg].settings,
        },
      ],
    }
  },
}

/**
 * Moderation target: post, profile, userlist, feedgen
 * Label target: post, profile, account, quoted post, quoted author
 * Label onwarn: blur, blur-media, warn, null
 * Label setting: ignore, warn, hide
 * Content is by user: yes, no
 */

describe('Post moderation behaviors', () => {
  const scenarios = Array.from(Object.entries(suite.scenarios))
  it.each(scenarios)(
    '%s',
    (_name: string, scenario: ModerationBehaviorScenario) => {
      switch (scenario.subject) {
        case 'post': {
          const res = moderatePost(
            suiteRunner.post(scenario),
            suiteRunner.moderationOpts(scenario),
          )
          expect(res.content).toBeModerationResult(
            scenario.behaviors.content,
            'post content',
            JSON.stringify(res, null, 2),
          )
          expect(res.avatar).toBeModerationResult(
            scenario.behaviors.avatar,
            'post avatar',
            JSON.stringify(res, null, 2),
            true,
          )
          expect(res.embed).toBeModerationResult(
            scenario.behaviors.embed,
            'post embed',
            JSON.stringify(res, null, 2),
          )
          break
        }
        case 'profile':
          expect(true).toBe(false) // TODO
          break
        case 'userlist':
          expect(true).toBe(false) // TODO
          break
        case 'feedgen':
          expect(true).toBe(false) // TODO
          break
      }
    },
  )
})

function testModerationBehaviorResult(
  actual: ModerationUI,
  expected: ModerationBehaviorResult | undefined,
  context: string,
  ignoreCause = false,
) {
  const cause =
    actual.cause?.type === 'label'
      ? `label:${actual.cause.labelDef.id}`
      : actual.cause?.type
  if (!expected) {
    if (!ignoreCause && actual.cause) {
      throw `${context} expected to be a no-op, got ${cause}`
    }
    expect(actual.cause).toBeUndefined()
    expect(actual.alert).toBeFalsy()
    expect(actual.blur).toBeFalsy()
    expect(actual.filter).toBeFalsy()
    expect(actual.noOverride).toBeFalsy()
  } else {
    if (!ignoreCause && cause !== expected.cause) {
      throw `${context} expected to be ${expected.cause}, got ${cause}`
    }
    expect(Boolean(actual.alert)).toBe(Boolean(expected.alert))
    expect(Boolean(actual.blur)).toBe(Boolean(expected.blur))
    expect(Boolean(actual.filter)).toBe(Boolean(expected.filter))
    expect(Boolean(actual.noOverride)).toBe(Boolean(expected.noOverride))
  }
}

/*

  it('Label on post', () => {
    const res = moderatePost(
      mock.post({ text: 'Hello world', postLabels: ['porn'] }),
      mock.moderationOpts({ settings: { porn: 'hide' } }),
    )
    expect(res.decisions.post.cause).toBeLabelModCause('porn')
    expect(res.decisions.account.cause).toBeUndefined()
    expect(res.decisions.profile.cause).toBeUndefined()
    expect(res.decisions.quote).toBeUndefined()
    expect(res.decisions.quotedAccount).toBeUndefined()
    expect(res.content).toBeLabelModerationUI('porn', {
      filter: true,
    })
    expect(res.avatar).toBeNoopModerationUI()
    expect(res.embed).toBeLabelModerationUI('porn', {
      blur: true,
    })
  })
  
export interface PostModeration {
  decisions: {
    post: ModerationDecision
    account: ModerationDecision
    profile: ModerationDecision
    quote?: ModerationDecision
    quotedAccount?: ModerationDecision
  }
  content: ModerationUI
  avatar: ModerationUI
  embed: ModerationUI
}

{
  "decisions": {
    "post": {
      "cause": {
        "type": "label",
        "label": {
          "src": "did:plc:fake",
          "uri": "at://did:plc:fake/app.bsky.feed.post/fake",
          "val": "porn",
          "cts": "2023-07-25T18:31:58.313Z"
        },
        "labelDef": {
          "id": "porn",
          "preferences": [
            "ignore",
            "warn",
            "hide"
          ],
          "flags": [
            "adult"
          ],
          "onwarn": "blur-media",
          "groupId": "sexual",
          "configurable": true,
          "strings": {
            "settings": {
              "en": {
                "name": "Pornography",
                "description": "Images of full-frontal nudity (genitalia) in any sexualized context, or explicit sexual activity (meaning contact with genitalia or breasts) even if partially covered. Includes graphic sexual cartoons (often jokes/memes)."
              }
            },
            "account": {
              "en": {
                "name": "Pornography",
                "description": "This account contains imagery of full-frontal nudity or explicit sexual activity."
              }
            },
            "content": {
              "en": {
                "name": "Pornography",
                "description": "This content contains imagery of full-frontal nudity or explicit sexual activity."
              }
            }
          }
        },
        "labeler": {
          "did": "did:plc:fake-labeler",
          "displayName": "Fake Labeler"
        },
        "setting": "hide",
        "priority": 3
      },
      "alert": false,
      "blur": false,
      "blurMedia": true,
      "filter": true,
      "noOverride": false,
      "additionalCauses": []
    },
    "account": {
      "alert": false,
      "blur": false,
      "blurMedia": false,
      "filter": false,
      "noOverride": false,
      "additionalCauses": []
    },
    "profile": {
      "alert": false,
      "blur": false,
      "blurMedia": false,
      "filter": false,
      "noOverride": false,
      "additionalCauses": []
    }
  },
  "content": {
    "filter": false,
    "blur": false,
    "alert": false,
    "noOverride": false
  },
  "avatar": {
    "blur": false,
    "alert": false,
    "noOverride": false
  },
  "embed": {}
}
*/
