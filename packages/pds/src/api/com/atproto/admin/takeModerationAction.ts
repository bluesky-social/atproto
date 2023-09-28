import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  isRepoRef,
  ACKNOWLEDGE,
  ESCALATE,
  TAKEDOWN,
} from '../../../../lexicon/types/com/atproto/admin/defs'
import { isMain as isStrongRef } from '../../../../lexicon/types/com/atproto/repo/strongRef'
import { getSubject, getAction } from '../moderation/util'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { authPassthru } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.takeModerationAction({
    auth: ctx.roleVerifier,
    handler: async ({ req, input, auth }) => {
      const access = auth.credentials
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
              blobCids: result.subjectBlobCids.map((cid) => CID.parse(cid)),
            })
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
        durationInHours,
      } = input.body

      // apply access rules

      // if less than admin access then can not takedown an account
      if (!access.moderator && action === TAKEDOWN && 'did' in subject) {
        throw new AuthRequiredError(
          'Must be a full moderator to perform an account takedown',
        )
      }
      // if less than moderator access then can only take ack and escalation actions
      if (!access.moderator && ![ACKNOWLEDGE, ESCALATE].includes(action)) {
        throw new AuthRequiredError(
          'Must be a full moderator to take this type of action',
        )
      }
      // if less than moderator access then can not apply labels
      if (
        !access.moderator &&
        (createLabelVals?.length || negateLabelVals?.length)
      ) {
        throw new AuthRequiredError('Must be a full moderator to label content')
      }

      validateLabels([...(createLabelVals ?? []), ...(negateLabelVals ?? [])])

      const moderationAction = await db.transaction(async (dbTxn) => {
        const authTxn = services.auth(dbTxn)
        const moderationTxn = services.moderation(dbTxn)

        const result = await moderationTxn.logAction({
          action: getAction(action),
          subject: getSubject(subject),
          subjectBlobCids: subjectBlobCids?.map((cid) => CID.parse(cid)) ?? [],
          createLabelVals,
          negateLabelVals,
          createdBy,
          reason,
          durationInHours,
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
