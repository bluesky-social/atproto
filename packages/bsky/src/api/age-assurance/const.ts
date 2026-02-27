import { app } from '../../lexicons/index.js'

const defs = app.bsky.ageassurance.defs

/**
 * Age assurance configuration defining rules for various regions.
 *
 * NOTE: These rules are matched in order, and the first matching rule
 * determines the access level granted.
 *
 * NOTE: all regions MUST have a default rule as the last rule.
 */
export const AGE_ASSURANCE_CONFIG = defs.config.$build({
  regions: [
    {
      countryCode: 'GB',
      regionCode: undefined,
      minAccessAge: 13,
      rules: [
        defs.configRegionRuleIfAssuredOverAge.$build({
          age: 18,
          access: 'full',
        }),
        defs.configRegionRuleIfDeclaredOverAge.$build({
          age: 13,
          access: 'safe',
        }),
        defs.configRegionRuleDefault.$build({
          access: 'none',
        }),
      ],
    },
    {
      countryCode: 'AU',
      regionCode: undefined,
      minAccessAge: 16,
      rules: [
        defs.configRegionRuleIfAccountNewerThan.$build({
          date: '2025-12-10T00:00:00Z',
          access: 'none',
        }),
        defs.configRegionRuleIfAssuredOverAge.$build({
          age: 18,
          access: 'full',
        }),
        defs.configRegionRuleIfAssuredOverAge.$build({
          age: 16,
          access: 'safe',
        }),
        defs.configRegionRuleIfDeclaredOverAge.$build({
          age: 16,
          access: 'safe',
        }),
        defs.configRegionRuleDefault.$build({
          access: 'none',
        }),
      ],
    },
    {
      countryCode: 'US',
      regionCode: 'SD',
      minAccessAge: 13,
      rules: [
        defs.configRegionRuleIfAssuredOverAge.$build({
          age: 18,
          access: 'full',
        }),
        defs.configRegionRuleIfDeclaredOverAge.$build({
          age: 13,
          access: 'safe',
        }),
        defs.configRegionRuleDefault.$build({
          access: 'none',
        }),
      ],
    },
    {
      countryCode: 'US',
      regionCode: 'WY',
      minAccessAge: 13,
      rules: [
        defs.configRegionRuleIfAssuredOverAge.$build({
          age: 18,
          access: 'full',
        }),
        defs.configRegionRuleIfDeclaredOverAge.$build({
          age: 13,
          access: 'safe',
        }),
        defs.configRegionRuleDefault.$build({
          access: 'none',
        }),
      ],
    },
    {
      countryCode: 'US',
      regionCode: 'OH',
      minAccessAge: 13,
      rules: [
        defs.configRegionRuleIfAssuredOverAge.$build({
          age: 18,
          access: 'full',
        }),
        defs.configRegionRuleIfDeclaredOverAge.$build({
          age: 13,
          access: 'safe',
        }),
        defs.configRegionRuleDefault.$build({
          access: 'none',
        }),
      ],
    },
    {
      countryCode: 'US',
      regionCode: 'MS',
      minAccessAge: 18,
      rules: [
        defs.configRegionRuleIfAssuredOverAge.$build({
          age: 18,
          access: 'full',
        }),
        defs.configRegionRuleDefault.$build({
          access: 'none',
        }),
      ],
    },
    {
      countryCode: 'US',
      regionCode: 'VA',
      minAccessAge: 16,
      rules: [
        defs.configRegionRuleIfAssuredOverAge.$build({
          age: 16,
          access: 'full',
        }),
        defs.configRegionRuleIfDeclaredOverAge.$build({
          age: 16,
          access: 'full',
        }),
        defs.configRegionRuleDefault.$build({
          access: 'none',
        }),
      ],
    },
    {
      countryCode: 'US',
      regionCode: 'TN',
      minAccessAge: 18,
      rules: [
        defs.configRegionRuleIfAssuredOverAge.$build({
          age: 18,
          access: 'full',
        }),
        defs.configRegionRuleIfDeclaredOverAge.$build({
          age: 18,
          access: 'full',
        }),
        defs.configRegionRuleDefault.$build({
          access: 'none',
        }),
      ],
    },
  ],
})
