import {
  ExtractRefs,
  Infer,
  InferMethod,
  InferRecord,
  ProcedureId,
  QueryId,
  RecordId,
} from '@atproto/jetstream'
import { schemas } from '@atproto/api'

export type S = typeof schemas
export type I<R extends ExtractRefs<S>> = Infer<S, R>
export type IRecord<R extends RecordId<S>> = InferRecord<S, R>
export type IMethod<R extends ProcedureId<S> | QueryId<S>> = InferMethod<S, R>

// import { Record as Profile } from '../lexicon/types/app/bsky/actor/profile.js'
export type Profile = IRecord<'app.bsky.actor.profile'>
// import { Record as Post } from '../lexicon/types/app/bsky/feed/post.js'
export type Post = IRecord<'app.bsky.feed.post'>
// import { Record as Like } from '../lexicon/types/app/bsky/feed/like.js'
export type Like = IRecord<'app.bsky.feed.like'>

declare const getPosts: IMethod<'app.bsky.feed.getPosts'>

export const posts = await getPosts({
  params: {
    uris: ['at://az'],
  },
})
