import { chunkArray } from '@atproto/common'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { ModEventView } from '../../lexicon/types/tools/ozone/moderation/defs'
import { InputSchema } from '../../lexicon/types/tools/ozone/moderation/emitEvents'
import { httpLogger } from '../../logger'
import { subjectFromInput } from '../../mod-service/subject'
import {
  handleModerationEvent,
  validateEventAuth,
  validateSubjectForEvent,
} from './util-event'

const CHUNK_SIZE = 10

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.emitEvents({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const { event, subjects, subjectBlobCids, createdBy, modTool } =
        input.body

      const events: ModEventView[] = []
      const failedEvents: {
        error: string
        subject: InputSchema['subjects'][0]
      }[] = []

      await validateEventAuth({ event, auth, ctx })

      for (const chunk of chunkArray(subjects, CHUNK_SIZE)) {
        const results = await Promise.allSettled(
          chunk.map(async (sub) => {
            const subject = subjectFromInput(sub, subjectBlobCids)
            validateSubjectForEvent({ event, subject, auth })
            const moderationEvent = await handleModerationEvent({
              auth,
              ctx,
              input: {
                event,
                subject: sub,
                subjectBlobCids,
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
            const errorMessage =
              settled.reason instanceof Error
                ? settled.reason.message
                : String(settled.reason)
            httpLogger.error(
              { err: settled.reason, subject },
              'failed to emit bulk moderation event',
            )
            failedEvents.push({
              error: errorMessage,
              subject,
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
