import { ids } from '@atproto/api'
import type { AtpAgent } from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { forSnapshot } from './_util.js'

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
    adminAgent = network.ozone.getAgent()
    modAgent = network.ozone.getAgent()
    triageAgent = network.ozone.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  describe('addRule', () => {
    const testRule = {
      url: 'https://malicious-site.com',
      pattern: 'domain',
      action: 'block',
      reason: 'phishing',
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
      pattern: 'domain',
      action: 'warn',
      reason: 'spam',
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
        action: 'block',
        reason: 'phishing',
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
      pattern: 'url',
      action: 'block',
      reason: 'csam',
      comment: 'Rule to be removed',
    }

    beforeAll(async () => {
      await adminAgent.tools.ozone.safelink.addRule(
        removeTestRule,
        await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
      )
    })

    it('allows admins to remove existing rules', async () => {
      const { data: removed } =
        await adminAgent.tools.ozone.safelink.removeRule(
          {
            url: removeTestRule.url,
            pattern: removeTestRule.pattern,
            comment: 'Removing rule - false positive',
          },
          await getAdminHeaders(ids.ToolsOzoneSafelinkRemoveRule),
        )

      expect(removed.eventType).toEqual('removeRule')
      expect(removed.url).toEqual(removeTestRule.url)
      expect(removed.comment).toEqual('Removing rule - false positive')
    })

    it('rejects triage role from removing rules', async () => {
      await adminAgent.tools.ozone.safelink.addRule(
        {
          url: 'https://remove-test2.com',
          pattern: 'domain',
          action: 'block',
          reason: 'spam',
        },
        await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
      )

      await expect(
        triageAgent.tools.ozone.safelink.removeRule(
          {
            url: 'https://remove-test2.com',
            pattern: 'domain',
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
            pattern: 'domain',
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
          pattern: 'domain',
          action: 'block',
          reason: 'phishing',
        },
        await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
      )
      await adminAgent.tools.ozone.safelink.addRule(
        {
          url: 'https://query-test2.com/specific-path',
          pattern: 'url',
          action: 'warn',
          reason: 'spam',
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
            actions: ['block'],
          },
          await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
        )

      const { data: warned } = await adminAgent.tools.ozone.safelink.queryRules(
        {
          actions: ['warn'],
        },
        await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
      )

      expect(blocked.rules.every((rule) => rule.action === 'block')).toBe(true)
      expect(warned.rules.every((rule) => rule.action === 'warn')).toBe(true)
    })

    it('allows filtering rules by reason', async () => {
      const { data: phishing } =
        await adminAgent.tools.ozone.safelink.queryRules(
          {
            reason: 'phishing',
          },
          await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
        )

      const { data: spam } = await adminAgent.tools.ozone.safelink.queryRules(
        {
          reason: 'spam',
        },
        await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
      )

      expect(phishing.rules.every((rule) => rule.reason === 'phishing')).toBe(
        true,
      )
      expect(spam.rules.every((rule) => rule.reason === 'spam')).toBe(true)
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
          pattern: 'domain',
          action: 'warn',
          reason: 'spam',
          comment: 'Initial rule creation',
        },
        await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
      )
      await adminAgent.tools.ozone.safelink.updateRule(
        {
          url: 'https://events-test.com',
          pattern: 'domain',
          action: 'block',
          reason: 'phishing',
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
      const pattern = 'domain'
      const source = 'sourceA/'

      const { data: addedEvent } =
        await adminAgent.tools.ozone.safelink.addRule(
          {
            url: testUrl,
            pattern,
            source,
            action: 'warn',
            reason: 'spam',
            comment: 'Initial warning',
          },
          await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
        )
      expect(addedEvent.source).toBe(source)

      const { data: addedRules } =
        await adminAgent.tools.ozone.safelink.queryRules(
          { urls: [testUrl] },
          await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
        )
      expect(addedRules.rules[0]?.source).toBe(source)

      const { data: updatedEvent } =
        await modAgent.tools.ozone.safelink.updateRule(
          {
            url: testUrl,
            pattern,
            source,
            action: 'block',
            reason: 'phishing',
            comment: 'Escalated to block',
          },
          await getAdminHeaders(ids.ToolsOzoneSafelinkUpdateRule),
        )
      expect(updatedEvent.source).toBe(source)

      const { data: updatedRules } =
        await adminAgent.tools.ozone.safelink.queryRules(
          { urls: [testUrl] },
          await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
        )
      expect(updatedRules.rules[0]).toMatchObject({
        source,
        action: 'block',
        reason: 'phishing',
        comment: 'Escalated to block',
      })

      await expect(
        adminAgent.tools.ozone.safelink.removeRule(
          { url: testUrl, pattern, source: 'ozone/default' },
          await getAdminHeaders(ids.ToolsOzoneSafelinkRemoveRule),
        ),
      ).rejects.toThrow('No active rule found for this URL/domain')

      const { data: removedEvent } =
        await adminAgent.tools.ozone.safelink.removeRule(
          {
            url: testUrl,
            pattern,
            source,
            comment: 'False positive',
          },
          await getAdminHeaders(ids.ToolsOzoneSafelinkRemoveRule),
        )
      expect(removedEvent.source).toBe(source)

      const { data: events } =
        await adminAgent.tools.ozone.safelink.queryEvents(
          {
            urls: [testUrl],
          },
          await getAdminHeaders(ids.ToolsOzoneSafelinkQueryEvents),
        )

      expect(events.events.length).toEqual(3)
      expect(events.events.every((event) => event.source === source)).toBe(true)
      const eventTypes = events.events.map((e) => e.eventType).sort()
      expect(eventTypes).toEqual(['addRule', 'updateRule', 'removeRule'].sort())

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
          pattern: 'domain',
          action: 'block',
          reason: 'phishing',
        },
        headers,
      )

      await adminAgent.tools.ozone.safelink.addRule(
        {
          url: specificUrl,
          pattern: 'url',
          action: 'whitelist',
          reason: 'none',
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
      expect(specificResult.rules[0]?.action).toEqual('whitelist')

      const { data: domainResult } =
        await adminAgent.tools.ozone.safelink.queryRules(
          { urls: [domain] },
          await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
        )
      expect(domainResult.rules.length).toEqual(1)
      expect(domainResult.rules[0]?.action).toEqual('block')
    })
  })

  describe('syncSource', () => {
    const source = 'sourceA/'
    const overlapUrl = 'source-overlap.example.test'
    const replacementUrl = 'source-replacement.example.test/photo.jpg'
    const syncHeaders = () => getAdminHeaders(ids.ToolsOzoneSafelinkSyncSource)

    it('rejects duplicate keys without changing stored rules', async () => {
      const source = 'sourceA/duplicates'
      const url = 'source-duplicate.example.test/photo.jpg'
      const existing = { url, pattern: 'url', action: 'block', reason: 'spam' }
      await adminAgent.tools.ozone.safelink.syncSource(
        { source, rules: [existing] },
        await syncHeaders(),
      )

      await expect(
        adminAgent.tools.ozone.safelink.syncSource(
          {
            source,
            rules: [
              { ...existing, action: 'warn' },
              { ...existing, action: 'whitelist', reason: 'none' },
            ],
          },
          await syncHeaders(),
        ),
      ).rejects.toMatchObject({
        status: 400,
        error: 'InvalidRequest',
        message: 'Duplicate URL rule in source snapshot',
      })

      const { data: rules } = await adminAgent.tools.ozone.safelink.queryRules(
        { urls: [url] },
        await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
      )
      expect(rules.rules).toEqual([expect.objectContaining({ source, ...existing })])

      const { data: events } =
        await adminAgent.tools.ozone.safelink.queryEvents(
          { urls: [url] },
          await getAdminHeaders(ids.ToolsOzoneSafelinkQueryEvents),
        )
      expect(events.events).toEqual([
        expect.objectContaining({ source, url, eventType: 'addRule' }),
      ])
    })

    it('rejects triage role from replacing a source', async () => {
      await expect(
        triageAgent.tools.ozone.safelink.syncSource(
          { source, rules: [] },
          {
            headers: await network.ozone.modHeaders(
              ids.ToolsOzoneSafelinkSyncSource,
              'triage',
            ),
          },
        ),
      ).rejects.toThrow('Must be a moderator to sync URL rules')
    })

    it('keeps an existing rule when another source syncs the same key', async () => {
      await adminAgent.tools.ozone.safelink.addRule(
        {
          url: overlapUrl,
          pattern: 'domain',
          action: 'whitelist',
          reason: 'none',
        },
        await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
      )

      const listed = {
        url: overlapUrl,
        pattern: 'domain',
        action: 'block',
        reason: 'csam',
      }
      const first = await adminAgent.tools.ozone.safelink.syncSource(
        { source, rules: [listed] },
        await syncHeaders(),
      )
      expect(first.data).toEqual({
        added: 0,
        updated: 0,
        removed: 0,
        events: 0,
      })

      const second = await adminAgent.tools.ozone.safelink.syncSource(
        { source, rules: [listed] },
        await syncHeaders(),
      )
      expect(second.data).toEqual({
        added: 0,
        updated: 0,
        removed: 0,
        events: 0,
      })

      const { data: manual } = await adminAgent.tools.ozone.safelink.queryRules(
        { urls: [overlapUrl] },
        await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
      )
      expect(manual.rules[0]).toMatchObject({
        source: 'ozone/default',
        action: 'whitelist',
        reason: 'none',
      })

      const changed = await adminAgent.tools.ozone.safelink.syncSource(
        {
          source,
          rules: [
            listed,
            {
              url: replacementUrl,
              pattern: 'url',
              action: 'block',
              reason: 'csam',
            },
          ],
        },
        await syncHeaders(),
      )
      expect(changed.data).toEqual({
        added: 1,
        updated: 0,
        removed: 0,
        events: 1,
      })

      const { data: restored } =
        await adminAgent.tools.ozone.safelink.queryRules(
          { urls: [overlapUrl, replacementUrl] },
          await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
        )
      expect(restored.rules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            url: overlapUrl,
            source: 'ozone/default',
            action: 'whitelist',
          }),
          expect.objectContaining({
            url: replacementUrl,
            source,
            action: 'block',
          }),
        ]),
      )

      const cleared = await adminAgent.tools.ozone.safelink.syncSource(
        { source, rules: [] },
        await syncHeaders(),
      )
      expect(cleared.data).toEqual({
        added: 0,
        updated: 0,
        removed: 1,
        events: 1,
      })

      await adminAgent.tools.ozone.safelink.removeRule(
        { url: overlapUrl, pattern: 'domain' },
        await getAdminHeaders(ids.ToolsOzoneSafelinkRemoveRule),
      )
      const restoredFeed = await adminAgent.tools.ozone.safelink.syncSource(
        { source, rules: [listed] },
        await syncHeaders(),
      )
      expect(restoredFeed.data).toEqual({
        added: 1,
        updated: 0,
        removed: 0,
        events: 1,
      })
    })

    it('rejects an add from another source at an existing key', async () => {
      const url = 'source-existing.example.test/photo.jpg'
      await adminAgent.tools.ozone.safelink.syncSource(
        {
          source,
          rules: [{ url, pattern: 'url', action: 'block', reason: 'csam' }],
        },
        await syncHeaders(),
      )

      await expect(
        adminAgent.tools.ozone.safelink.addRule(
          {
            url,
            pattern: 'url',
            action: 'whitelist',
            reason: 'none',
          },
          await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
        ),
      ).rejects.toThrow('A rule for this URL/domain already exists')

      const { data: active } = await adminAgent.tools.ozone.safelink.queryRules(
        { urls: [url] },
        await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
      )
      expect(active.rules).toHaveLength(1)
      expect(active.rules[0]).toMatchObject({ source, action: 'block' })
    })

    it('keeps a manual full URL alongside a scheme-less feed rule', async () => {
      const feedUrl = 'source-manual-priority.example.test/photo.jpg'
      const manualUrl = `https://${feedUrl}`
      const listed = {
        url: feedUrl,
        pattern: 'url',
        action: 'block',
        reason: 'csam',
      }
      await adminAgent.tools.ozone.safelink.syncSource(
        { source, rules: [listed] },
        await syncHeaders(),
      )

      const { data: manualEvent } =
        await adminAgent.tools.ozone.safelink.addRule(
          {
            url: manualUrl,
            pattern: 'url',
            action: 'whitelist',
            reason: 'none',
          },
          await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
        )
      expect(manualEvent.eventType).toBe('addRule')
      expect(manualEvent.source).toBe('ozone/default')

      const retried = await adminAgent.tools.ozone.safelink.syncSource(
        { source, rules: [listed] },
        await syncHeaders(),
      )
      expect(retried.data.events).toBe(0)

      const { data: active } = await adminAgent.tools.ozone.safelink.queryRules(
        { urls: [manualUrl, feedUrl] },
        await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
      )
      expect(active.rules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            url: manualUrl,
            source: 'ozone/default',
            action: 'whitelist',
          }),
          expect.objectContaining({
            url: feedUrl,
            source,
            action: 'block',
          }),
        ]),
      )
      expect(active.rules).toHaveLength(2)
    })

    it('keeps scheme variants separate during source replacement', async () => {
      const variantSource = 'sourceA/scheme-variants'
      const httpsRule = {
        url: 'https://duplicate.example.test/Image.jpg',
        pattern: 'url' as const,
        action: 'block' as const,
        reason: 'csam' as const,
      }
      const httpRule = {
        ...httpsRule,
        url: 'http://DUPLICATE.EXAMPLE.TEST/Image.jpg',
        action: 'warn' as const,
        reason: 'phishing' as const,
      }
      const first = await adminAgent.tools.ozone.safelink.syncSource(
        { source: variantSource, rules: [httpsRule, httpRule] },
        await syncHeaders(),
      )
      expect(first.data).toEqual({
        added: 2,
        updated: 0,
        removed: 0,
        events: 2,
      })

      const rows = await network.ozone.ctx.db.db
        .selectFrom('safelink_rule')
        .select(['url', 'action'])
        .where('source', '=', variantSource)
        .execute()
      expect(rows).toEqual(
        expect.arrayContaining([
          { url: httpsRule.url, action: 'block' },
          { url: httpRule.url, action: 'warn' },
        ]),
      )
      expect(rows).toHaveLength(2)

      const second = await adminAgent.tools.ozone.safelink.syncSource(
        { source: variantSource, rules: [httpsRule] },
        await syncHeaders(),
      )
      expect(second.data).toEqual({
        added: 0,
        updated: 0,
        removed: 1,
        events: 1,
      })
    })

    it('preserves submitted URL and domain strings across source syncs', async () => {
      const source = 'sourceA/raw-urls'
      const rules = [
        {
          url: 'MiXeD.example.test/Image.jpg?Token=A',
          pattern: 'url',
          action: 'block',
          reason: 'phishing',
        },
        {
          url: 'DoMaIn.example.test',
          pattern: 'domain',
          action: 'block',
          reason: 'phishing',
        },
      ] as const

      const first = await adminAgent.tools.ozone.safelink.syncSource(
        { source, rules: [...rules] },
        await syncHeaders(),
      )
      expect(first.data.added).toBe(rules.length)

      const { data: stored } = await adminAgent.tools.ozone.safelink.queryRules(
        { urls: rules.map((rule) => rule.url) },
        await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
      )
      expect(stored.rules).toEqual(
        expect.arrayContaining(
          rules.map((rule) =>
            expect.objectContaining({ url: rule.url, pattern: rule.pattern }),
          ),
        ),
      )

      const retried = await adminAgent.tools.ozone.safelink.syncSource(
        { source, rules: [...rules] },
        await syncHeaders(),
      )
      expect(retried.data.events).toBe(0)
    })

    it('reconciles changes in a larger source snapshot', async () => {
      const batchSource = 'sourceA/batch'
      const rules = Array.from({ length: 251 }, (_, index) => ({
        url: `batch.example.test/file-${index}.jpg`,
        pattern: 'url' as const,
        action: 'block' as const,
        reason: 'phishing' as const,
      }))
      const first = await adminAgent.tools.ozone.safelink.syncSource(
        { source: batchSource, rules },
        await syncHeaders(),
      )
      expect(first.data).toEqual({
        added: 251,
        updated: 0,
        removed: 0,
        events: 251,
      })

      const nextRules = rules
        .slice(1)
        .map((rule, index) =>
          index === 0 ? { ...rule, action: 'warn' as const } : rule,
        )
      const second = await adminAgent.tools.ozone.safelink.syncSource(
        { source: batchSource, rules: nextRules },
        await syncHeaders(),
      )
      expect(second.data).toEqual({
        added: 0,
        updated: 1,
        removed: 1,
        events: 2,
      })

      const retried = await adminAgent.tools.ozone.safelink.syncSource(
        { source: batchSource, rules: nextRules },
        await syncHeaders(),
      )
      expect(retried.data.events).toBe(0)
    })

    it('preserves path and query case in URL rule keys', async () => {
      const source = 'sourceA/case'
      const urls = [
        'case.example.test/Image.jpg?Token=A',
        'case.example.test/image.jpg?Token=A',
        'case.example.test/Image.jpg?Token=a',
      ]
      const { data } = await adminAgent.tools.ozone.safelink.syncSource(
        {
          source,
          rules: urls.map((url) => ({
            url,
            pattern: 'url',
            action: 'block',
            reason: 'phishing',
          })),
        },
        await syncHeaders(),
      )
      expect(data.added).toBe(urls.length)

      for (const url of urls) {
        const { data: queried } =
          await adminAgent.tools.ozone.safelink.queryRules(
            { urls: [url] },
            await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
          )
        expect(queried.rules.map((rule) => rule.url)).toEqual([url])
      }
    })

    it('updates a stored feed rule and emits only effective changes', async () => {
      const url = 'source-update.example.test/image.jpg'
      const initial = { url, pattern: 'url', action: 'block', reason: 'csam' }
      await adminAgent.tools.ozone.safelink.syncSource(
        { source, rules: [initial] },
        await syncHeaders(),
      )

      const changed = await adminAgent.tools.ozone.safelink.syncSource(
        {
          source,
          rules: [{ ...initial, action: 'warn', reason: 'spam' }],
        },
        await syncHeaders(),
      )
      expect(changed.data).toEqual({
        added: 0,
        updated: 1,
        removed: 0,
        events: 1,
      })

      const retried = await adminAgent.tools.ozone.safelink.syncSource(
        {
          source,
          rules: [{ ...initial, action: 'warn', reason: 'spam' }],
        },
        await syncHeaders(),
      )
      expect(retried.data.events).toBe(0)
    })

    it('accepts existing scheme-qualified ozone/default rules', async () => {
      const rows = await network.ozone.ctx.db.db
        .selectFrom('safelink_rule')
        .select(['url', 'pattern', 'action', 'reason'])
        .where('source', '=', 'ozone/default')
        .execute()
      expect(rows.some((row) => row.url.startsWith('https://'))).toBe(true)

      const result = await adminAgent.tools.ozone.safelink.syncSource(
        { source: 'ozone/default', rules: rows },
        await syncHeaders(),
      )
      expect(result.data).toEqual({
        added: 0,
        updated: 0,
        removed: 0,
        events: 0,
      })

      const target = rows.find(
        (row) => row.pattern === 'url' && row.url.startsWith('https://'),
      )
      expect(target).toBeDefined()
      const changed = await adminAgent.tools.ozone.safelink.syncSource(
        {
          source: 'ozone/default',
          rules: rows.map((row) =>
            row === target
              ? { ...row, action: 'block', reason: 'phishing' }
              : row,
          ),
        },
        await syncHeaders(),
      )
      expect(changed.data).toEqual({
        added: 0,
        updated: 1,
        removed: 0,
        events: 1,
      })
    })

    it('filters source rules and events by stored URL', async () => {
      const url = 'source-filter.example.test/image.jpg'
      await adminAgent.tools.ozone.safelink.syncSource(
        {
          source,
          rules: [{ url, pattern: 'url', action: 'block', reason: 'csam' }],
        },
        await syncHeaders(),
      )

      const { data: rules } = await adminAgent.tools.ozone.safelink.queryRules(
        { urls: [url] },
        await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
      )
      expect(rules.rules).toEqual([
        expect.objectContaining({ url, source, action: 'block' }),
      ])

      const { data: events } =
        await adminAgent.tools.ozone.safelink.queryEvents(
          { urls: [url] },
          await getAdminHeaders(ids.ToolsOzoneSafelinkQueryEvents),
        )
      expect(events.events).toEqual([
        expect.objectContaining({
          url,
          source,
          eventType: 'addRule',
        }),
      ])
    })

    it('keeps a final slash distinct for URL rules', async () => {
      const withSlash = 'slash.example.test/album/'
      const withoutSlash = 'slash.example.test/album'
      const source = 'sourceA/slash'
      const rules = [withSlash, withoutSlash].map((url) => ({
        url,
        pattern: 'url' as const,
        action: 'block' as const,
        reason: 'phishing' as const,
      }))
      const { data } = await adminAgent.tools.ozone.safelink.syncSource(
        { source, rules },
        await syncHeaders(),
      )
      expect(data.added).toBe(2)

      const { data: withSlashResult } =
        await adminAgent.tools.ozone.safelink.queryRules(
          { urls: [withSlash] },
          await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
        )
      expect(withSlashResult.rules.map((rule) => rule.url)).toEqual([withSlash])

      const { data: withoutSlashResult } =
        await adminAgent.tools.ozone.safelink.queryRules(
          { urls: [withoutSlash] },
          await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
        )
      expect(withoutSlashResult.rules.map((rule) => rule.url)).toEqual([
        withoutSlash,
      ])
    })

    it('allows moderators to manage rules and synchronize a source', async () => {
      const url = 'https://moderator-access.example.test/photo.jpg'
      const headers = async (route: string) => ({
        headers: await network.ozone.modHeaders(route, 'moderator'),
      })

      const added = await modAgent.tools.ozone.safelink.addRule(
        { url, pattern: 'url', action: 'block', reason: 'spam' },
        await headers(ids.ToolsOzoneSafelinkAddRule),
      )
      expect(added.data.eventType).toBe('addRule')

      const updated = await modAgent.tools.ozone.safelink.updateRule(
        { url, pattern: 'url', action: 'warn', reason: 'spam' },
        await headers(ids.ToolsOzoneSafelinkUpdateRule),
      )
      expect(updated.data.eventType).toBe('updateRule')

      const removed = await modAgent.tools.ozone.safelink.removeRule(
        { url, pattern: 'url' },
        await headers(ids.ToolsOzoneSafelinkRemoveRule),
      )
      expect(removed.data.eventType).toBe('removeRule')

      const synced = await modAgent.tools.ozone.safelink.syncSource(
        {
          source: 'sourceA/moderator',
          rules: [
            {
              url: 'moderator-source.example.test/file.jpg',
              pattern: 'url',
              action: 'block',
              reason: 'phishing',
            },
          ],
        },
        await headers(ids.ToolsOzoneSafelinkSyncSource),
      )
      expect(synced.data).toMatchObject({ added: 1, events: 1 })
    })

    it('updates an existing rule from the same source', async () => {
      const url = 'source-update-through-add.example.test/photo.jpg'
      const initial = { url, pattern: 'url', action: 'block', reason: 'csam' }
      await adminAgent.tools.ozone.safelink.addRule(
        initial,
        await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
      )

      const { data: event } = await adminAgent.tools.ozone.safelink.addRule(
        { ...initial, action: 'warn', reason: 'spam' },
        await getAdminHeaders(ids.ToolsOzoneSafelinkAddRule),
      )
      expect(event.eventType).toBe('updateRule')

      const { data: active } = await adminAgent.tools.ozone.safelink.queryRules(
        { urls: [url] },
        await getAdminHeaders(ids.ToolsOzoneSafelinkQueryRules),
      )
      expect(active.rules).toHaveLength(1)
      expect(active.rules[0]).toMatchObject({
        source: 'ozone/default',
        action: 'warn',
        reason: 'spam',
      })
    })
  })
})
