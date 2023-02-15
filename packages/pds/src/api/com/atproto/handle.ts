import { InvalidRequestError } from '@atproto/xrpc-server'
import * as handleLib from '@atproto/handle'
import { Server } from '../../../lexicon'
import AppContext from '../../../context'
import { UserAlreadyExistsError } from '../../../services/actor'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.handle.resolve(async ({ params }) => {
    const handle = params.handle

    let did = ''
    if (!handle || handle === ctx.cfg.publicHostname) {
      // self
      did = ctx.cfg.serverDid
    } else {
      const supportedHandle = ctx.cfg.availableUserDomains.some((host) =>
        handle.endsWith(host),
      )
      if (!supportedHandle) {
        throw new InvalidRequestError('Not a supported handle domain')
      }
      const user = await ctx.services.actor(ctx.db).getUser(handle, true)
      if (!user) {
        throw new InvalidRequestError('Unable to resolve handle')
      }
      did = user.did
    }

    return {
      encoding: 'application/json',
      body: { did },
    }
  })

  server.com.atproto.handle.update({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ auth, input }) => {
      const requester = auth.credentials.did
      let handle: string
      try {
        handle = handleLib.normalizeAndEnsureValid(
          input.body.handle,
          ctx.cfg.availableUserDomains,
        )
      } catch (err) {
        if (err instanceof handleLib.InvalidHandleError) {
          throw new InvalidRequestError(err.message, 'InvalidHandle')
        } else if (err instanceof handleLib.ReservedHandleError) {
          throw new InvalidRequestError(err.message, 'HandleNotAvailable')
        }
        throw err
      }

      await ctx.db.transaction(async (dbTxn) => {
        try {
          await ctx.services.actor(dbTxn).updateHandle(requester, handle)
        } catch (err) {
          if (err instanceof UserAlreadyExistsError) {
            throw new InvalidRequestError(`Handle already taken: ${handle}`)
          }
          throw err
        }

        await ctx.plcClient.updateHandle(requester, handle, ctx.keypair)
      })
    },
  })
}
