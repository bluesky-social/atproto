import { Selectable } from 'kysely'
import { ToolsOzoneSafelinkDefs } from '@atproto/api'
import { InvalidRequestError } from '@atproto/xrpc-server'
import {
  SafelinkActionType,
  SafelinkPatternType,
  SafelinkReasonType,
} from '../api/util'
import { Database } from '../db'
import { SafelinkEvent, SafelinkRule } from '../db/schema/safelink'

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

    const now = new Date().toISOString()
    const rule = {
      url,
      pattern,
      action,
      reason,
      createdBy,
      comment: comment || null,
      createdAt: now,
    }

    return await this.db.transaction(async (txn) => {
      const event = await txn.db
        .insertInto('safelink_event')
        .values({
          eventType: 'addRule',
          ...rule,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      await txn.db
        .insertInto('safelink_rule')
        .values({ ...rule, updatedAt: now })
        .execute()

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
      action,
      reason,
      createdBy,
      comment: comment || null,
    }

    return await this.db.transaction(async (txn) => {
      const event = await txn.db
        .insertInto('safelink_event')
        .values({
          createdAt: now,
          url: existingRule.url,
          pattern: existingRule.pattern,
          eventType: 'updateRule',
          ...rule,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      await txn.db
        .updateTable('safelink_rule')
        .set(rule)
        .where('url', '=', existingRule.url)
        .where('pattern', '=', existingRule.pattern)
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
          eventType: 'removeRule',
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
    patternType,
    actions,
    reason,
    createdBy,
    direction = 'desc',
  }: {
    cursor?: string
    limit?: number
    urls?: string[]
    patternType?: SafelinkPatternType
    actions?: SafelinkActionType[]
    reason?: SafelinkReasonType
    createdBy?: string
    direction?: 'asc' | 'desc'
  } = {}): Promise<{
    rules: Selectable<SafelinkRule>[]
    cursor?: string
  }> {
    let query = this.db.db.selectFrom('safelink_rule').selectAll()

    if (urls && urls.length > 0) {
      query = query.where('url', 'in', urls)
    }

    if (patternType) {
      query = query.where('pattern', '=', patternType)
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

    if (cursor) {
      query = query.where(
        'id',
        direction === 'asc' ? '>' : '<',
        parseInt(cursor, 10),
      )
    }

    const rules = await query.orderBy('id', direction).limit(limit).execute()

    return {
      rules,
      cursor: rules.at(-1)?.id?.toString(),
    }
  }

  async queryEvents({
    cursor,
    limit = 50,
    urls,
    patternType,
    direction = 'desc',
  }: {
    cursor?: string
    limit?: number
    urls?: string[]
    patternType?: SafelinkPatternType
    direction?: 'asc' | 'desc'
  } = {}): Promise<{
    events: Selectable<SafelinkEvent>[]
    cursor?: string
  }> {
    let query = this.db.db.selectFrom('safelink_event').selectAll()

    if (urls && urls.length > 0) {
      query = query.where('url', 'in', urls)
    }

    if (patternType) {
      query = query.where('pattern', '=', patternType)
    }

    if (cursor) {
      query = query.where(
        'id',
        direction === 'asc' ? '>' : '<',
        parseInt(cursor, 10),
      )
    }

    const events = await query.orderBy('id', direction).limit(limit).execute()

    return {
      events,
      cursor: events.at(-1)?.id?.toString(),
    }
  }
}
