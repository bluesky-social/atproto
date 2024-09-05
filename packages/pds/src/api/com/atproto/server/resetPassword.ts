import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { MINUTE } from '@atproto/common'
import { authPassthru } from '../../../proxy'

// export default function (server: Server, ctx: AppContext) {
//   server.com.atproto.server.resetPassword({
//     rateLimit: [
//       {
//         durationMs: 5 * MINUTE,
//         points: 50,
//       },
//     ],
//     handler: async ({ input, req }) => {
//       if (ctx.entrywayAgent) {
//         await ctx.entrywayAgent.com.atproto.server.resetPassword(
//           input.body,
//           authPassthru(req, true),
//         )
//         return
//       }

//       const { token, password } = input.body

//       await ctx.accountManager.resetPassword({ token, password })
//     },
//   })
// }
