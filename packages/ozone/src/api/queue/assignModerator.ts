import { isDidString } from '@atproto/lex'
import {
  ForbiddenError,
  InvalidRequestError,
  type Server,
} from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'
import { getAuthDid } from '../util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.queue.assignModerator, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const { queueId, did } = input.body

      // @TODO The lexicon schema should define the "did" property as a did
      // string format (but it doesn't)
      if (!isDidString(did)) {
        throw new InvalidRequestError('Invalid DID format')
      }

      const authDid = getAuthDid(auth, ctx.cfg.service.did)

      // RBAC
      if (!auth.credentials.isModerator) {
        throw new ForbiddenError('Unauthorized')
      }

      // RuBAC
      if (did !== authDid && !auth.credentials.isAdmin) {
        throw new ForbiddenError('Unauthorized')
      }

      const result = await ctx.assignmentService.assignQueue({ did, queueId })

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}
