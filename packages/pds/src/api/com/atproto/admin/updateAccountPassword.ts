import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from './util'

// export default function (server: Server, ctx: AppContext) {
//   server.com.atproto.admin.updateAccountPassword({
//     auth: ctx.authVerifier.adminToken,
//     handler: async ({ input, req }) => {
//       if (ctx.entrywayAgent) {
//         await ctx.entrywayAgent.com.atproto.admin.updateAccountPassword(
//           input.body,
//           authPassthru(req, true),
//         )
//         return
//       }

//       const { did, password } = input.body
//       await ctx.accountManager.updateAccountPassword({ did, password })
//     },
//   })
// }
