import { dedupeStrs } from '@atproto/common'
import { DataPlaneClient } from '../data-plane/client'
import { Database } from '../data-plane/server/db'
import { Actor, Actors, ProfileViewerState, ProfileViewerStates } from './actor'
import {
  FeedItem,
  Post,
  PostViewerState,
  PostViewerStates,
  Posts,
} from './feed'
import { HydrateCtx, HydrationMap, HydrationState, mergeStates } from './util'

export type { HydrateCtx, HydrationState } from './util'
export { mergeStates } from './util'

export class Hydrator {
  constructor(
    public dataplane: DataPlaneClient,
    private db?: Database,
  ) {}

  createContext(vals: {
    viewer?: string | null
    includeTakedowns?: boolean
  }): HydrateCtx {
    return {
      viewer: vals.viewer ?? null,
      includeTakedowns: vals.includeTakedowns,
    }
  }

  async getDids(actors: string[]): Promise<(string | undefined)[]> {
    return Promise.all(
      actors.map(async (actor) => {
        if (actor.startsWith('did:')) {
          return actor
        }
        if (!this.db) {
          return undefined
        }
        const row = await this.db.db
          .selectFrom('actor')
          .where('handle', '=', actor.toLowerCase())
          .select('did')
          .executeTakeFirst()
        return row?.did
      }),
    )
  }

  async getActors(dids: string[], includeMissing = false): Promise<Actors> {
    const actors = new HydrationMap<Actor>()
    if (dids.length === 0) {
      return actors
    }
    const res = await this.dataplane.getActors({ dids })
    for (let i = 0; i < dids.length; i++) {
      const did = dids[i]
      const info = res.actors[i]
      if (!info?.exists) {
        if (includeMissing) {
          actors.set(did, null)
        }
        continue
      }
      actors.set(did, {
        did,
        handle: info.handle,
        displayName: info.displayName,
        description: info.description,
        avatarCid: info.avatarCid,
        bannerCid: info.bannerCid,
        followersCount: info.followersCount,
        postsCount: info.postsCount,
        upstreamStatus: info.upstreamStatus,
        indexedAt: info.indexedAt,
      })
    }
    return actors
  }

  async hydrateFeedItems(
    items: FeedItem[],
    ctx: HydrateCtx,
  ): Promise<HydrationState> {
    const uris = dedupeStrs(items.map((item) => item.post.uri))
    const posts = await this.getPosts(uris)
    const creatorDids = dedupeStrs(
      [...posts.values()]
        .filter((post): post is Post => !!post)
        .map((post) => post.creator),
    )
    const actors = await this.getActors(creatorDids)

    let postViewers: PostViewerStates | undefined
    if (ctx.viewer) {
      postViewers = await this.getPostViewerStates(
        ctx.viewer,
        items.map((item) => item.post),
      )
    }

    return {
      ctx,
      posts,
      actors,
      postViewers,
    }
  }

  async hydrateProfile(
    dids: string[],
    ctx: HydrateCtx,
  ): Promise<HydrationState> {
    const actors = await this.getActors(dids)
    let profileViewers: ProfileViewerStates | undefined
    if (ctx.viewer) {
      profileViewers = await this.getProfileViewerStates(ctx.viewer, dids)
    }
    return {
      ctx,
      actors,
      profileViewers,
    }
  }

  private async getPosts(uris: string[]): Promise<Posts> {
    const posts = new HydrationMap<Post>()
    if (uris.length === 0) {
      return posts
    }
    const res = await this.dataplane.getPosts({ uris })
    for (let i = 0; i < uris.length; i++) {
      const uri = uris[i]
      const info = res.posts[i]
      if (!info?.exists || !info.cid) {
        posts.set(uri, null)
        continue
      }
      let mediaJson: unknown
      if (info.mediaJson) {
        try {
          mediaJson = JSON.parse(info.mediaJson)
        } catch {
          mediaJson = undefined
        }
      }
      posts.set(uri, {
        uri: info.uri ?? uri,
        cid: info.cid,
        creator: info.creator ?? '',
        caption: info.caption,
        mediaType: info.mediaType,
        mediaJson,
        likeCount: info.likeCount ?? 0,
        createdAt: info.createdAt ?? '',
        indexedAt: info.indexedAt ?? '',
      })
    }
    return posts
  }

  private async getPostViewerStates(
    viewer: string,
    refs: { uri: string; cid?: string }[],
  ): Promise<PostViewerStates> {
    const postViewers = new HydrationMap<PostViewerState>()
    if (refs.length === 0) {
      return postViewers
    }
    const res = await this.dataplane.getLikesByActorAndSubjects({
      actorDid: viewer,
      refs: refs.map((ref) => ({ uri: ref.uri, cid: ref.cid ?? '' })),
    })
    for (let i = 0; i < refs.length; i++) {
      const uri = refs[i].uri
      const likeUri = res.uris[i]
      postViewers.set(uri, likeUri ? { like: likeUri } : {})
    }
    return postViewers
  }

  private async getProfileViewerStates(
    viewer: string,
    targetDids: string[],
  ): Promise<ProfileViewerStates> {
    const profileViewers = new HydrationMap<ProfileViewerState>()
    if (targetDids.length === 0) {
      return profileViewers
    }
    const [followingRes, followedByRes] = await Promise.all([
      this.dataplane.getActorFollowsActors({
        actorDid: viewer,
        targetDids,
      }),
      Promise.all(
        targetDids.map((targetDid) =>
          this.dataplane.getActorFollowsActors({
            actorDid: targetDid,
            targetDids: [viewer],
          }),
        ),
      ),
    ])
    for (let i = 0; i < targetDids.length; i++) {
      const did = targetDids[i]
      const following = followingRes.uris[i]
      const followedBy = followedByRes[i]?.uris[0]
      profileViewers.set(did, {
        following: following || undefined,
        followedBy: followedBy || undefined,
      })
    }
    return profileViewers
  }
}

export { mergeStates as mergeHydrationStates }
