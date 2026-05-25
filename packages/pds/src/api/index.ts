import { AppContext } from '../context'
import { Server } from '../lexicon'
import comAtproto from './com/atproto'

// app/bsky proxy routes are intentionally NOT registered here (SOK-34).
// The implementation files in ./app/bsky/ are kept for reference — Sokaa's
// own app.sokaa.* XRPC handlers will follow the same structure.
export default function (server: Server, ctx: AppContext) {
  comAtproto(server, ctx)
  return server
}
