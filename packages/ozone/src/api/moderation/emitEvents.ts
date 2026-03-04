import { isModEventDivert } from '@atproto/api/dist/client/types/tools/ozone/moderation/defs'
import { chunkArray } from '@atproto/common'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { InputSchema } from '../../lexicon/types/tools/ozone/moderation/emitEvents'
import { ModEventView } from '../../lexicon/types/tools/ozone/moderation/defs'
import { HandlerInput } from '../../lexicon/types/tools/ozone/moderation/emitEvent'
import { httpLogger } from '../../logger'
import { handleModerationEvent } from './util-event'

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

      for (const chunk of chunkArray(subjects, CHUNK_SIZE)) {
        const results = await Promise.allSettled(
          chunk.map(async (subject) => {
            const input: HandlerInput = {
              encoding: 'application/json',
              body: {
                event,
                subject,
                subjectBlobCids,
                createdBy,
                modTool,
              },
            }

            const moderationEvent = await handleModerationEvent({
              input,
              auth,
              ctx,
            })

            // Divert side-effect: auto-takedown after divert
            if (isModEventDivert(event)) {
              await handleModerationEvent({
                ctx,
                auth,
                input: {
                  encoding: 'application/json',
                  body: {
                    ...input.body,
                    event: {
                      ...event,
                      $type: 'tools.ozone.moderation.defs#modEventTakedown',
                      comment:
                        '[DIVERT_SIDE_EFFECT]: Automatically taking down after divert event',
                    },
                  },
                },
              })
            }

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
