import { AtpAgent, ToolsOzoneSafelinkDefs } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'
import { forSnapshot } from './_util'

describe('safelink management', () => {
  let network: TestNetwork
  let adminAgent: AtpAgent
  let modAgent: AtpAgent
  let triageAgent: AtpAgent
  let sc: SeedClient

  const getAdminHeaders = async (route: string) => {
    return {
      headers: await network.ozone.modHeaders(route, 'admin'),
    }
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_safelink_test',
    })
    adminAgent = network.ozone.getClient()
    modAgent = network.ozone.getClient()
    triageAgent = network.ozone.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  describe('addRule', () => {
    const testRule = {
      url: 'https://malicious-site.com',
      pattern: ToolsOzoneSafelinkDefs.DOMAIN,
      action: ToolsOzoneSafelinkDefs.BLOCK,
      reason: ToolsOzoneSafelinkDefs.PHISHING,
      comment: 'Known phishing domain targeting users',
    }

    it('allows admins to add rules', async () => {
      const { data: adminRule } = await adminAgent.tools.ozone.safelink.addRule(
        testRule,
        await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
      )
      expect(forSnapshot(adminRule)).toMatchSnapshot()
    })

    it('rejects triage role from adding rules', async () => {
      await expect(
        triageAgent.tools.ozone.safelink.addRule(testRule, {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneSafelinkAddRule,
            'triage',
          ),
        }),
      ).rejects.toThrow('Must be a moderator to add URL rules')
    })

    it('prevents duplicate rules for same URL/pattern combination', async () => {
      await expect(
        adminAgent.tools.ozone.safelink.addRule(
          testRule,
          await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
        ),
      ).rejects.toThrow('A rule for this URL/domain already exists')
    })

    it('validates invalid pattern types', async () => {
      await expect(
        adminAgent.tools.ozone.safelink.addRule(
          {
            ...testRule,
            url: 'https://new-site.com',
            pattern: 'invalid-pattern',
          },
          await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
        ),
      ).rejects.toThrow('Invalid safelink pattern type')
    })

    it('validates invalid action types', async () => {
      await expect(
        adminAgent.tools.ozone.safelink.addRule(
          {
            ...testRule,
            url: 'https://new-site2.com',
            action: 'invalid-action',
          },
          await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
        ),
      ).rejects.toThrow('Invalid safelink action type')
    })

    it('validates invalid reason types', async () => {
      await expect(
        adminAgent.tools.ozone.safelink.addRule(
          {
            ...testRule,
            url: 'https://new-site3.com',
            reason: 'invalid-reason',
          },
          await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
        ),
      ).rejects.toThrow('Invalid safelink reason type')
    })
  })

  describe('updateRule', () => {
    const updateTestRule = {
      url: 'https://update-test.com',
      pattern: ToolsOzoneSafelinkDefs.DOMAIN,
      action: ToolsOzoneSafelinkDefs.WARN,
      reason: ToolsOzoneSafelinkDefs.SPAM,
      comment: 'Initially marked as spam',
    }

    beforeAll(async () => {
      await adminAgent.tools.ozone.safelink.addRule(
        updateTestRule,
        await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
      )
    })

    it('allows updating existing rules', async () => {
      const updatedData = {
        url: updateTestRule.url,
        pattern: updateTestRule.pattern,
        action: ToolsOzoneSafelinkDefs.BLOCK,
        reason: ToolsOzoneSafelinkDefs.PHISHING,
        comment: 'Updated: confirmed phishing site',
      }

      const { data: updated } = await modAgent.tools.ozone.safelink.updateRule(
        updatedData,
        await getAdminHeaders(ids.ToolsOzoneSafelinkUpdateRule),
      )
      const { data: queried } = await modAgent.tools.ozone.safelink.queryRules(
        { urls: [updateTestRule.url] },
        await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
      )
      expect(updated).toMatchObject(updatedData)
      expect(queried.rules[0]).toMatchObject(updatedData)
    })

    it('rejects triage role from updating rules', async () => {
      await expect(
        triageAgent.tools.ozone.safelink.updateRule(updateTestRule, {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneSafelinkUpdateRule,
            'triage',
          ),
        }),
      ).rejects.toThrow('Must be a moderator to update URL rules')
    })

    it('throws error when updating non-existent rule', async () => {
      await expect(
        adminAgent.tools.ozone.safelink.updateRule(
          {
            ...updateTestRule,
            url: 'https://non-existent.com',
          },
          await getAdminHeaders(ids.ToolsOzoneSafelinkUpdateRule),
        ),
      ).rejects.toThrow('No active rule found for this URL/domain')
    })
  })

  describe('removeRule', () => {
    const removeTestRule = {
      url: 'https://remove-test.com',
      pattern: ToolsOzoneSafelinkDefs.URL,
      action: ToolsOzoneSafelinkDefs.BLOCK,
      reason: ToolsOzoneSafelinkDefs.CSAM,
      comment: 'Rule to be removed',
    }

    beforeAll(async () => {
      await adminAgent.tools.ozone.safelink.addRule(
        removeTestRule,
        await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
      )
    })

    it('allows admins and moderators to remove existing rules', async () => {
      const { data: removed } =
        await adminAgent.tools.ozone.safelink.removeRule(
          {
            url: removeTestRule.url,
            pattern: removeTestRule.pattern,
            comment: 'Removing rule - false positive',
          },
          await getAdminHeaders(ids.ToolsOzoneSafelinkRemoveRule),
        )

      expect(removed.eventType).toEqual(ToolsOzoneSafelinkDefs.REMOVERULE)
      expect(removed.url).toEqual(removeTestRule.url)
      expect(removed.comment).toEqual('Removing rule - false positive')
    })

    it('rejects non-moderators from removing rules', async () => {
      await adminAgent.tools.ozone.safelink.addRule(
        {
          url: 'https://remove-test2.com',
          pattern: ToolsOzoneSafelinkDefs.DOMAIN,
          action: ToolsOzoneSafelinkDefs.BLOCK,
          reason: ToolsOzoneSafelinkDefs.SPAM,
        },
        await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
      )

      await expect(
        triageAgent.tools.ozone.safelink.removeRule(
          {
            url: 'https://remove-test2.com',
            pattern: ToolsOzoneSafelinkDefs.DOMAIN,
          },
          {
            headers: await network.ozone.modHeaders(
              ids.ToolsOzoneSafelinkRemoveRule,
              'triage',
            ),
          },
        ),
      ).rejects.toThrow('Must be a moderator to remove URL rules')
    })

    it('throws error when removing non-existent rule', async () => {
      await expect(
        adminAgent.tools.ozone.safelink.removeRule(
          {
            url: 'https://never-existed.com',
            pattern: ToolsOzoneSafelinkDefs.DOMAIN,
          },
          await getAdminHeaders(ids.ToolsOzoneSafelinkRemoveRule),
        ),
      ).rejects.toThrow('No active rule found for this URL/domain')
    })
  })

  describe('queryRules', () => {
    beforeAll(async () => {
      await adminAgent.tools.ozone.safelink.addRule(
        {
          url: 'https://query-test1.com',
          pattern: ToolsOzoneSafelinkDefs.DOMAIN,
          action: ToolsOzoneSafelinkDefs.BLOCK,
          reason: ToolsOzoneSafelinkDefs.PHISHING,
        },
        await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
      )
      await adminAgent.tools.ozone.safelink.addRule(
        {
          url: 'https://query-test2.com/specific-path',
          pattern: ToolsOzoneSafelinkDefs.URL,
          action: ToolsOzoneSafelinkDefs.WARN,
          reason: ToolsOzoneSafelinkDefs.SPAM,
        },
        await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
      )
    })

    it('allows querying all active rules', async () => {
      const { data: result } = await modAgent.tools.ozone.safelink.queryRules(
        {},
        await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
      )

      expect(result.rules.length).toBeGreaterThan(0)
      expect(forSnapshot(result.rules)).toMatchSnapshot()
    })

    it('allows filtering rules by action', async () => {
      const { data: blocked } =
        await adminAgent.tools.ozone.safelink.queryRules(
          {
            actions: [ToolsOzoneSafelinkDefs.BLOCK],
          },
          await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
        )

      const { data: warned } = await adminAgent.tools.ozone.safelink.queryRules(
        {
          actions: [ToolsOzoneSafelinkDefs.WARN],
        },
        await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
      )

      expect(
        blocked.rules.every(
          (rule) => rule.action === ToolsOzoneSafelinkDefs.BLOCK,
        ),
      ).toBe(true)
      expect(
        warned.rules.every(
          (rule) => rule.action === ToolsOzoneSafelinkDefs.WARN,
        ),
      ).toBe(true)
    })

    it('allows filtering rules by reason', async () => {
      const { data: phishing } =
        await adminAgent.tools.ozone.safelink.queryRules(
          {
            reason: ToolsOzoneSafelinkDefs.PHISHING,
          },
          await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
        )

      const { data: spam } = await adminAgent.tools.ozone.safelink.queryRules(
        {
          reason: ToolsOzoneSafelinkDefs.SPAM,
        },
        await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
      )

      expect(
        phishing.rules.every(
          (rule) => rule.reason === ToolsOzoneSafelinkDefs.PHISHING,
        ),
      ).toBe(true)
      expect(
        spam.rules.every((rule) => rule.reason === ToolsOzoneSafelinkDefs.SPAM),
      ).toBe(true)
    })

    it('allows searching by URL', async () => {
      const { data: result } = await adminAgent.tools.ozone.safelink.queryRules(
        {
          urls: ['https://query-test1.com'],
        },
        await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
      )

      expect(result.rules.length).toEqual(1)
      expect(result.rules[0]?.url).toEqual('https://query-test1.com')
    })

    it('supports pagination', async () => {
      const headers = await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules)
      const { data: page1 } = await adminAgent.tools.ozone.safelink.queryRules(
        { limit: 4 },
        headers,
      )

      expect(page1.rules.length).toEqual(4)

      const { data: page2 } = await adminAgent.tools.ozone.safelink.queryRules(
        {
          limit: 5,
          cursor: page1.cursor,
        },
        headers,
      )

      expect(page2.rules.length).toEqual(1)
    })
  })

  describe('queryEvents', () => {
    beforeAll(async () => {
      await adminAgent.tools.ozone.safelink.addRule(
        {
          url: 'https://events-test.com',
          pattern: ToolsOzoneSafelinkDefs.DOMAIN,
          action: ToolsOzoneSafelinkDefs.WARN,
          reason: ToolsOzoneSafelinkDefs.SPAM,
          comment: 'Initial rule creation',
        },
        await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
      )
      await adminAgent.tools.ozone.safelink.updateRule(
        {
          url: 'https://events-test.com',
          pattern: ToolsOzoneSafelinkDefs.DOMAIN,
          action: ToolsOzoneSafelinkDefs.BLOCK,
          reason: ToolsOzoneSafelinkDefs.PHISHING,
          comment: 'Escalated to block',
        },
        await getAdminHeaders(ids.ToolsOzoneSafelinkUpdateRule),
      )
    })

    it('allows querying safelink events', async () => {
      const { data: result } = await modAgent.tools.ozone.safelink.queryEvents(
        {},
        await getAdminHeaders(ids.ToolsOzoneSafelinkQueryEvents),
      )

      expect(result.events.length).toBeGreaterThan(0)
      expect(forSnapshot(result.events)).toMatchSnapshot()
    })

    it('allows filtering events by URL', async () => {
      const { data: result } =
        await adminAgent.tools.ozone.safelink.queryEvents(
          {
            urls: ['https://events-test.com'],
          },
          await getAdminHeaders(ids.ToolsOzoneSafelinkQueryEvents),
        )

      expect(
        result.events.every((event) => event.url === 'https://events-test.com'),
      ).toBe(true)
      expect(result.events.length).toBeGreaterThanOrEqual(2)
    })

    it('supports pagination', async () => {
      const headers = await getAdminHeaders(ids.ToolsOzoneSafelinkQueryEvents)
      const { data: page1 } = await adminAgent.tools.ozone.safelink.queryEvents(
        {
          limit: 9,
        },
        headers,
      )

      const { data: page2 } = await adminAgent.tools.ozone.safelink.queryEvents(
        {
          limit: 10,
          cursor: page1.cursor,
        },
        headers,
      )

      const { data: page3 } = await adminAgent.tools.ozone.safelink.queryEvents(
        {
          limit: 10,
          cursor: page2.cursor,
        },
        headers,
      )

      expect(page1.events.length).toBeLessThanOrEqual(9)
      expect(page2.events.length).toEqual(1)
      expect(page3.cursor).toBeUndefined()
    })
  })

  describe('event history over time', () => {
    it('maintains audit trail through rule lifecycle', async () => {
      const testUrl = 'https://lifecycle-test.com'
      const pattern = ToolsOzoneSafelinkDefs.DOMAIN

      await adminAgent.tools.ozone.safelink.addRule(
        {
          url: testUrl,
          pattern,
          action: ToolsOzoneSafelinkDefs.WARN,
          reason: ToolsOzoneSafelinkDefs.SPAM,
          comment: 'Initial warning',
        },
        await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
      )

      await modAgent.tools.ozone.safelink.updateRule(
        {
          url: testUrl,
          pattern,
          action: ToolsOzoneSafelinkDefs.BLOCK,
          reason: ToolsOzoneSafelinkDefs.PHISHING,
          comment: 'Escalated to block',
        },
        await getAdminHeaders(ids.ToolsOzoneSafelinkUpdateRule),
      )

      await adminAgent.tools.ozone.safelink.removeRule(
        {
          url: testUrl,
          pattern,
          comment: 'False positive',
        },
        await getAdminHeaders(ids.ToolsOzoneSafelinkRemoveRule),
      )

      const { data: events } =
        await adminAgent.tools.ozone.safelink.queryEvents(
          {
            urls: [testUrl],
          },
          await getAdminHeaders(ids.ToolsOzoneSafelinkQueryEvents),
        )

      expect(events.events.length).toEqual(3)
      const eventTypes = events.events.map((e) => e.eventType).sort()
      expect(eventTypes).toEqual(
        [
          ToolsOzoneSafelinkDefs.ADDRULE,
          ToolsOzoneSafelinkDefs.UPDATERULE,
          ToolsOzoneSafelinkDefs.REMOVERULE,
        ].sort(),
      )

      const { data: queryResult } =
        await adminAgent.tools.ozone.safelink.queryRules(
          {
            urls: [testUrl],
          },
          await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
        )
      expect(queryResult.rules.length).toEqual(0)
    })

    it('handles domain vs URL pattern precedence correctly', async () => {
      const domain = 'precedence-test.com'
      const specificUrl = 'https://precedence-test.com/safe-page'
      const headers = await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule)

      await adminAgent.tools.ozone.safelink.addRule(
        {
          url: domain,
          pattern: ToolsOzoneSafelinkDefs.DOMAIN,
          action: ToolsOzoneSafelinkDefs.BLOCK,
          reason: ToolsOzoneSafelinkDefs.PHISHING,
        },
        headers,
      )

      await adminAgent.tools.ozone.safelink.addRule(
        {
          url: specificUrl,
          pattern: ToolsOzoneSafelinkDefs.URL,
          action: ToolsOzoneSafelinkDefs.WHITELIST,
          reason: ToolsOzoneSafelinkDefs.NONE,
        },
        headers,
      )

      const { data: specificResult } =
        await adminAgent.tools.ozone.safelink.queryRules(
          {
            urls: [specificUrl],
          },
          await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
        )
      expect(specificResult.rules.length).toEqual(1)
      expect(specificResult.rules[0]?.action).toEqual(
        ToolsOzoneSafelinkDefs.WHITELIST,
      )

      const { data: domainResult } =
        await adminAgent.tools.ozone.safelink.queryRules(
          { urls: [domain] },
          await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
        )
      expect(domainResult.rules.length).toEqual(1)
      expect(domainResult.rules[0]?.action).toEqual(
        ToolsOzoneSafelinkDefs.BLOCK,
      )
    })
  })
})
