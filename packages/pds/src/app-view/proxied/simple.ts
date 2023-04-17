import { Server } from '../../lexicon'
import AppContext from '../../context'
import { AtpAgent } from '@atproto/api'

export default function (server: Server, ctx: AppContext) {
  if (!ctx.cfg.bskyAppViewEndpoint) {
    throw new Error('Could not find bsky appview endpoint')
  }
  const agent = new AtpAgent({ service: ctx.cfg.bskyAppViewEndpoint })

  const headers = (did: string) => {
    return {
      headers: { authorization: `Bearer ${did}` },
    }
  }

  server.app.bsky.actor.getProfile({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.actor.getProfile(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.actor.getProfiles({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.actor.getProfiles(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.actor.getSuggestions({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.actor.getSuggestions(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.actor.searchActors({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.actor.searchActors(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.actor.searchActorsTypeahead({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.actor.searchActorsTypeahead(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  // @TODO MUTES?
  server.app.bsky.feed.getAuthorFeed({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.feed.getAuthorFeed(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.feed.getLikes({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.feed.getLikes(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  // @TODO MUTES?
  server.app.bsky.feed.getPostThread({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.feed.getPostThread(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.feed.getRepostedBy({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.feed.getRepostedBy(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  // @TODO Mutes
  server.app.bsky.feed.getTimeline({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.feed.getTimeline(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.graph.getFollowers({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      console.log('GET FOLLOWERS')
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.graph.getFollowers(
        params,
        headers(requester),
      )
      const dids = res.data.followers.map((follower) => follower.did)
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)
      const hydrated = res.data.followers.map((follower) => ({
        ...follower,
        viewer: {
          ...(follower.viewer || {}),
          muted: mutes[follower.did] ?? false,
        },
      }))

      const viewers = hydrated.map((h) => h.viewer)
      console.log(viewers)

      return {
        encoding: 'application/json',
        body: {
          ...res.data,
          followers: hydrated,
        },
      }
    },
  })

  server.app.bsky.graph.getFollows({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      console.log('GET FOLLOWS')
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.graph.getFollows(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  // @TODO mutes
  server.app.bsky.unspecced.getPopular({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.unspecced.getPopular(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
