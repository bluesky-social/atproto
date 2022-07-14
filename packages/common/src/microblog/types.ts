import { z } from 'zod'
import TID from '../repo/tid'
import { Follow, schema as repo } from '../repo/types'

// SCHEMAS
// ------------

const post = z.object({
  tid: repo.strToTid,
  author: z.string(),
  namespace: z.string(),
  text: z.string(),
  time: z.string(),
})
export type Post = z.infer<typeof post>

// @TODO move flatten methods to ipld store?
export const flattenPost = (like: Post): Record<string, string | number> => {
  return {
    tid: like.tid.toString(),
    author: like.author,
    namespace: like.namespace,
    text: like.text,
    time: like.time,
  }
}

const like = z.object({
  tid: repo.strToTid,
  author: z.string(),
  namespace: z.string(),
  time: z.string(),
  post_tid: repo.strToTid,
  post_author: z.string(),
  post_namespace: z.string(),
})
export type Like = z.infer<typeof like>

export const flattenLike = (like: Like): Record<string, string | number> => {
  return {
    tid: like.tid.toString(),
    author: like.author,
    namespace: like.namespace,
    time: like.time,
    post_tid: like.post_tid.toString(),
    post_author: like.post_author,
    post_namespace: like.post_namespace,
  }
}

const timelinePost = z.object({
  tid: repo.strToTid,
  author: z.string(),
  author_name: z.string(),
  text: z.string(),
  time: z.string(),
  likes: z.number(),
})
export type TimelinePost = z.infer<typeof timelinePost>

const timeline = z.array(timelinePost)
export type Timeline = z.infer<typeof timeline>

const accountInfo = z.object({
  did: z.string(),
  username: z.string(),
  postCount: z.number(),
  followerCount: z.number(),
  followCount: z.number(),
})
export type AccountInfo = z.infer<typeof accountInfo>

export const schema = {
  post,
  like,
  timelinePost,
  timeline,
  accountInfo,
}

// INTERFACES
// ------------

export interface MicroblogClient extends MicroblogReaderI {
  did: string
  register(name: string): Promise<void>
  addPost(text: string): Promise<Post>
  editPost(tid: TID, text: string): Promise<void>
  deletePost(tid: TID): Promise<void>
  followUser(nameOrDid: string): Promise<void>
  unfollowUser(nameOrDid: string): Promise<void>
  likePost(postAuthorNameOrDid: string, postTid: TID): Promise<Like>
  deleteLike(tid: TID): Promise<void>
  unlikePost(authorNameOrDid: string, postTid: TID): Promise<void>
  export(): Promise<Uint8Array>
}

export interface MicroblogReaderI {
  ownDid(): string
  getOwnServerDid(): Promise<string>
  getServerDid(url: string): Promise<string>
  resolveUser(
    nameOrDid: string,
  ): Promise<{ username: string; did: string; hostUrl: string }>
  resolveDid(nameOrDid: string): Promise<string>
  resolveUsername(nameOrDid: string): Promise<string>
  lookupDid(username: string): Promise<string | null>
  lookupUsername(did: string): Promise<string | null>
  normalizeUsername(username: string): { name: string; hostUrl: string }

  getAccountInfo(nameOrDid: string): Promise<AccountInfo | null>
  retrieveFeed(
    nameOrDid: string,
    count: number,
    from?: TID,
  ): Promise<Timeline | null>
  retrieveTimeline(count: number, from?: TID): Promise<Timeline>

  getPostInfo(nameOrDid: string, tid: TID): Promise<TimelinePost | null>
  getPost(tid: TID): Promise<Post | null>
  getPostFromUser(nameOrDid: string, tid: TID): Promise<Post | null>
  listPosts(count: number, from?: TID): Promise<Post[]>
  listPostsFromUser(
    nameOrDid: string,
    count: number,
    from?: TID,
  ): Promise<Post[]>

  listFollows(): Promise<Follow[]>
  listFollowsFromUser(nameOrDid: string): Promise<Follow[]>
  listFollowers(): Promise<Follow[]>
  listFollowersForUser(nameOrDid: string): Promise<Follow[]>

  getLikeByPost(authorNameOrDid: string, postTid: TID): Promise<Like | null>
  getLikeByPostForUser(
    userNameOrDid: string,
    authorNameOrDid: string,
    postTid: TID,
  ): Promise<Like | null>
  listLikesFromUser(
    nameOrDid: string,
    count: number,
    from?: TID,
  ): Promise<Like[]>
}
