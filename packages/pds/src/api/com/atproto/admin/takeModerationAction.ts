import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import { isRepoRef } from '@atproto/api/src/client/types/com/atproto/admin/defs'
import { isMain as isStrongRef } from '@atproto/api/src/client/types/com/atproto/repo/strongRef'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { TAKEDOWN } from '../../../../lexicon/types/com/atproto/admin/defs'
import { getSubject, getAction } from '../moderation/util'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { authPassthru } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.takeModerationAction({
    auth: ctx.moderatorVerifier,
    handler: async ({ req, input, auth }) => {
      const { db, services } = ctx
      if (ctx.shouldProxyModeration()) {
        const { data: result } =
          await ctx.appviewAgent.com.atproto.admin.takeModerationAction(
            input.body,
            authPassthru(req, true),
          )

        const transact = db.transaction(async (dbTxn) => {
          const authTxn = services.auth(dbTxn)
          const moderationTxn = services.moderation(dbTxn)
          const labelTxn = services.appView.label(dbTxn)
          // perform takedowns
          if (result.action === TAKEDOWN && isRepoRef(result.subject)) {
            await authTxn.revokeRefreshTokensByDid(result.subject.did)
            await moderationTxn.takedownRepo({
              takedownId: result.id,
              did: result.subject.did,
            })
          }
          if (result.action === TAKEDOWN && isStrongRef(result.subject)) {
            await moderationTxn.takedownRecord({
              takedownId: result.id,
              uri: new AtUri(result.subject.uri),
              blobCids: subjectBlobCids?.map((cid) => CID.parse(cid)) ?? [],
            })
          }
          // apply label creation & negations
          const applyLabels = (uri: string, cid: string | null) =>
            labelTxn.formatAndCreate(ctx.cfg.labelerDid, uri, cid, {
              create: result.createLabelVals,
              negate: result.negateLabelVals,
            })
          if (isRepoRef(result.subject)) {
            await applyLabels(result.subject.did, null)
          }
          if (isStrongRef(result.subject)) {
            await applyLabels(result.subject.uri, result.subject.cid)
          }
        })

        try {
          await transact
        } catch (err) {
          req.log.error(
            { err, actionId: result.id },
            'proxied moderation action failed',
          )
        }

        return {
          encoding: 'application/json',
          body: result,
        }
      }

      const moderationService = services.moderation(db)
      const {
        action,
        subject,
        reason,
        createdBy,
        createLabelVals,
        negateLabelVals,
        subjectBlobCids,
      } = input.body

      if (
        !auth.credentials.admin &&
        (createLabelVals?.length ||
          negateLabelVals?.length ||
          action === TAKEDOWN)
      ) {
        throw new AuthRequiredError(
          'Must be an admin to takedown or label content',
        )
      }

      validateLabels([...(createLabelVals ?? []), ...(negateLabelVals ?? [])])

      const moderationAction = await db.transaction(async (dbTxn) => {
        const authTxn = services.auth(dbTxn)
        const moderationTxn = services.moderation(dbTxn)
        const labelTxn = services.appView.label(dbTxn)

        const result = await moderationTxn.logAction({
          action: getAction(action),
          subject: getSubject(subject),
          subjectBlobCids: subjectBlobCids?.map((cid) => CID.parse(cid)) ?? [],
          createLabelVals,
          negateLabelVals,
          createdBy,
          reason,
        })

        if (
          result.action === TAKEDOWN &&
          result.subjectType === 'com.atproto.admin.defs#repoRef' &&
          result.subjectDid
        ) {
          await authTxn.revokeRefreshTokensByDid(result.subjectDid)
          await moderationTxn.takedownRepo({
            takedownId: result.id,
            did: result.subjectDid,
          })
        }

        if (
          result.action === TAKEDOWN &&
          result.subjectType === 'com.atproto.repo.strongRef' &&
          result.subjectUri
        ) {
          await moderationTxn.takedownRecord({
            takedownId: result.id,
            uri: new AtUri(result.subjectUri),
            blobCids: subjectBlobCids?.map((cid) => CID.parse(cid)) ?? [],
          })
        }

        await labelTxn.formatAndCreate(
          ctx.cfg.labelerDid,
          result.subjectUri ?? result.subjectDid,
          result.subjectCid,
          { create: createLabelVals, negate: negateLabelVals },
        )

        return result
      })

      return {
        encoding: 'application/json',
        body: await moderationService.views.action(moderationAction),
      }
    },
  })
}

const validateLabels = (labels: string[]) => {
  for (const label of labels) {
    for (const char of badChars) {
      if (label.includes(char)) {
        throw new InvalidRequestError(`Invalid label: ${label}`)
      }
    }
  }
}

const badChars = [' ', ',', ';', `'`, `"`]
