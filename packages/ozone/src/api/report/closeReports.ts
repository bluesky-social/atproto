import { type AtUriString, type DidString, isDidString } from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'
import { closeReportsForSubject } from '../../mod-service/report.js'
import { getAuthDid } from '../util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.report.closeReports, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const createdBy = getAuthDid(auth, ctx.cfg.service.did)
      const { subject, reportTypes, internalNote, isAutomated } = input.body

      let subjectDid: DidString
      let subjectUri: AtUriString | null = null
      if (subject.startsWith('at://')) {
        try {
          const uri = new AtUri(subject)
          subjectDid = uri.did
          subjectUri = uri.href
        } catch {
          throw new InvalidRequestError(`Invalid AT-URI: ${subject}`)
        }
      } else if (isDidString(subject)) {
        subjectDid = subject
      } else {
        throw new InvalidRequestError('Subject must be a DID or an AT-URI')
      }

      const result = await closeReportsForSubject({
        db: ctx.db,
        subjectDid,
        subjectUri,
        reportTypes,
        internalNote: internalNote ?? undefined,
        isAutomated: isAutomated ?? false,
        createdBy: createdBy ?? ctx.cfg.service.did,
      })

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}
