import { type Selectable, sql } from 'kysely'
import { currentDatetimeString, toDatetimeString } from '@atproto/lex'
import type { DidString } from '@atproto/lex'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type {
  SafelinkActionType,
  SafelinkPatternType,
  SafelinkReasonType,
} from '../api/util.js'
import type { Database } from '../db/index.js'
import type { SafelinkEvent, SafelinkRule } from '../db/schema/safelink.js'
import type { tools } from '../lexicons/index.js'

async function lockSafelinkWrites(db: Database): Promise<void> {
  db.assertTransaction()
  await sql`select pg_advisory_xact_lock(87213, 1)`.execute(db.db)
}

export type SourceRuleInput = {
  url: string
  pattern: SafelinkPatternType
  action: SafelinkActionType
  reason: SafelinkReasonType
}

type SyncResult = {
  added: number
  updated: number
  removed: number
  events: number
}

export type SafelinkRuleServiceCreator = (db: Database) => SafelinkRuleService

export class SafelinkRuleService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new SafelinkRuleService(db)
  }

  /** Replace the stored rules owned by one source with a complete snapshot. */
  async syncSource(
    source: string,
    rules: SourceRuleInput[],
    createdBy: DidString,
  ): Promise<SyncResult> {
    const serializedRules = JSON.stringify(rules)

    return this.db.transaction(async (txn) => {
      await lockSafelinkWrites(txn)

      // create staging table for the sync operation
      await sql`
        create temporary table safelink_sync_input (
          url varchar not null,
          pattern varchar not null,
          action varchar not null,
          reason varchar not null,
          primary key (url, pattern)
        ) on commit drop
      `.execute(txn.db)
      await sql`
        insert into safelink_sync_input (url, pattern, action, reason)
        select url, pattern, action, reason
        from jsonb_to_recordset(${serializedRules}::jsonb)
          as rule(url varchar, pattern varchar, action varchar, reason varchar)
      `.execute(txn.db)
      await sql`analyze safelink_sync_input`.execute(txn.db)

      const now = currentDatetimeString()

      // update existing rules
      const updated = await sql<{ count: number }>`
        with changed as (
          update safelink_rule as current
          set action = incoming.action,
              reason = incoming.reason,
              "createdBy" = ${createdBy},
              "updatedAt" = ${now}
          from safelink_sync_input as incoming
          where current.url = incoming.url
            and current.pattern = incoming.pattern
            and current.source = ${source}
            and (current.action is distinct from incoming.action
              or current.reason is distinct from incoming.reason)
          returning current.*
        ), emitted as (
          insert into safelink_event
            ("eventType", url, pattern, action, reason, source,
             "createdBy", "createdAt", comment)
          select 'updateRule', url, pattern, action, reason, source,
                 "createdBy", ${now}, comment
          from changed
          returning id
        )
        select count(*)::integer as count from emitted
      `.execute(txn.db)

      // add new rules
      const added = await sql<{ count: number }>`
        with inserted as (
          insert into safelink_rule
            (url, pattern, action, reason, source, "createdBy",
             "createdAt", "updatedAt", comment)
          select url, pattern, action, reason, ${source}, ${createdBy},
                 ${now}, ${now}, null
          from safelink_sync_input
          where true
          on conflict (url, pattern) do nothing
          returning *
        ), emitted as (
          insert into safelink_event
            ("eventType", url, pattern, action, reason, source,
             "createdBy", "createdAt", comment)
          select 'addRule', url, pattern, action, reason, source,
                 "createdBy", ${now}, comment
          from inserted
          returning id
        )
        select count(*)::integer as count from emitted
      `.execute(txn.db)

      // remove rules that arent in input
      const removed = await sql<{ count: number }>`
        with deleted as (
          delete from safelink_rule as old
          where old.source = ${source}
            and not exists (
              select 1 from safelink_sync_input as incoming
              where incoming.url = old.url and incoming.pattern = old.pattern
            )
          returning old.*
        ), emitted as (
          insert into safelink_event
            ("eventType", url, pattern, action, reason, source,
             "createdBy", "createdAt", comment)
          select 'removeRule', url, pattern, action, reason, source,
                 ${createdBy}, ${now}, comment
          from deleted
          returning id
        )
        select count(*)::integer as count from emitted
      `.execute(txn.db)

      const result: SyncResult = {
        added: added.rows[0]?.count ?? 0,
        updated: updated.rows[0]?.count ?? 0,
        removed: removed.rows[0]?.count ?? 0,
        events: 0,
      }
      result.events = result.added + result.updated + result.removed
      return result
    })
  }

  formatEvent(
    event: Selectable<SafelinkEvent>,
  ): tools.ozone.safelink.defs.Event {
    return {
      id: event.id,
      eventType: event.eventType,
      url: event.url,
      pattern: event.pattern,
      action: event.action,
      reason: event.reason,
      source: event.source,
      createdBy: event.createdBy,
      createdAt: toDatetimeString(event.createdAt),
      comment: event.comment || undefined,
    }
  }

  async addRule({
    url,
    pattern,
    action,
    reason,
    source = 'ozone/default',
    createdBy,
    comment,
  }: {
    url: string
    pattern: SafelinkPatternType
    action: SafelinkActionType
    reason: SafelinkReasonType
    source?: string
    createdBy: DidString
    comment?: string
  }): Promise<Selectable<SafelinkEvent>> {
    const now = currentDatetimeString()
    const rule = {
      url,
      pattern,
      action,
      reason,
      source,
      createdBy,
      comment: comment || null,
      createdAt: now,
    }

    return await this.db.transaction(async (txn) => {
      await lockSafelinkWrites(txn)
      const existingRule = await txn.db
        .selectFrom('safelink_rule')
        .selectAll()
        .where('url', '=', url)
        .where('pattern', '=', pattern)
        .executeTakeFirst()
      if (existingRule && existingRule.source !== source) {
        throw new InvalidRequestError(
          'A rule for this URL/domain already exists',
          'RuleAlreadyExists',
        )
      }

      const event = await txn.db
        .insertInto('safelink_event')
        .values({
          eventType: existingRule ? 'updateRule' : 'addRule',
          ...rule,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      if (existingRule) {
        await txn.db
          .updateTable('safelink_rule')
          .set({
            action,
            reason,
            createdBy,
            comment: rule.comment,
            updatedAt: now,
          })
          .where('id', '=', existingRule.id)
          .execute()
      } else {
        await txn.db
          .insertInto('safelink_rule')
          .values({ ...rule, updatedAt: now })
          .execute()
      }

      return event
    })
  }

  async updateRule({
    url,
    pattern,
    action,
    reason,
    source = 'ozone/default',
    createdBy,
    comment,
  }: {
    url: string
    pattern: SafelinkPatternType
    action: SafelinkActionType
    reason: SafelinkReasonType
    source?: string
    createdBy: DidString
    comment?: string
  }): Promise<Selectable<SafelinkEvent>> {
    const now = currentDatetimeString()
    const rule = {
      action,
      reason,
      createdBy,
      comment: comment || null,
    }

    return await this.db.transaction(async (txn) => {
      await lockSafelinkWrites(txn)
      const existingRule = await txn.db
        .selectFrom('safelink_rule')
        .selectAll()
        .where('url', '=', url)
        .where('pattern', '=', pattern)
        .forUpdate()
        .executeTakeFirst()
      if (
        !existingRule ||
        (source !== undefined && existingRule.source !== source)
      ) {
        throw new InvalidRequestError(
          'No active rule found for this URL/domain',
          'RuleNotFound',
        )
      }
      const event = await txn.db
        .insertInto('safelink_event')
        .values({
          createdAt: now,
          url: existingRule.url,
          pattern: existingRule.pattern,
          eventType: 'updateRule',
          source: existingRule.source,
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
    source = 'ozone/default',
    createdBy,
    comment,
  }: {
    url: string
    pattern: SafelinkPatternType
    source?: string
    createdBy: DidString
    comment?: string
  }): Promise<Selectable<SafelinkEvent>> {
    return await this.db.transaction(async (txn) => {
      await lockSafelinkWrites(txn)
      const existingRule = await txn.db
        .selectFrom('safelink_rule')
        .selectAll()
        .where('url', '=', url)
        .where('pattern', '=', pattern)
        .forUpdate()
        .executeTakeFirst()
      if (
        !existingRule ||
        (source !== undefined && existingRule.source !== source)
      ) {
        throw new InvalidRequestError(
          'No active rule found for this URL/domain',
          'RuleNotFound',
        )
      }
      const event = await txn.db
        .insertInto('safelink_event')
        .values({
          eventType: 'removeRule',
          url,
          pattern,
          source: existingRule.source,
          action: existingRule.action,
          reason: existingRule.reason,
          createdBy,
          comment: comment || null,
          createdAt: currentDatetimeString(),
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
    createdBy?: DidString
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
