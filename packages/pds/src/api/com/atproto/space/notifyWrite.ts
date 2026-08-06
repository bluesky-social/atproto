import { xrpc } from '@atproto/lex'
import { ForbiddenError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { spaceLogger } from '../../../../logger.js'
import { resolveNotifyTarget, toSpaceRef } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.notifyWrite, {
    auth: ctx.authVerifier.serviceAuth,
    handler: async ({ input, auth }) => {
      const { space, repo, rev, hash } = input.body

      const { spaceDid: ownerDid } = toSpaceRef(space)

      // iss is the signer, so requiring it to match keeps a PDS from notifying on
      // another account's behalf.
      if (auth.credentials.iss !== repo) {
        throw new ForbiddenError(
          'notifyWrite iss does not match claimed writer',
        )
      }

      // Not checked during auth: a PDS answers for many authorities, so the
      // audience is only knowable from the space the body names.
      if (auth.credentials.aud !== ownerDid) {
        throw new ForbiddenError(
          'notifyWrite aud does not match the space authority',
        )
      }

      // Only the space owner's PDS has the member list and fan-out state; for
      // non-owner PDSes this handler is a no-op (e.g. re-delivery to a
      // syncing service that also hosts a replica).
      const account = await ctx.accountManager.getAccount(ownerDid)
      if (!account) return

      const { existing, config, recipients } = await ctx.actorStore.read(
        ownerDid,
        async (store) => ({
          existing: await store.space.getSpace(space),
          // Null if this host isn't the space's authority.
          config: await store.space.getSpaceConfig(space),
          recipients: await store.space.getCredentialRecipients(space),
        }),
      )
      // Nothing to maintain here for a space this host doesn't govern, or one already
      // deleted.
      if (!config || !existing || existing.deletedAt) return

      // The same check that mints credentials, so the writer set can't diverge from
      // who may read the space. User perimeter only: this comes from the writer's PDS,
      // not an app, so there is no attestation to evaluate.
      const authorized = await ctx.simpleSpaceManager.authorizeUser({
        config,
        userDid: repo,
      })
      if (!authorized) {
        throw new ForbiddenError('notifyWrite writer is not authorized')
      }

      // Record the writer in the space's writer set (the sync boundary that
      // listRepos enumerates), advancing its latest known rev and commit hash.
      await ctx.actorStore.transact(ownerDid, (txn) =>
        txn.space.recordWriter(space, repo, rev, hash),
      )

      // Forward to the syncers registered for this space, on the background queue so
      // the writer's PDS isn't kept waiting on the fan-out.
      const lxm = com.atproto.space.notifyWrite.$lxm
      ctx.backgroundQueue.add(async () => {
        for (const recipient of recipients) {
          try {
            const target = await resolveNotifyTarget(ctx, {
              iss: ownerDid,
              service: recipient.serviceDid,
              lxm,
            })
            if (!target) {
              spaceLogger.warn(
                { space, service: recipient.serviceDid, lxm },
                'could not resolve notify recipient',
              )
              continue
            }
            await xrpc(target.endpoint, com.atproto.space.notifyWrite, {
              headers: target.headers,
              body: { space, repo, rev, hash },
            })
          } catch (err) {
            spaceLogger.warn(
              { err, space, service: recipient.serviceDid, lxm },
              'notify failed',
            )
          }
        }
      })
    },
  })
}
