import { CID } from 'multiformats/cid'
import { InvalidRequestError, AuthRequiredError } from '@atproto/xrpc-server'
import { InvalidRecordKeyError } from '@atproto/syntax'
import { prepareCreate, prepareDelete } from '../../../../repo'
import { Server } from '../../../../lexicon'
import {
  BadCommitSwapError,
  InvalidRecordError,
  PreparedCreate,
} from '../../../../repo'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.importRepo({
    auth: ctx.authVerifier.accessCheckTakedown,
    handler: async ({ input, auth }) => {
      const did = auth.credentials.did
    },
  })
}
