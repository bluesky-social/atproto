import { parseCid } from '@atproto/lex-data'
import { RECORD_MAC_PROFILE } from '@atproto/space'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertRepoAvailability } from '../sync/util.js'
import {
  assertSpaceRead,
  getSpaceMacRequest,
  isSpaceUserOrAdmin,
  recordMacHeaders,
  toSpaceRef,
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
      const ref = toSpaceRef(space)

      assertSpaceRead(auth, ref, repo)
      await assertRepoAvailability(ctx, repo, isSpaceUserOrAdmin(auth, repo))

      const macRequest = await getSpaceMacRequest(ctx, {
        req,
        res,
        auth,
        repo,
        profile: RECORD_MAC_PROFILE,
      })

      const uri = ref.recordUri(repo, collection, rkey)
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
        encoding: 'application/json',
        body: {
          uri: uri.toString(),
          cid: record.cid,
          value: record.value,
        },
        headers: recordMacHeaders(
          macRequest,
          uri.toString(),
          parseCid(record.cid, { flavor: 'cbor' }),
        ),
      }
    },
  })
}
