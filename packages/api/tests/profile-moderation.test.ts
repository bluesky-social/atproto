import { moderateProfile } from '../src'
import type {
  ModerationTestSuite,
  ModerationTestSuiteScenario,
} from '../definitions/moderation-behaviors'
import { ModerationBehaviorSuiteRunner } from './util/moderation-behavior'
import { readFileSync } from 'fs'
import { join } from 'path'

const suite: ModerationTestSuite = JSON.parse(
  readFileSync(
    join(__dirname, '..', 'definitions', 'profile-moderation-behaviors.json'),
    'utf8',
  ),
)

const suiteRunner = new ModerationBehaviorSuiteRunner(suite)

describe('Profile moderation behaviors', () => {
  const scenarios = Array.from(Object.entries(suite.scenarios)).filter(
    ([name]) => !name.startsWith('//'),
  )
  it.each(scenarios)(
    '%s',
    (_name: string, scenario: ModerationTestSuiteScenario) => {
      const res = moderateProfile(
        suiteRunner.profileScenario(scenario),
        suiteRunner.moderationOpts(scenario),
      )
      expect(res.ui('profileList')).toBeModerationResult(
        scenario.behaviors.profileList,
        'profileList',
        JSON.stringify(res, null, 2),
      )
      expect(res.ui('profileView')).toBeModerationResult(
        scenario.behaviors.profileView,
        'profileView',
        JSON.stringify(res, null, 2),
      )
      expect(res.ui('avatar')).toBeModerationResult(
        scenario.behaviors.avatar,
        'avatar',
        JSON.stringify(res, null, 2),
      )
      expect(res.ui('banner')).toBeModerationResult(
        scenario.behaviors.banner,
        'banner',
        JSON.stringify(res, null, 2),
      )
      expect(res.ui('displayName')).toBeModerationResult(
        scenario.behaviors.displayName,
        'displayName',
        JSON.stringify(res, null, 2),
      )
      expect(res.ui('contentList')).toBeModerationResult(
        scenario.behaviors.contentList,
        'contentList',
        JSON.stringify(res, null, 2),
      )
      expect(res.ui('contentView')).toBeModerationResult(
        scenario.behaviors.contentView,
        'contentView',
        JSON.stringify(res, null, 2),
      )
      expect(res.ui('contentMedia')).toBeModerationResult(
        scenario.behaviors.contentMedia,
        'contentMedia',
        JSON.stringify(res, null, 2),
      )
    },
  )
})
