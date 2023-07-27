import { moderateProfile } from '../src'
import type {
  ModerationBehaviors,
  ModerationBehaviorScenario,
} from '../definitions/moderation-behaviors'
import { ModerationBehaviorSuiteRunner } from './util/moderation-behavior'
import { readFileSync } from 'fs'
import { join } from 'path'

const suite: ModerationBehaviors = JSON.parse(
  readFileSync(
    join(__dirname, '..', 'definitions', 'profile-moderation-behaviors.json'),
    'utf8',
  ),
)

const suiteRunner = new ModerationBehaviorSuiteRunner(suite)

describe('Post moderation behaviors', () => {
  const scenarios = Array.from(Object.entries(suite.scenarios))
  it.each(scenarios)(
    '%s',
    (_name: string, scenario: ModerationBehaviorScenario) => {
      const res = moderateProfile(
        suiteRunner.profileScenario(scenario),
        suiteRunner.moderationOpts(scenario),
      )
      expect(res.account).toBeModerationResult(
        scenario.behaviors.account,
        'account',
        JSON.stringify(res, null, 2),
      )
      expect(res.profile).toBeModerationResult(
        scenario.behaviors.profile,
        'profile content',
        JSON.stringify(res, null, 2),
      )
      expect(res.avatar).toBeModerationResult(
        scenario.behaviors.avatar,
        'profile avatar',
        JSON.stringify(res, null, 2),
        true,
      )
    },
  )
})
