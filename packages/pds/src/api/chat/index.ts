import AppContext from '../../context'
import { Server } from '../../lexicon'
import { pipethrough, pipethroughProcedure } from '../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  server.chat.bsky.actor.deleteAccount({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: async ({ req, auth }) => {
      return pipethroughProcedure(ctx, req, auth.credentials.did)
    },
  })
  server.chat.bsky.actor.exportAccountData({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: ({ req, auth }) => {
      return pipethrough(ctx, req, auth.credentials.did)
    },
  })
  server.chat.bsky.convo.deleteMessageForSelf({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: ({ req, auth, input }) => {
      return pipethroughProcedure(ctx, req, auth.credentials.did, input.body)
    },
  })
  server.chat.bsky.convo.getConvo({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: ({ req, auth }) => {
      return pipethrough(ctx, req, auth.credentials.did)
    },
  })
  server.chat.bsky.convo.getConvoForMembers({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: ({ req, auth }) => {
      return pipethrough(ctx, req, auth.credentials.did)
    },
  })
  server.chat.bsky.convo.getLog({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: ({ req, auth }) => {
      return pipethrough(ctx, req, auth.credentials.did)
    },
  })
  server.chat.bsky.convo.getMessages({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: ({ req, auth }) => {
      return pipethrough(ctx, req, auth.credentials.did)
    },
  })
  server.chat.bsky.convo.leaveConvo({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: ({ req, auth, input }) => {
      return pipethroughProcedure(ctx, req, auth.credentials.did, input.body)
    },
  })
  server.chat.bsky.convo.listConvos({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: ({ req, auth }) => {
      return pipethrough(ctx, req, auth.credentials.did)
    },
  })
  server.chat.bsky.convo.muteConvo({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: ({ req, auth, input }) => {
      return pipethroughProcedure(ctx, req, auth.credentials.did, input.body)
    },
  })
  server.chat.bsky.convo.sendMessage({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: ({ req, auth, input }) => {
      return pipethroughProcedure(ctx, req, auth.credentials.did, input.body)
    },
  })
  server.chat.bsky.convo.sendMessageBatch({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: ({ req, auth, input }) => {
      return pipethroughProcedure(ctx, req, auth.credentials.did, input.body)
    },
  })
  server.chat.bsky.convo.unmuteConvo({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: ({ req, auth, input }) => {
      return pipethroughProcedure(ctx, req, auth.credentials.did, input.body)
    },
  })
  server.chat.bsky.convo.updateRead({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: ({ req, auth, input }) => {
      return pipethroughProcedure(ctx, req, auth.credentials.did, input.body)
    },
  })
}
