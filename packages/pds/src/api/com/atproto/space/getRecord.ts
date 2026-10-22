import { parseCid } from '@atproto/lex-data'
import { RECORD_MAC_TYPE } from '@atproto/space'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { spaceRecordUri } from '../../../../repo/index.js'
import { assertRepoAvailability } from '../sync/util.js'
import {
  assertSpaceRead,
  getSpaceMacSecret,
  isSpaceSelfRead,
  recordMacHeaders,
} from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getRecord, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth, req, res }) => {
      const { space, repo, collection, rkey } = params

      assertSpaceRead(auth, space, repo)
      await assertRepoAvailability(ctx, repo, isSpaceSelfRead(auth, repo))

      const sharedSecret = await getSpaceMacSecret(ctx, {
        req,
        res,
        auth,
        repo,
        type: RECORD_MAC_TYPE,
      })

      const uri = spaceRecordUri(space, repo, collection, rkey)
      const record = await ctx.actorStore.read(repo, (store) =>
        store.space.getRecord(uri.toString()),
      )
      if (!record) {
        throw new InvalidRequestError(
          `Could not locate record: ${uri}`,
          'RecordNotFound',
        )
      }

      return {
        encoding: 'application/json' as const,
        body: {
          uri: uri.toString(),
          cid: record.cid,
          value: record.value,
        },
        headers: recordMacHeaders(
          sharedSecret,
          uri.toString(),
          parseCid(record.cid),
        ),
      }
    },
  })
}
