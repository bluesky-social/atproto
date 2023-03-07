import ApiAgent from '@atproto/api'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as handleLib from '@atproto/handle'
import { Server } from '../../../lexicon'
import AppContext from '../../../context'
import { UserAlreadyExistsError } from '../../../services/account'
import { httpLogger as log } from '../../../logger'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.handle.resolve(async ({ req, params }) => {
    const handle = params.handle || req.hostname

    let did: string | undefined
    const user = await ctx.services.account(ctx.db).getUser(handle, true)
    if (user) {
      did = user.did
    } else {
      const supportedHandle = ctx.cfg.availableUserDomains.some(
        (host) => handle.endsWith(host) || handle === host.slice(1),
      )
      // this should be in our DB & we couldn't find it, so fail
      if (supportedHandle) {
        throw new InvalidRequestError('Unable to resolve handle')
      }

      // this is not someone on our server, but we help with resolving anyway
      did = await resolveExternalHandle(ctx.cfg.scheme, handle)
    }
    if (!did) {
      throw new InvalidRequestError('Unable to resolve handle')
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
        handle = handleLib.normalizeAndEnsureValid(input.body.handle)
      } catch (err) {
        if (err instanceof handleLib.InvalidHandleError) {
          throw new InvalidRequestError(err.message, 'InvalidHandle')
        }
        throw err
      }

      // test against our service constraints
      // if not a supported domain, then we must check that the domain correctly links to the DID
      try {
        handleLib.ensureServiceConstraints(handle, ctx.cfg.availableUserDomains)
      } catch (err) {
        if (err instanceof handleLib.UnsupportedDomainError) {
          const did = await resolveExternalHandle(ctx.cfg.scheme, handle)
          if (did !== requester) {
            throw new InvalidRequestError(
              'External handle did not resolve to DID',
            )
          }
        } else if (err instanceof handleLib.InvalidHandleError) {
          throw new InvalidRequestError(err.message, 'InvalidHandle')
        } else if (err instanceof handleLib.ReservedHandleError) {
          throw new InvalidRequestError(err.message, 'HandleNotAvailable')
        } else {
          throw err
        }
      }

      await ctx.db.transaction(async (dbTxn) => {
        try {
          await ctx.services.account(dbTxn).updateHandle(requester, handle)
        } catch (err) {
          if (err instanceof UserAlreadyExistsError) {
            throw new InvalidRequestError(`Handle already taken: ${handle}`)
          }
          throw err
        }
        await ctx.plcClient.updateHandle(requester, ctx.plcRotationKey, handle)
      })
    },
  })
}

const resolveExternalHandle = async (
  scheme: string,
  handle: string,
): Promise<string | undefined> => {
  try {
    const did = await handleLib.resolveDns(handle)
    return did
  } catch (err) {
    if (err instanceof handleLib.NoHandleRecordError) {
      // no worries it's just not found
    } else {
      log.error({ err, handle }, 'could not resolve dns handle')
    }
  }
  try {
    const agent = new ApiAgent({ service: `${scheme}://${handle}` })
    const res = await agent.api.com.atproto.handle.resolve({ handle })
    return res.data.did
  } catch (err) {
    return undefined
  }
}
