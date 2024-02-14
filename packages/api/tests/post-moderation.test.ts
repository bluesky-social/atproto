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
  const scenarios = Array.from(Object.entries(suite.scenarios)).filter(
    ([name]) => !name.startsWith('//'),
  )
  it.each(scenarios)(
    '%s',
    (_name: string, scenario: ModerationBehaviorScenario) => {
      const res = moderatePost(
        suiteRunner.postScenario(scenario),
        suiteRunner.moderationOpts(scenario),
      )
      expect(res.ui('avatar')).toBeModerationResult(
        scenario.behaviors.avatar,
        'avatar',
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
