import { MethodNotImplementedError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getRepo, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    // @TODO Implement full-state CAR export. The CAR declares two roots in
    // order — the signedCommit, then a DRISL (DAG-CBOR) index mapping
    // "{collection}/{rkey}" -> record CID (lexicographic) — followed by the
    // record blocks in the same order. See proposal 0016 "Repo serialization".
    handler: async () => {
      throw new MethodNotImplementedError('getRepo is not yet implemented')
    },
  })
}
