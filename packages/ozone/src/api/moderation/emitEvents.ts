import { chunkArray } from '@atproto/common'
import { XRPCError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { ModEventView } from '../../lexicon/types/tools/ozone/moderation/defs'
import { OutputSchema } from '../../lexicon/types/tools/ozone/moderation/emitEvents'
import { httpLogger } from '../../logger'
import { subjectFromInput } from '../../mod-service/subject'
import {
  handleModerationEvent,
  validateEventAuth,
  validateSubjectForEvent,
  validateSubjects,
} from './util-event'
import { ToolsOzoneModerationEmitEvents } from '@atproto/api'

const CHUNK_SIZE = 10

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.emitEvents({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const { event, subjects, createdBy, modTool } = input.body
      const events: ModEventView[] = []
      const failedEvents: ToolsOzoneModerationEmitEvents.FailedEvent[] = []

      validateSubjects(subjects)
      await validateEventAuth({ event, auth, ctx })

      for (const chunk of chunkArray(subjects, CHUNK_SIZE)) {
        const results = await Promise.allSettled(
          chunk.map(async (entry) => {
            const subject = subjectFromInput(
              entry.subject,
              entry.subjectBlobCids,
            )
            validateSubjectForEvent({ event, subject, auth })
            const moderationEvent = await handleModerationEvent({
              auth,
              ctx,
              input: {
                event,
                subject: entry.subject,
                subjectBlobCids: entry.subjectBlobCids,
                createdBy,
                modTool,
              },
            })

            return { moderationEvent, subject }
          }),
        )

        for (const settled of results) {
          if (settled.status === 'fulfilled') {
            events.push(settled.value.moderationEvent)
          } else {
            const idx = results.indexOf(settled)
            const subject = chunk[idx]
            httpLogger.error(
              { err: settled.reason, subject },
              'failed to emit bulk moderation event',
            )
            const errorMessage =
              settled.reason instanceof Error
                ? settled.reason.message
                : String(settled.reason)
            const errorName =
              settled.reason instanceof XRPCError
                ? settled.reason.customErrorName
                : undefined
            failedEvents.push({
              error: errorMessage,
              errorName: errorName,
              subject: subject.subject,
            })
          }
        }
      }

      return {
        encoding: 'application/json' as const,
        body: { events, failedEvents },
      }
    },
  })
}
