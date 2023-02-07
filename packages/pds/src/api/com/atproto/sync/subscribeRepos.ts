import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import Outbox from '../../../../sequencer/outbox'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.subscribeRepos(async function* ({ params }) {
    // const outbox = new Outbox(ctx.sequencer)
    // for await (const evt of outbox.events(params.lastSeen)) {
    //   yield evt
    // }
  })
}
