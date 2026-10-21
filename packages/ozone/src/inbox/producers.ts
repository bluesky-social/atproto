import { sql } from 'kysely'
import type { DatetimeString, DidString } from '@atproto/lex'
import type { StrikeSuspensionConfig } from '../config/strike-suspension.js'
import type { Database } from '../db/index.js'
import { com, tools } from '../lexicons/index.js'
import type { ModSubject } from '../mod-service/subject.js'
import type { ModEventType, ModerationEventRow } from '../mod-service/types.js'
import { publicActionType } from './action.js'
import {
  PUBLIC_EVENT_ACTIONS,
  REVERSE_TAKEDOWN,
  eventSubjectFilter,
} from './appeal.js'
import { runNotificationWork } from './notification-work.js'
import {
  type NotificationInput,
  createInboxNotifications,
} from './notifications.js'
import { type Standing, getAccountStanding } from './standing.js'
import { inboxHasStarted } from './start.js'

/** Transaction-scoped producers shared by HTTP handlers and daemon jobs. */
export class InboxNotificationService {
  constructor(
    private db: Database,
    private config: StrikeSuspensionConfig,
    private startAt?: DatetimeString,
  ) {}

  async captureStanding(did: DidString): Promise<Standing | undefined> {
    if (!inboxHasStarted(this.startAt)) return undefined
    return runNotificationWork(this.db, async (txn) => {
      // @NOTE Serialize this account's strike/status transitions across writers.
      await sql`select pg_advisory_xact_lock(hashtextextended(${did}, 1))`.execute(
        txn.db,
      )
      return (await getAccountStanding(txn, did, this.config)).standing
    })
  }

  async beforeModerationEvent(
    subject: ModSubject,
    event: ModEventType,
  ): Promise<Standing | undefined> {
    if (!(subject.isRepo() || subject.isRecord())) return undefined
    const defs = tools.ozone.moderation.defs
    const affectsStanding =
      defs.modEventTakedown.$isTypeOf(event) ||
      defs.modEventReverseTakedown.$isTypeOf(event) ||
      (defs.modEventEmail.$isTypeOf(event) &&
        event.strikeCount !== undefined) ||
      (subject.isRepo() &&
        (defs.modEventMute.$isTypeOf(event) ||
          defs.modEventUnmute.$isTypeOf(event) ||
          defs.modEventMuteReporter.$isTypeOf(event) ||
          defs.modEventUnmuteReporter.$isTypeOf(event)))
    return affectsStanding ? this.captureStanding(subject.did) : undefined
  }

  async notifyModerationEvent(
    subject: ModSubject,
    event: ModerationEventRow,
    previousStanding?: Standing,
  ): Promise<void> {
    if (!(subject.isRepo() || subject.isRecord())) return
    if (!inboxHasStarted(this.startAt)) return
    if (this.startAt && event.createdAt < this.startAt) return
    const reversed =
      event.action === tools.ozone.moderation.defs.modEventReverseTakedown.$type
    const actionType = reversed
      ? subject.isRepo()
        ? 'accountRestored'
        : 'contentRestored'
      : publicActionType(event)
    if (!actionType && previousStanding === undefined) return
    await runNotificationWork(this.db, async (txn) => {
      const notifications: NotificationInput[] = []
      const visibleSubject =
        !reversed ||
        !this.startAt ||
        !!(await txn.db
          .selectFrom('moderation_event')
          .where((eb) => eventSubjectFilter(eb, subject))
          .where('action', 'in', [...PUBLIC_EVENT_ACTIONS])
          .where('action', '!=', REVERSE_TAKEDOWN)
          .where('createdAt', '>=', this.startAt)
          .select('id')
          .limit(1)
          .executeTakeFirst())
      if (actionType && visibleSubject) {
        notifications.push({
          recipientDid: subject.did,
          reason:
            reversed || actionType === 'labelRemoved'
              ? 'actionReversed'
              : 'actionTaken',
          target: {
            $type: 'tools.ozone.inbox.defs#subjectRef',
            subject: subject.isRecord()
              ? com.atproto.repo.strongRef.$build({
                  uri: subject.uri,
                  cid: subject.cid,
                })
              : com.atproto.admin.defs.repoRef.$build({ did: subject.did }),
            actionType,
            actionId: event.id,
          },
          sourceKey: `moderation-event:${event.id}:action`,
          createdAt: event.createdAt,
        })
      }
      if (previousStanding !== undefined) {
        const standing = (
          await getAccountStanding(txn, subject.did, this.config)
        ).standing
        if (standing !== previousStanding)
          notifications.push(
            standingNotification(
              subject.did,
              standing,
              previousStanding,
              `moderation-event:${event.id}:standing`,
              event.createdAt,
            ),
          )
      }
      await createInboxNotifications(txn, notifications, this.startAt)
    })
  }

  async notifyStandingChange(
    did: DidString,
    previousStanding: Standing | undefined,
    sourceKey: string,
    createdAt: DatetimeString,
  ): Promise<void> {
    if (previousStanding === undefined) return
    if (!inboxHasStarted(this.startAt)) return
    if (this.startAt && createdAt < this.startAt) return
    await runNotificationWork(this.db, async (txn) => {
      const standing = (await getAccountStanding(txn, did, this.config))
        .standing
      if (standing !== previousStanding)
        await createInboxNotifications(
          txn,
          [
            standingNotification(
              did,
              standing,
              previousStanding,
              sourceKey,
              createdAt,
            ),
          ],
          this.startAt,
        )
    })
  }
}

function standingNotification(
  recipientDid: DidString,
  standing: Standing,
  previousStanding: Standing,
  sourceKey: string,
  createdAt: DatetimeString,
): NotificationInput {
  return {
    recipientDid,
    reason: 'standingChanged',
    target: {
      $type: 'tools.ozone.inbox.defs#standingRef',
      standing,
      previousStanding,
    },
    sourceKey,
    createdAt,
  }
}
