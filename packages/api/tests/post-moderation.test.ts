import { moderatePost } from '../src'
import type {
  ModerationBehaviors,
  ModerationBehaviorScenario,
} from '../definitions/moderation-behaviors'
import { ModerationBehaviorSuiteRunner } from './util/moderation-behavior'
import { readFileSync } from 'fs'
import { join } from 'path'

const suite: ModerationBehaviors = JSON.parse(
  readFileSync(
    join(__dirname, '..', 'definitions', 'post-moderation-behaviors.json'),
    'utf8',
  ),
)

const suiteRunner = new ModerationBehaviorSuiteRunner(suite)

describe('Post moderation behaviors', () => {
  const scenarios = Array.from(Object.entries(suite.scenarios))
  it.each(scenarios)(
    '%s',
    (_name: string, scenario: ModerationBehaviorScenario) => {
      const res = moderatePost(
        suiteRunner.postScenario(scenario),
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
    },
  )
})
