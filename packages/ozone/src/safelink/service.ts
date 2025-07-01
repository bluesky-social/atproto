import { Selectable } from 'kysely'
import { ToolsOzoneSafelinkDefs } from '@atproto/api'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Database } from '../db'
import { TimeIdKeyset, paginate } from '../db/pagination'
import {
  SafelinkActionType,
  SafelinkEvent,
  SafelinkPatternType,
  SafelinkReasonType,
} from '../db/schema/safelink'

export type SafelinkRuleServiceCreator = (db: Database) => SafelinkRuleService

export class SafelinkRuleService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new SafelinkRuleService(db)
  }

  formatEvent(event: Selectable<SafelinkEvent>): ToolsOzoneSafelinkDefs.Event {
    return {
      id: event.id,
      eventType: event.eventType,
      url: event.url,
      pattern: event.pattern,
      action: event.action,
      reason: event.reason,
      createdBy: event.createdBy,
      createdAt: new Date(event.createdAt).toISOString(),
      comment: event.comment || undefined,
    }
  }

  async addRule({
    url,
    pattern,
    action,
    reason,
    createdBy,
    comment,
  }: {
    url: string
    pattern: SafelinkPatternType
    action: SafelinkActionType
    reason: SafelinkReasonType
    createdBy: string
    comment?: string
  }): Promise<Selectable<SafelinkEvent>> {
    const existingRule = await this.getActiveRule(url, pattern)
    if (existingRule) {
      throw new InvalidRequestError(
        'A rule for this URL/domain already exists',
        'RuleAlreadyExists',
      )
    }

    const rule = {
      url,
      pattern,
      action,
      reason,
      createdBy,
      comment: comment || null,
      createdAt: new Date().toISOString(),
    }

    return await this.db.transaction(async (txn) => {
      const event = await txn.db
        .insertInto('safelink_event')
        .values({
          eventType: 'tools.ozone.safelink.defs#addRule',
          ...rule,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      await txn.db.insertInto('safelink_rule').values(rule).execute()

      return event
    })
  }

  async updateRule({
    url,
    pattern,
    action,
    reason,
    createdBy,
    comment,
  }: {
    url: string
    pattern: SafelinkPatternType
    action: SafelinkActionType
    reason: SafelinkReasonType
    createdBy: string
    comment?: string
  }): Promise<Selectable<SafelinkEvent>> {
    const existingRule = await this.getActiveRule(url, pattern)
    if (!existingRule) {
      throw new InvalidRequestError(
        'No active rule found for this URL/domain',
        'RuleNotFound',
      )
    }

    const now = new Date().toISOString()
    const rule = {
      pattern,
      action,
      reason,
      createdBy,
      comment: comment || null,
    }

    return await this.db.transaction(async (txn) => {
      const event = await txn.db
        .insertInto('safelink_event')
        .values({
          url,
          createdAt: now,
          eventType: 'tools.ozone.safelink.defs#updateRule',
          ...rule,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      await txn.db
        .updateTable('safelink_rule')
        .set(rule)
        .where('url', '=', url)
        .where('pattern', '=', pattern)
        .execute()

      return event
    })
  }

  async removeRule({
    url,
    pattern,
    createdBy,
    comment,
  }: {
    url: string
    pattern: SafelinkPatternType
    createdBy: string
    comment?: string
  }): Promise<Selectable<SafelinkEvent>> {
    const existingRule = await this.getActiveRule(url, pattern)
    if (!existingRule) {
      throw new InvalidRequestError(
        'No active rule found for this URL/domain',
        'RuleNotFound',
      )
    }

    return await this.db.transaction(async (txn) => {
      const event = await txn.db
        .insertInto('safelink_event')
        .values({
          eventType: 'tools.ozone.safelink.defs#removeRule',
          url,
          pattern,
          action: existingRule.action,
          reason: existingRule.reason,
          createdBy,
          comment: comment || null,
          createdAt: new Date().toISOString(),
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      await txn.db
        .deleteFrom('safelink_rule')
        .where('url', '=', url)
        .where('pattern', '=', pattern)
        .execute()

      return event
    })
  }

  async getActiveRule(url: string, pattern: SafelinkPatternType) {
    const rule = await this.db.db
      .selectFrom('safelink_rule')
      .selectAll()
      .where('url', '=', url)
      .where('pattern', '=', pattern)
      .executeTakeFirst()

    if (!rule) {
      return null
    }

    return rule
  }

  async getActiveRules({
    cursor,
    limit = 50,
    urls,
    domains,
    actions,
    reason,
    createdBy,
    direction = 'desc',
  }: {
    cursor?: string
    limit?: number
    urls?: string[]
    domains?: string[]
    actions?: SafelinkActionType[]
    reason?: SafelinkReasonType
    createdBy?: string
    direction?: 'asc' | 'desc'
  } = {}) {
    let query = this.db.db.selectFrom('safelink_rule').selectAll()

    if (urls && urls.length > 0) {
      query = query.where('url', 'in', urls)
    }
    if (domains && domains.length > 0) {
      query = query.where((eb) => {
        domains.map((d) => (eb = eb.orWhere('url', 'like', `%${d}%`)))
        return eb
      })
    }
    if (actions && actions.length > 0) {
      query = query.where('action', 'in', actions)
    }
    if (reason) {
      query = query.where('reason', '=', reason)
    }
    if (createdBy) {
      query = query.where('createdBy', '=', createdBy)
    }

    const { ref } = this.db.db.dynamic
    const keyset = new TimeIdKeyset(ref('createdAt'), ref('id'))

    const paginatedBuilder = paginate(query, {
      limit,
      cursor,
      keyset,
      direction,
    })

    const rules = await paginatedBuilder.execute()
    return {
      rules,
      cursor: keyset.packFromResult(rules),
    }
  }

  async queryEvents({
    cursor,
    limit = 50,
    urls,
    domains,
  }: {
    cursor?: string
    limit?: number
    urls?: string[]
    domains?: string[]
  } = {}): Promise<{
    events: Selectable<SafelinkEvent>[]
    cursor?: string
  }> {
    const { ref } = this.db.db.dynamic
    let query = this.db.db.selectFrom('safelink_event').selectAll()

    if (urls && urls.length > 0) {
      query = query.where('url', 'in', urls)
    }
    if (domains && domains.length > 0) {
      query = query.where((eb) => {
        domains.map((d) => (eb = eb.orWhere('url', 'like', `%${d}%`)))
        return eb
      })
    }

    const keyset = new TimeIdKeyset(ref('createdAt'), ref('id'))
    const paginatedBuilder = paginate(query, {
      limit,
      cursor,
      keyset,
      direction: 'desc',
    })

    const events = await paginatedBuilder.execute()

    return {
      events,
      cursor: keyset.packFromResult(events),
    }
  }
}
