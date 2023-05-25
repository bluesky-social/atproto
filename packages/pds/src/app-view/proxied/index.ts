import { AtpAgent } from '@atproto/api'
import { dedupeStrs } from '@atproto/common'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'
import {
  FeedViewPost,
  ThreadViewPost,
  isPostView,
  isReasonRepost,
  isThreadViewPost,
} from '../../lexicon/types/app/bsky/feed/defs'

export default function (server: Server, ctx: AppContext) {
  const appviewEndpoint = ctx.cfg.bskyAppViewEndpoint
  const appviewDid = ctx.cfg.bskyAppViewDid
  if (!appviewEndpoint) {
    throw new Error('Could not find bsky appview endpoint')
  }
  if (!appviewDid) {
    throw new Error('Could not find bsky appview did')
  }

  const agent = new AtpAgent({ service: appviewEndpoint })

  const headers = async (did: string) => {
    return createServiceAuthHeaders({
      iss: did,
      aud: appviewDid,
      keypair: ctx.repoSigningKey,
    })
  }

  server.app.bsky.actor.getProfile({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.actor.getProfile(
        params,
        await headers(requester),
      )
      const profile = res.data
      const muted = await ctx.services
        .account(ctx.db)
        .getMute(requester, profile.did)
      profile.viewer ??= {}
      profile.viewer.muted = muted
      return {
        encoding: 'application/json',
        body: profile,
      }
    },
  })

  server.app.bsky.actor.getProfiles({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.actor.getProfiles(
        params,
        await headers(requester),
      )
      const profiles = res.data.profiles

      const dids = profiles.map((profile) => profile.did)
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)

      for (const profile of profiles) {
        profile.viewer ??= {}
        profile.viewer.muted = mutes[profile.did] ?? false
      }

      return {
        encoding: 'application/json',
        body: {
          profiles,
        },
      }
    },
  })

  server.app.bsky.actor.getSuggestions({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.actor.getSuggestions(
        params,
        await headers(requester),
      )
      const { cursor, actors } = res.data
      const dids = actors.map((actor) => actor.did)
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)
      for (const actor of actors) {
        actor.viewer ??= {}
        actor.viewer.muted = mutes[actor.did] ?? false
      }

      return {
        encoding: 'application/json',
        body: {
          cursor,
          actors,
        },
      }
    },
  })

  server.app.bsky.actor.searchActors({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.actor.searchActors(
        params,
        await headers(requester),
      )

      const { cursor, actors } = res.data
      const dids = actors.map((actor) => actor.did)
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)
      for (const actor of actors) {
        actor.viewer ??= {}
        actor.viewer.muted = mutes[actor.did] ?? false
      }

      return {
        encoding: 'application/json',
        body: {
          cursor,
          actors,
        },
      }
    },
  })

  server.app.bsky.actor.searchActorsTypeahead({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.actor.searchActorsTypeahead(
        params,
        await headers(requester),
      )

      const { actors } = res.data
      const dids = actors.map((actor) => actor.did)
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)
      for (const actor of actors) {
        actor.viewer ??= {}
        actor.viewer.muted = mutes[actor.did] ?? false
      }

      return {
        encoding: 'application/json',
        body: { actors },
      }
    },
  })

  server.app.bsky.feed.getAuthorFeed({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.feed.getAuthorFeed(
        params,
        await headers(requester),
      )
      const { cursor, feed } = res.data
      const dids = didsForFeedViewPosts(feed)
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)
      const hydrated = processFeedViewPostMutes(feed, mutes, (post) => {
        // eliminate posts by a muted account that have been reposted by account of feed
        return (
          post.reason !== undefined &&
          isReasonRepost(post.reason) &&
          mutes[post.post.author.did] === true
        )
      })

      return {
        encoding: 'application/json',
        body: {
          cursor,
          feed: hydrated,
        },
      }
    },
  })

  server.app.bsky.feed.getLikes({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.feed.getLikes(
        params,
        await headers(requester),
      )

      const { cursor, uri, cid, likes } = res.data
      const dids = likes.map((like) => like.actor.did)
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)

      for (const like of likes) {
        like.actor.viewer ??= {}
        like.actor.viewer.muted = mutes[like.actor.did] ?? false
      }

      return {
        encoding: 'application/json',
        body: {
          cursor,
          uri,
          cid,
          likes,
        },
      }
    },
  })

  server.app.bsky.feed.getPostThread({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.feed.getPostThread(
        params,
        await headers(requester),
      )
      const { thread } = res.data
      if (!isThreadViewPost(thread)) {
        return {
          encoding: 'application/json',
          body: { thread },
        }
      }

      const dids = isThreadViewPost(thread) ? didsForThread(thread) : []
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)
      const hydrated = processThreadViewMutes(thread, mutes)

      return {
        encoding: 'application/json',
        body: {
          thread: hydrated,
        },
      }
    },
  })

  server.app.bsky.feed.getPosts({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.feed.getPosts(
        params,
        await headers(requester),
      )
      const { posts } = res.data

      const dids = posts.map((p) => p.author.did)
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)
      for (const post of posts) {
        post.author.viewer ??= {}
        post.author.viewer.muted = mutes[post.author.did] ?? false
      }

      return {
        encoding: 'application/json',
        body: {
          posts,
        },
      }
    },
  })

  server.app.bsky.feed.getRepostedBy({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.feed.getRepostedBy(
        params,
        await headers(requester),
      )

      const { cursor, uri, cid, repostedBy } = res.data
      const dids = repostedBy.map((repost) => repost.did)
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)

      for (const repost of repostedBy) {
        repost.viewer ??= {}
        repost.viewer.muted = mutes[repost.did] ?? false
      }

      return {
        encoding: 'application/json',
        body: {
          cursor,
          uri,
          cid,
          repostedBy,
        },
      }
    },
  })

  server.app.bsky.feed.getTimeline({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.feed.getTimeline(
        params,
        await headers(requester),
      )
      const { cursor, feed } = res.data
      const dids = didsForFeedViewPosts(feed)
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)
      const hydrated = processFeedViewPostMutes(feed, mutes, (post) => {
        // remove posts & reposts from muted accounts
        return (
          mutes[post.post.author.did] === true ||
          (post.reason !== undefined &&
            isReasonRepost(post.reason) &&
            mutes[post.reason.by.did]) === true
        )
      })

      return {
        encoding: 'application/json',
        body: {
          cursor,
          feed: hydrated,
        },
      }
    },
  })

  server.app.bsky.graph.getFollowers({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.graph.getFollowers(
        params,
        await headers(requester),
      )

      const { cursor, subject, followers } = res.data
      const dids = [subject.did, ...followers.map((follower) => follower.did)]
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)

      for (const follower of followers) {
        follower.viewer ??= {}
        follower.viewer.muted = mutes[follower.did] ?? false
      }
      subject.viewer ??= {}
      subject.viewer.muted = mutes[subject.did] ?? false

      return {
        encoding: 'application/json',
        body: {
          cursor,
          subject,
          followers,
        },
      }
    },
  })

  server.app.bsky.graph.getFollows({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.graph.getFollows(
        params,
        await headers(requester),
      )
      const { cursor, subject, follows } = res.data
      const dids = [subject.did, ...follows.map((follow) => follow.did)]
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)

      for (const follow of follows) {
        follow.viewer ??= {}
        follow.viewer.muted = mutes[follow.did] ?? false
      }
      subject.viewer ??= {}
      subject.viewer.muted = mutes[subject.did] ?? false

      return {
        encoding: 'application/json',
        body: {
          cursor,
          subject,
          follows,
        },
      }
    },
  })

  server.app.bsky.unspecced.getPopular({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.unspecced.getPopular(
        params,
        await headers(requester),
      )
      const { cursor, feed } = res.data
      const dids = didsForFeedViewPosts(feed)
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)
      const hydrated = processFeedViewPostMutes(feed, mutes, (post) => {
        return mutes[post.post.author.did] === true
      })

      return {
        encoding: 'application/json',
        body: {
          cursor,
          feed: hydrated,
        },
      }
    },
  })

  server.app.bsky.notification.getUnreadCount({
    auth: ctx.accessVerifier,
    handler: async ({ auth }) => {
      const requester = auth.credentials.did
      const seenAt = await ctx.services
        .account(ctx.db)
        .getLastSeenNotifs(requester)
      const res = await agent.api.app.bsky.notification.getUnreadCount(
        { seenAt },
        await headers(requester),
      )
      const { count } = res.data
      return {
        encoding: 'application/json',
        body: {
          count,
        },
      }
    },
  })

  server.app.bsky.notification.listNotifications({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const seenAt = await ctx.services
        .account(ctx.db)
        .getLastSeenNotifs(requester)
      const res = await agent.api.app.bsky.notification.listNotifications(
        { ...params, seenAt },
        await headers(requester),
      )
      const { cursor, notifications } = res.data
      const dids = notifications.map((notif) => notif.author.did)
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)
      const filtered = notifications.filter(
        (notif) => mutes[notif.author.did] !== true,
      )
      for (const notif of filtered) {
        notif.isRead = seenAt !== undefined && seenAt >= notif.indexedAt
        notif.author.viewer ??= {}
        notif.author.viewer.muted = mutes[notif.author.did] ?? false
      }
      return {
        encoding: 'application/json',
        body: {
          cursor,
          notifications: filtered,
        },
      }
    },
  })

  return server
}

