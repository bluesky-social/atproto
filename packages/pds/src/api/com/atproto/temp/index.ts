import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import requestPhoneVerification from './requestPhoneVerification'

export default function (server: Server, ctx: AppContext) {
  requestPhoneVerification(server, ctx)
}
