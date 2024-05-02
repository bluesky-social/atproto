import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import queryLabels from './queryLabels'

export default function (server: Server, ctx: AppContext) {
  queryLabels(server, ctx)
}
