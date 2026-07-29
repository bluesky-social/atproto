import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import type { Server } from '../../lexicon/index.js'
import { closeReportsForSubject } from '../../mod-service/report.js'
import { getAuthDid } from '../util.js'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.closeReports({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const createdBy = getAuthDid(auth, ctx.cfg.service.did)
      const { subject, reportTypes, internalNote, isAutomated } = input.body

      let subjectDid: string
      let subjectUri: string | null = null
      if (subject.startsWith('at://')) {
        let uri: AtUri
        try {
          uri = new AtUri(subject)
        } catch {
          throw new InvalidRequestError(`Invalid AT-URI: ${subject}`)
        }
        subjectDid = uri.host
        subjectUri = subject
      } else if (subject.startsWith('did:')) {
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
