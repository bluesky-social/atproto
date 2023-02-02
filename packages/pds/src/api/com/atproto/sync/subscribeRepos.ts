import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import Outbox from '../../../../sequencer/outbox'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.subscribeRepos(async function* ({ params }) {
    // @TODO move sequencer to ctx
    const outbox = new Outbox(ctx.sequencer, params.lastSeen)
    for await (const evt of outbox.events()) {
      yield evt
    }
  })
}
