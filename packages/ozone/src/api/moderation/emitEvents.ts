import { chunkArray } from '@atproto/common'
import { type Server, XRPCError } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'
import { httpLogger } from '../../logger.js'
import {
  handleModerationEvent,
  validateEventAuth,
  validateSubjects,
} from './util-event.js'

const CHUNK_SIZE = 10

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.moderation.emitEvents, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const { event, subjects, createdBy, modTool } = input.body
      const events: tools.ozone.moderation.defs.ModEventView[] = []
      const failedEvents: tools.ozone.moderation.emitEvents.FailedEvent[] = []

      validateSubjects(subjects)
      await validateEventAuth({ event, auth, ctx })

      for (const chunk of chunkArray(subjects, CHUNK_SIZE)) {
        const results = await Promise.allSettled(
          chunk.map((entry) =>
            handleModerationEvent({
              auth,
              ctx,
              input: {
                ...entry,
                // @NOTE Email delivery mutates the event per recipient.
                event: { ...event },
                createdBy,
                modTool,
              },
            }),
          ),
        )

        for (const [index, settled] of results.entries()) {
          if (settled.status === 'fulfilled') {
            events.push(settled.value)
          } else {
            const { subject } = chunk[index]
            httpLogger.error(
              { err: settled.reason, subject },
              'failed to emit bulk moderation event',
            )
            failedEvents.push({
              error:
                settled.reason instanceof Error
                  ? settled.reason.message
                  : String(settled.reason),
              errorName:
                settled.reason instanceof XRPCError
                  ? settled.reason.error
                  : undefined,
              subject,
            })
          }
        }
      }

      return {
        encoding: 'application/json',
        body: { events, failedEvents },
      }
    },
  })
}
