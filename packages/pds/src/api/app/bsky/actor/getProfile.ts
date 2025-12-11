import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { computeProxyTo } from '../../../../pipethrough'
import {
  LocalRecords,
  LocalViewer,
  pipethroughReadAfterWrite,
} from '../../../../read-after-write'
import { app } from '#lexicons'

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
    handler: async (reqCtx) => {
      return pipethroughReadAfterWrite(ctx, reqCtx, getProfileMunge)
    },
  })
}

const getProfileMunge = async (
  localViewer: LocalViewer,
  original: app.bsky.actor.getProfile.OutputBody,
  local: LocalRecords,
  requester: string,
): Promise<app.bsky.actor.getProfile.OutputBody> => {
  if (!local.profile) return original
  if (original.did !== requester) return original
  return localViewer.updateProfileDetailed(original, local.profile.record)
}
