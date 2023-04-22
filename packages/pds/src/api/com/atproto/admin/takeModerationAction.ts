import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { TAKEDOWN } from '../../../../lexicon/types/com/atproto/admin/defs'
import { getSubject, getAction } from '../moderation/util'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.takeModerationAction({
    auth: ctx.moderatorVerifier,
    handler: async ({ input, auth }) => {
      const { db, services } = ctx
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
