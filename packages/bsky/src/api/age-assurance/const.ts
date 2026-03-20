import { app } from '../../lexicons/index.js'

/**
 * Age assurance configuration defining rules for various regions.
 *
 * NOTE: These rules are matched in order, and the first matching rule
 * determines the access level granted.
 *
 * NOTE: all regions MUST have a default rule as the last rule.
 */
export const AGE_ASSURANCE_CONFIG = app.bsky.ageassurance.defs.config.$build({
  regions: [
    {
      countryCode: 'GB',
      regionCode: undefined,
      minAccessAge: 13,
      rules: [
        app.bsky.ageassurance.defs.configRegionRuleIfAssuredOverAge.$build({
          age: 18,
          access: 'full',
        }),
        app.bsky.ageassurance.defs.configRegionRuleIfDeclaredOverAge.$build({
          age: 13,
          access: 'safe',
        }),
        app.bsky.ageassurance.defs.configRegionRuleDefault.$build({
          access: 'none',
        }),
      ],
    },
    {
      countryCode: 'AU',
      regionCode: undefined,
      minAccessAge: 16,
      rules: [
        app.bsky.ageassurance.defs.configRegionRuleIfAccountNewerThan.$build({
          date: '2025-12-10T00:00:00Z',
          access: 'none',
        }),
        app.bsky.ageassurance.defs.configRegionRuleIfAssuredOverAge.$build({
          age: 18,
          access: 'full',
        }),
        app.bsky.ageassurance.defs.configRegionRuleIfAssuredOverAge.$build({
          age: 16,
          access: 'safe',
        }),
        app.bsky.ageassurance.defs.configRegionRuleIfDeclaredOverAge.$build({
          age: 16,
          access: 'safe',
        }),
        app.bsky.ageassurance.defs.configRegionRuleDefault.$build({
          access: 'none',
        }),
      ],
    },
    {
      countryCode: 'US',
      regionCode: 'SD',
      minAccessAge: 13,
      rules: [
        app.bsky.ageassurance.defs.configRegionRuleIfAssuredOverAge.$build({
          age: 18,
          access: 'full',
        }),
        app.bsky.ageassurance.defs.configRegionRuleIfDeclaredOverAge.$build({
          age: 13,
          access: 'safe',
        }),
        app.bsky.ageassurance.defs.configRegionRuleDefault.$build({
          access: 'none',
        }),
      ],
    },
    {
      countryCode: 'US',
      regionCode: 'WY',
      minAccessAge: 13,
      rules: [
        app.bsky.ageassurance.defs.configRegionRuleIfAssuredOverAge.$build({
          age: 18,
          access: 'full',
        }),
        app.bsky.ageassurance.defs.configRegionRuleIfDeclaredOverAge.$build({
          age: 13,
          access: 'safe',
        }),
        app.bsky.ageassurance.defs.configRegionRuleDefault.$build({
          access: 'none',
        }),
      ],
    },
    {
      countryCode: 'US',
      regionCode: 'OH',
      minAccessAge: 13,
      rules: [
        app.bsky.ageassurance.defs.configRegionRuleIfAssuredOverAge.$build({
          age: 18,
          access: 'full',
        }),
        app.bsky.ageassurance.defs.configRegionRuleIfDeclaredOverAge.$build({
          age: 13,
          access: 'safe',
        }),
        app.bsky.ageassurance.defs.configRegionRuleDefault.$build({
          access: 'none',
        }),
      ],
    },
    {
      countryCode: 'US',
      regionCode: 'MS',
      minAccessAge: 18,
      rules: [
        app.bsky.ageassurance.defs.configRegionRuleIfAssuredOverAge.$build({
          age: 18,
          access: 'full',
        }),
        app.bsky.ageassurance.defs.configRegionRuleDefault.$build({
          access: 'none',
        }),
      ],
    },
    {
      countryCode: 'US',
      regionCode: 'VA',
      minAccessAge: 16,
      rules: [
        app.bsky.ageassurance.defs.configRegionRuleIfAssuredOverAge.$build({
          age: 16,
          access: 'full',
        }),
        app.bsky.ageassurance.defs.configRegionRuleIfDeclaredOverAge.$build({
          age: 16,
          access: 'full',
        }),
        app.bsky.ageassurance.defs.configRegionRuleDefault.$build({
          access: 'none',
        }),
      ],
    },
    {
      countryCode: 'US',
      regionCode: 'TN',
      minAccessAge: 18,
      rules: [
        app.bsky.ageassurance.defs.configRegionRuleIfAssuredOverAge.$build({
          age: 18,
          access: 'full',
        }),
        app.bsky.ageassurance.defs.configRegionRuleIfDeclaredOverAge.$build({
          age: 18,
          access: 'full',
        }),
        app.bsky.ageassurance.defs.configRegionRuleDefault.$build({
          access: 'none',
        }),
      ],
    },
  ],
})
