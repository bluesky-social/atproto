import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import { OutputSchema } from '../../../../lexicon/types/app/bsky/actor/getProfile'
import { computeProxyTo } from '../../../../pipethrough'
import {
  LocalRecords,
  LocalViewer,
  pipethroughReadAfterWrite,
} from '../../../../read-after-write'
import { AccessControlService } from '../../../../services/access-control'

export default function (server: Server, ctx: AppContext) {
  if (!ctx.bskyAppView) return

  const accessControl = new AccessControlService(ctx.actorStore)

  server.app.bsky.actor.getProfile({
    auth: ctx.authVerifier.authorizationOrAdminTokenOptional({
      authorize: (permissions, { req }) => {
        const lxm = ids.AppBskyActorGetProfile
        const aud = computeProxyTo(ctx, req, lxm)
        permissions.assertRpc({ aud, lxm })
      },
    }),
    handler: async (reqCtx) => {
      const { params, auth } = reqCtx
      const requester = auth?.credentials?.did ?? null
      
      // Resolve actor DID from handle or DID
      const actorDid = await ctx.idResolver.actor.resolve(params.actor)
      
      if (!actorDid) {
        throw new Error('Profile not found')
      }

      // Check access control
      const accessResult = await accessControl.canViewProfile(
        requester,
        actorDid,
      )

      // If unauthorized, return minimal profile data
      if (!accessResult.canView) {
        const account = await ctx.accountManager.getAccount(actorDid)
        return {
          did: actorDid,
          handle: account?.handle ?? actorDid,
        }
      }

      // Authorized - continue with normal proxy logic
      return pipethroughReadAfterWrite(ctx, reqCtx, getProfileMunge)
    },
  })
}

const getProfileMunge = async (
  localViewer: LocalViewer,
  original: OutputSchema,
  local: LocalRecords,
  requester: string,
): Promise<OutputSchema> => {
  if (!local.profile) return original
  if (original.did !== requester) return original
  return localViewer.updateProfileDetailed(original, local.profile.record)
}
