import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons/index.js'
import { computeProxyTo } from '../../../../pipethrough'
import {
  MungeFn,
  pipethroughReadAfterWrite,
} from '../../../../read-after-write'

export default function (server: Server, ctx: AppContext) {
  if (!ctx.bskyAppView) return

  server.add(app.bsky.actor.getProfile, {
    auth: ctx.authVerifier.authorization({
      authorize: (permissions, { req }) => {
        const lxm = app.bsky.actor.getProfile.$lxm
        const aud = computeProxyTo(ctx, req, lxm)
        permissions.assertRpc({ aud, lxm })
      },
    }),
    opts: {
      // @TODO remove after grace period has passed, behavior is non-standard.
      // temporarily added for compat w/ previous version of xrpc-server to avoid breakage of a few specified parties.
      paramsParseLoose: true,
    },
    handler: async (reqCtx) => {
      return pipethroughReadAfterWrite(
        ctx,
        reqCtx,
        app.bsky.actor.getProfile,
        getProfileMunge,
      )
    },
  })
}

const getProfileMunge: MungeFn<app.bsky.actor.getProfile.$OutputBody> = async (
  localViewer,
  original,
  local,
  requester,
) => {
  if (!local.profile) return original
  if (original.did !== requester) return original
  return localViewer.updateProfileDetailed(original, local.profile.record)
}
