import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { computeProxyTo } from '../../../../pipethrough'
import {
  MungeFn,
  pipethroughReadAfterWrite,
} from '../../../../read-after-write'
import { app } from '#lexicons'

export default function (server: Server, ctx: AppContext) {
  if (!ctx.bskyAppView) return

  server.add(app.bsky.actor.getProfiles, {
    auth: ctx.authVerifier.authorization({
      authorize: (permissions, { req }) => {
        const lxm = app.bsky.actor.getProfiles.$lxm
        const aud = computeProxyTo(ctx, req, lxm)
        permissions.assertRpc({ aud, lxm })
      },
    }),
    handler: async (reqCtx) => {
      return pipethroughReadAfterWrite(
        ctx,
        reqCtx,
        app.bsky.actor.getProfiles,
        getProfilesMunge,
      )
    },
  })
}

const getProfilesMunge: MungeFn<app.bsky.actor.getProfiles.OutputBody> = async (
  localViewer,
  original,
  local,
  requester,
) => {
  const localProf = local.profile
  if (!localProf) return original

  const profiles = original.profiles.map((prof) => {
    if (prof.did !== requester) return prof
    return localViewer.updateProfileDetailed(prof, localProf.record)
  })
  return {
    ...original,
    profiles,
  }
}
