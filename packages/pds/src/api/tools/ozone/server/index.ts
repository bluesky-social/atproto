import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import describeServer from './describeServer'

export default function (server: Server, ctx: AppContext) {
  describeServer(server, ctx)
}