const didsForFeedViewPosts = (feed: FeedViewPost[]): string[] => {
  const dids: string[] = []
  for (const item of feed) {
    dids.push(item.post.author.did)
    if (item.reply) {
      if (isPostView(item.reply.parent)) {
        dids.push(item.reply.parent.author.did)
      }
      if (isPostView(item.reply.root)) {
        dids.push(item.reply.root.author.did)
      }
    }
    if (item.reason && isReasonRepost(item.reason)) {
      dids.push(item.reason.by.did)
    }
  }
  return dedupeStrs(dids)
}

const processFeedViewPostMutes = (
  feed: FeedViewPost[],
  mutes: Record<string, boolean>,
  shouldRemove: (post: FeedViewPost) => boolean,
): FeedViewPost[] => {
  const hydrated: FeedViewPost[] = []
  for (const item of feed) {
    if (shouldRemove(item)) continue
    item.post.author.viewer ??= {}
    item.post.author.viewer.muted = false
    if (item.reply) {
      if (isPostView(item.reply.parent)) {
        item.reply.parent.author.viewer ??= {}
        item.reply.parent.author.viewer.muted =
          mutes[item.reply.parent.author.did] ?? false
      }
      if (isPostView(item.reply.root)) {
        item.reply.root.author.viewer ??= {}
        item.reply.root.author.viewer.muted =
          mutes[item.reply.root.author.did] ?? false
      }
    }
    if (item.reason && isReasonRepost(item.reason)) {
      item.reason.by.viewer ??= {}
      item.reason.by.viewer.muted = mutes[item.reason.by.did] ?? false
    }
    hydrated.push(item)
  }
  return hydrated
}

const didsForThread = (thread: ThreadViewPost): string[] => {
  return dedupeStrs(didsForThreadRecurse(thread))
}

const didsForThreadRecurse = (thread: ThreadViewPost): string[] => {
  let forParent: string[] = []
  let forReplies: string[] = []
  if (isThreadViewPost(thread.parent)) {
    forParent = didsForThread(thread.parent)
  }
  if (thread.replies) {
    forReplies = thread.replies
      .map((reply) => (isThreadViewPost(reply) ? didsForThread(reply) : []))
      .flat()
  }
  return [thread.post.author.did, ...forParent, ...forReplies]
}

const processThreadViewMutes = (
  thread: ThreadViewPost,
  mutes: Record<string, boolean>,
): ThreadViewPost => {
  thread.post.author.viewer ??= {}
  thread.post.author.viewer.muted = mutes[thread.post.author.did] ?? false
  if (isThreadViewPost(thread.parent)) {
    processThreadViewMutes(thread.parent, mutes)
  }
  if (thread.replies) {
    for (const reply of thread.replies) {
      if (isThreadViewPost(reply)) {
        processThreadViewMutes(reply, mutes)
      }
    }
  }
  return thread
}
