import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import {
  AuthRequiredError,
  InvalidRequestError,
  UpstreamFailureError,
} from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { getSubject } from '../moderation/util'
import {
  isModEventLabel,
  isModEventReverseTakedown,
  isModEventTakedown,
} from '../../../../lexicon/types/com/atproto/admin/defs'
import { TakedownSubjects } from '../../../../services/moderation'
import { retryHttp } from '../../../../util/retry'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.emitModerationEvent({
    auth: ctx.roleVerifier,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db.getPrimary()
      const moderationService = ctx.services.moderation(db)
      const { subject, createdBy, subjectBlobCids, event } = input.body
      const isTakedownEvent = isModEventTakedown(event)
      const isReverseTakedownEvent = isModEventReverseTakedown(event)
      const isLabelEvent = isModEventLabel(event)

      // apply access rules

      // if less than moderator access then can not takedown an account
      if (!access.moderator && isTakedownEvent && 'did' in subject) {
        throw new AuthRequiredError(
          'Must be a full moderator to perform an account takedown',
        )
      }
      // if less than moderator access then can only take ack and escalation actions
      if (!access.moderator && (isTakedownEvent || isReverseTakedownEvent)) {
        throw new AuthRequiredError(
          'Must be a full moderator to take this type of action',
        )
      }
      // if less than moderator access then can not apply labels
      if (!access.moderator && isLabelEvent) {
        throw new AuthRequiredError('Must be a full moderator to label content')
      }

      if (isLabelEvent) {
        validateLabels([
          ...(event.createLabelVals ?? []),
          ...(event.negateLabelVals ?? []),
        ])
      }

      const subjectInfo = getSubject(subject)

      if (isTakedownEvent || isReverseTakedownEvent) {
        const isSubjectTakendown = await moderationService.isSubjectTakendown(
          subjectInfo,
        )

        if (isSubjectTakendown && isTakedownEvent) {
          throw new InvalidRequestError(`Subject is already taken down`)
        }

        if (!isSubjectTakendown && isReverseTakedownEvent) {
          throw new InvalidRequestError(`Subject is not taken down`)
        }
      }

      const { result: moderationEvent, takenDown } = await db.transaction(
        async (dbTxn) => {
          const moderationTxn = ctx.services.moderation(dbTxn)
          const labelTxn = ctx.services.label(dbTxn)

          const result = await moderationTxn.logEvent({
            event,
            subject: subjectInfo,
            subjectBlobCids:
              subjectBlobCids?.map((cid) => CID.parse(cid)) ?? [],
            createdBy,
          })

          let takenDown: TakedownSubjects | undefined

          if (
            result.subjectType === 'com.atproto.admin.defs#repoRef' &&
            result.subjectDid
          ) {
            // No credentials to revoke on appview
            if (isTakedownEvent) {
              takenDown = await moderationTxn.takedownRepo({
                takedownId: result.id,
                did: result.subjectDid,
              })
            }

            if (isReverseTakedownEvent) {
              await moderationTxn.reverseTakedownRepo({
                did: result.subjectDid,
              })
              takenDown = {
                subjects: [
                  {
                    $type: 'com.atproto.admin.defs#repoRef',
                    did: result.subjectDid,
                  },
                ],
                did: result.subjectDid,
              }
            }
          }

          if (
            result.subjectType === 'com.atproto.repo.strongRef' &&
            result.subjectUri
          ) {
            const blobCids = subjectBlobCids?.map((cid) => CID.parse(cid)) ?? []
            if (isTakedownEvent) {
              takenDown = await moderationTxn.takedownRecord({
                takedownId: result.id,
                uri: new AtUri(result.subjectUri),
                // TODO: I think this will always be available for strongRefs?
                cid: CID.parse(result.subjectCid as string),
                blobCids,
              })
            }

            if (isReverseTakedownEvent) {
              await moderationTxn.reverseTakedownRecord({
                uri: new AtUri(result.subjectUri),
              })
              takenDown = {
                did: result.subjectDid,
                subjects: [
                  {
                    $type: 'com.atproto.repo.strongRef',
                    uri: result.subjectUri,
                    cid: result.subjectCid ?? '',
                  },
                  ...blobCids.map((cid) => ({
                    $type: 'com.atproto.admin.defs#repoBlobRef',
                    did: result.subjectDid,
                    cid: cid.toString(),
                    recordUri: result.subjectUri,
                  })),
                ],
              }
            }
          }

          if (isLabelEvent) {
            await labelTxn.formatAndCreate(
              ctx.cfg.labelerDid,
              result.subjectUri ?? result.subjectDid,
              result.subjectCid,
              {
                create: result.createLabelVals?.length
                  ? result.createLabelVals.split(' ')
                  : undefined,
                negate: result.negateLabelVals?.length
                  ? result.negateLabelVals.split(' ')
                  : undefined,
              },
            )
          }

          return { result, takenDown }
        },
      )

      if (takenDown && ctx.moderationPushAgent) {
        const { did, subjects } = takenDown
        if (did && subjects.length > 0) {
          const agent = ctx.moderationPushAgent
          const results = await Promise.allSettled(
            subjects.map((subject) =>
              retryHttp(() =>
                agent.api.com.atproto.admin.updateSubjectStatus({
                  subject,
                  takedown: isTakedownEvent
                    ? {
                        applied: true,
                        ref: moderationEvent.id.toString(),
                      }
                    : {
                        applied: false,
                      },
                }),
              ),
            ),
          )
          const hadFailure = results.some((r) => r.status === 'rejected')
          if (hadFailure) {
            throw new UpstreamFailureError('failed to apply action on PDS')
          }
        }
      }

      return {
        encoding: 'application/json',
        body: await moderationService.views.event(moderationEvent),
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
