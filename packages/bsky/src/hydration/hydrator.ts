import assert from 'assert'
import { mapDefined } from '@atproto/common'
import { AtUri } from '@atproto/syntax'
import { DataPlaneClient } from '../data-plane/client'
import { Notification } from '../proto/bsky_pb'
import { ids } from '../lexicon/lexicons'
import { isMain as isEmbedRecord } from '../lexicon/types/app/bsky/embed/record'
import { isMain as isEmbedRecordWithMedia } from '../lexicon/types/app/bsky/embed/recordWithMedia'
import { isListRule } from '../lexicon/types/app/bsky/feed/threadgate'
import {
  ActorHydrator,
  ProfileAggs,
  Actors,
  ProfileViewerStates,
  ProfileViewerState,
} from './actor'
import {
  Follows,
  GraphHydrator,
  ListItems,
  ListViewerStates,
  Lists,
  RelationshipPair,
} from './graph'
import {
  LabelHydrator,
  LabelerAggs,
  LabelerViewerStates,
  Labelers,
  Labels,
} from './label'
import {
  HydrationMap,
  Merges,
  RecordInfo,
  didFromUri,
  urisByCollection,
} from './util'
import {
  FeedGenAggs,
  FeedGens,
  FeedGenViewerStates,
  FeedHydrator,
  Likes,
  Post,
  Posts,
  Reposts,
  PostAggs,
  PostViewerStates,
  Threadgates,
  FeedItem,
  ItemRef,
} from './feed'
import { ParsedLabelers } from '../util'

export class HydrateCtx {
  labelers = this.vals.labelers
  viewer = this.vals.viewer !== null ? serviceRefToDid(this.vals.viewer) : null
  includeTakedowns = this.vals.includeTakedowns
  constructor(private vals: HydrateCtxVals) {}
  copy<V extends Partial<HydrateCtxVals>>(vals?: V): HydrateCtx & V {
    return new HydrateCtx({ ...this.vals, ...vals }) as HydrateCtx & V
  }
}

export type HydrateCtxVals = {
  labelers: ParsedLabelers
  viewer: string | null
  includeTakedowns?: boolean
}

export type HydrationState = {
  ctx?: HydrateCtx
  actors?: Actors
  profileViewers?: ProfileViewerStates
  profileAggs?: ProfileAggs
  posts?: Posts
  postAggs?: PostAggs
  postViewers?: PostViewerStates
  postBlocks?: PostBlocks
  reposts?: Reposts
  follows?: Follows
  followBlocks?: FollowBlocks
  threadgates?: Threadgates
  lists?: Lists
  listViewers?: ListViewerStates
  listItems?: ListItems
  likes?: Likes
  labels?: Labels
  feedgens?: FeedGens
  feedgenViewers?: FeedGenViewerStates
  feedgenAggs?: FeedGenAggs
  labelers?: Labelers
  labelerViewers?: LabelerViewerStates
  labelerAggs?: LabelerAggs
}

export type PostBlock = { embed: boolean; reply: boolean }
export type PostBlocks = HydrationMap<PostBlock>
type PostBlockPairs = { embed?: RelationshipPair; reply?: RelationshipPair }

export type FollowBlock = boolean
export type FollowBlocks = HydrationMap<FollowBlock>

export class Hydrator {
  actor: ActorHydrator
  feed: FeedHydrator
  graph: GraphHydrator
  label: LabelHydrator
  serviceLabelers: Set<string>

  constructor(
    public dataplane: DataPlaneClient,
    serviceLabelers: string[] = [],
  ) {
    this.actor = new ActorHydrator(dataplane)
    this.feed = new FeedHydrator(dataplane)
    this.graph = new GraphHydrator(dataplane)
    this.label = new LabelHydrator(dataplane)
    this.serviceLabelers = new Set(serviceLabelers)
  }

  // app.bsky.actor.defs#profileView
  // - profile viewer
  //   - list basic
  // Note: builds on the naive profile viewer hydrator and removes references to lists that have been deleted
  async hydrateProfileViewers(
    dids: string[],
    ctx: HydrateCtx,
  ): Promise<HydrationState> {
    const viewer = ctx.viewer
    if (!viewer) return {}
    const profileViewers = await this.actor.getProfileViewerStatesNaive(
      dids,
      viewer,
    )
    const listUris: string[] = []
    profileViewers?.forEach((item) => {
      listUris.push(...listUrisFromProfileViewer(item))
    })
    const listState = await this.hydrateListsBasic(listUris, ctx)
    // if a list no longer exists or is not a mod list, then remove from viewer state
    profileViewers?.forEach((item) => {
      removeNonModListsFromProfileViewer(item, listState)
    })
    return mergeStates(listState, {
      profileViewers,
      ctx,
    })
  }

  // app.bsky.actor.defs#profileView
  // - profile
  //   - list basic
  async hydrateProfiles(
    dids: string[],
    ctx: HydrateCtx,
  ): Promise<HydrationState> {
    const [actors, labels, profileViewersState] = await Promise.all([
      this.actor.getActors(dids, ctx.includeTakedowns),
      this.label.getLabelsForSubjects(labelSubjectsForDid(dids), ctx.labelers),
      this.hydrateProfileViewers(dids, ctx),
    ])
    if (!ctx.includeTakedowns) {
      actionTakedownLabels(dids, actors, labels)
    }
    return mergeStates(profileViewersState ?? {}, {
      actors,
      labels,
      ctx,
    })
  }

  // app.bsky.actor.defs#profileViewBasic
  // - profile basic
  //   - profile
  //     - list basic
  async hydrateProfilesBasic(
    dids: string[],
    ctx: HydrateCtx,
  ): Promise<HydrationState> {
    return this.hydrateProfiles(dids, ctx)
  }

  // app.bsky.actor.defs#profileViewDetailed
  // - profile detailed
  //   - profile
  //     - list basic
  async hydrateProfilesDetailed(
    dids: string[],
    ctx: HydrateCtx,
  ): Promise<HydrationState> {
    const [state, profileAggs] = await Promise.all([
      this.hydrateProfiles(dids, ctx),
      this.actor.getProfileAggregates(dids),
    ])
    return {
      ...state,
      profileAggs,
    }
  }

  // app.bsky.graph.defs#listView
  // - list
  //   - profile basic
  async hydrateLists(uris: string[], ctx: HydrateCtx): Promise<HydrationState> {
    const [listsState, profilesState] = await Promise.all([
      await this.hydrateListsBasic(uris, ctx),
      await this.hydrateProfilesBasic(uris.map(didFromUri), ctx),
    ])

    return mergeStates(listsState, profilesState)
  }

  // app.bsky.graph.defs#listViewBasic
  // - list basic
  async hydrateListsBasic(
    uris: string[],
    ctx: HydrateCtx,
  ): Promise<HydrationState> {
    const [lists, listViewers, labels] = await Promise.all([
      this.graph.getLists(uris, ctx.includeTakedowns),
      ctx.viewer ? this.graph.getListViewerStates(uris, ctx.viewer) : undefined,
      this.label.getLabelsForSubjects(uris, ctx.labelers),
    ])

    if (!ctx.includeTakedowns) {
      actionTakedownLabels(uris, lists, labels)
    }

    return { lists, listViewers, labels, ctx }
  }

  // app.bsky.graph.defs#listItemView
  // - list item
  //   - profile
  //     - list basic
  async hydrateListItems(
    uris: string[],
    ctx: HydrateCtx,
  ): Promise<HydrationState> {
    const listItems = await this.graph.getListItems(uris)
    const dids: string[] = []
    listItems.forEach((item) => {
      if (item) {
        dids.push(item.record.subject)
      }
    })
    const profileState = await this.hydrateProfiles(dids, ctx)
    return mergeStates(profileState, { listItems, ctx })
  }

  // app.bsky.feed.defs#postView
  // - post
  //   - profile
  //     - list basic
  //   - list
  //     - profile
  //       - list basic
  //   - feedgen
  //     - profile
  //       - list basic
  //   - mod service
  //     - profile
  //       - list basic
  async hydratePosts(
    refs: ItemRef[],
    ctx: HydrateCtx,
    state: HydrationState = {},
  ): Promise<HydrationState> {
    const uris = refs.map((ref) => ref.uri)
    const postsLayer0 = await this.feed.getPosts(
      uris,
      ctx.includeTakedowns,
      state.posts,
    )
    // first level embeds plus thread roots we haven't fetched yet
    const urisLayer1 = nestedRecordUrisFromPosts(postsLayer0)
    const additionalRootUris = rootUrisFromPosts(postsLayer0) // supports computing threadgates
    const urisLayer1ByCollection = urisByCollection(urisLayer1)
    const postUrisLayer1 = urisLayer1ByCollection.get(ids.AppBskyFeedPost) ?? []
    const postsLayer1 = await this.feed.getPosts(
      [...postUrisLayer1, ...additionalRootUris],
      ctx.includeTakedowns,
    )
    // second level embeds, ignoring any additional root uris we mixed-in to the previous layer
    const urisLayer2 = nestedRecordUrisFromPosts(postsLayer1, postUrisLayer1)
    const urisLayer2ByCollection = urisByCollection(urisLayer2)
    const postUrisLayer2 = urisLayer2ByCollection.get(ids.AppBskyFeedPost) ?? []
    const threadRootUris = new Set<string>()
    for (const [uri, post] of postsLayer0) {
      if (post) {
        threadRootUris.add(rootUriFromPost(post) ?? uri)
      }
    }
    const [postsLayer2, threadgates] = await Promise.all([
      this.feed.getPosts(postUrisLayer2, ctx.includeTakedowns),
      this.feed.getThreadgatesForPosts([...threadRootUris.values()]),
    ])
    // collect list/feedgen embeds, lists in threadgates, post record hydration
    const gateListUris = getListUrisFromGates(threadgates)
    const nestedListUris = [
      ...(urisLayer1ByCollection.get(ids.AppBskyGraphList) ?? []),
      ...(urisLayer2ByCollection.get(ids.AppBskyGraphList) ?? []),
    ]
    const nestedFeedGenUris = [
      ...(urisLayer1ByCollection.get(ids.AppBskyFeedGenerator) ?? []),
      ...(urisLayer2ByCollection.get(ids.AppBskyFeedGenerator) ?? []),
    ]
    const nestedLabelerDids = [
      ...(urisLayer1ByCollection.get(ids.AppBskyLabelerService) ?? []),
      ...(urisLayer2ByCollection.get(ids.AppBskyLabelerService) ?? []),
    ].map((uri) => new AtUri(uri).hostname)
    const posts =
      mergeManyMaps(postsLayer0, postsLayer1, postsLayer2) ?? postsLayer0
    const allPostUris = [...posts.keys()]
    const [
      postAggs,
      postViewers,
      labels,
      postBlocks,
      profileState,
      listState,
      feedGenState,
      labelerState,
    ] = await Promise.all([
      this.feed.getPostAggregates([
        ...refs,
        ...postUrisLayer1.map(uriToRef), // supports aggregates on embed #viewRecords
        ...postUrisLayer2.map(uriToRef),
      ]),
      ctx.viewer ? this.feed.getPostViewerStates(refs, ctx.viewer) : undefined,
      this.label.getLabelsForSubjects(allPostUris, ctx.labelers),
      this.hydratePostBlocks(posts),
      this.hydrateProfiles(allPostUris.map(didFromUri), ctx),
      this.hydrateLists([...nestedListUris, ...gateListUris], ctx),
      this.hydrateFeedGens(nestedFeedGenUris, ctx),
      this.hydrateLabelers(nestedLabelerDids, ctx),
    ])
    if (!ctx.includeTakedowns) {
      actionTakedownLabels(allPostUris, posts, labels)
    }
    // combine all hydration state
    return mergeManyStates(
      profileState,
      listState,
      feedGenState,
      labelerState,
      {
        posts,
        postAggs,
        postViewers,
        postBlocks,
        labels,
        threadgates,
        ctx,
      },
    )
  }

  private async hydratePostBlocks(posts: Posts): Promise<PostBlocks> {
    const postBlocks = new HydrationMap<PostBlock>()
    const postBlocksPairs = new Map<string, PostBlockPairs>()
    const relationships: RelationshipPair[] = []
    for (const [uri, item] of posts) {
      if (!item) continue
      const post = item.record
      const creator = didFromUri(uri)
      const postBlockPairs: PostBlockPairs = {}
      postBlocksPairs.set(uri, postBlockPairs)
      // 3p block for replies
      const parentUri = post.reply?.parent.uri
      const parentDid = parentUri && didFromUri(parentUri)
      if (parentDid) {
        const pair: RelationshipPair = [creator, parentDid]
        relationships.push(pair)
        postBlockPairs.reply = pair
      }
      // 3p block for record embeds
      for (const embedUri of nestedRecordUris(post)) {
        const pair: RelationshipPair = [creator, didFromUri(embedUri)]
        relationships.push(pair)
        postBlockPairs.embed = pair
      }
    }
    // replace embed/reply pairs with block state
    const blocks = await this.graph.getBidirectionalBlocks(relationships)
    for (const [uri, { embed, reply }] of postBlocksPairs) {
      postBlocks.set(uri, {
        embed: !!embed && blocks.isBlocked(...embed),
        reply: !!reply && blocks.isBlocked(...reply),
      })
    }
    return postBlocks
  }

  // app.bsky.feed.defs#feedViewPost
  // - post (+ replies w/ reply parent author)
  //   - profile
  //     - list basic
  //   - list
  //     - profile
  //       - list basic
  //   - feedgen
  //     - profile
  //       - list basic
  // - repost
  //   - profile
  //     - list basic
  //   - post
  //     - ...
  async hydrateFeedItems(
    items: FeedItem[],
    ctx: HydrateCtx,
  ): Promise<HydrationState> {
    // get posts, collect reply refs
    const posts = await this.feed.getPosts(
      items.map((item) => item.post.uri),
      ctx.includeTakedowns,
    )
    const rootUris: string[] = []
    const parentUris: string[] = []
    const postAndReplyRefs: ItemRef[] = []
    posts.forEach((post, uri) => {
      if (!post) return
      postAndReplyRefs.push({ uri, cid: post.cid })
      if (post.record.reply) {
        rootUris.push(post.record.reply.root.uri)
        parentUris.push(post.record.reply.parent.uri)
        postAndReplyRefs.push(post.record.reply.root, post.record.reply.parent)
      }
    })
    // get replies, collect reply parent authors
    const replies = await this.feed.getPosts(
      [...rootUris, ...parentUris],
      ctx.includeTakedowns,
    )
    const replyParentAuthors: string[] = []
    parentUris.forEach((uri) => {
      const parent = replies.get(uri)
      if (!parent?.record.reply) return
      replyParentAuthors.push(didFromUri(parent.record.reply.parent.uri))
    })
    // hydrate state for all posts, reposts, authors of reposts + reply parent authors
    const repostUris = mapDefined(items, (item) => item.repost?.uri)
    const [postState, repostProfileState, reposts] = await Promise.all([
      this.hydratePosts(postAndReplyRefs, ctx, {
        posts: posts.merge(replies), // avoids refetches of posts
      }),
      this.hydrateProfiles(
        [...repostUris.map(didFromUri), ...replyParentAuthors],
        ctx,
      ),
      this.feed.getReposts(repostUris, ctx.includeTakedowns),
    ])
    return mergeManyStates(postState, repostProfileState, {
      reposts,
      ctx,
    })
  }

  // app.bsky.feed.defs#threadViewPost
  // - post
  //   - profile
  //     - list basic
  //   - list
  //     - profile
  //       - list basic
  //   - feedgen
  //     - profile
  //       - list basic
  async hydrateThreadPosts(
    refs: ItemRef[],
    ctx: HydrateCtx,
  ): Promise<HydrationState> {
    return this.hydratePosts(refs, ctx)
  }

  // app.bsky.feed.defs#generatorView
  // - feedgen
  //   - profile
  //     - list basic
  async hydrateFeedGens(
    uris: string[], // @TODO any way to get refs here?
    ctx: HydrateCtx,
  ): Promise<HydrationState> {
    const [feedgens, feedgenAggs, feedgenViewers, profileState, labels] =
      await Promise.all([
        this.feed.getFeedGens(uris, ctx.includeTakedowns),
        this.feed.getFeedGenAggregates(uris.map((uri) => ({ uri }))),
        ctx.viewer
          ? this.feed.getFeedGenViewerStates(uris, ctx.viewer)
          : undefined,
        this.hydrateProfiles(uris.map(didFromUri), ctx),
        this.label.getLabelsForSubjects(uris, ctx.labelers),
      ])
    if (!ctx.includeTakedowns) {
      actionTakedownLabels(uris, feedgens, labels)
    }
    return mergeStates(profileState, {
      feedgens,
      feedgenAggs,
      feedgenViewers,
      labels,
      ctx,
    })
  }

  // app.bsky.feed.getLikes#like
  // - like
  //   - profile
  //     - list basic
  async hydrateLikes(uris: string[], ctx: HydrateCtx): Promise<HydrationState> {
    const [likes, profileState] = await Promise.all([
      this.feed.getLikes(uris),
      this.hydrateProfiles(uris.map(didFromUri), ctx),
    ])
    return mergeStates(profileState, { likes, ctx })
  }

  // app.bsky.feed.getRepostedBy#repostedBy
  // - repost
  //   - profile
  //     - list basic
  async hydrateReposts(uris: string[], ctx: HydrateCtx) {
    const [reposts, profileState] = await Promise.all([
      this.feed.getReposts(uris),
      this.hydrateProfiles(uris.map(didFromUri), ctx),
    ])
    return mergeStates(profileState, { reposts, ctx })
  }

  // app.bsky.notification.listNotifications#notification
  // - notification
  //   - profile
  //     - list basic
  async hydrateNotifications(
    notifs: Notification[],
    ctx: HydrateCtx,
  ): Promise<HydrationState> {
    const uris = notifs.map((notif) => notif.uri)
    const collections = urisByCollection(uris)
    const postUris = collections.get(ids.AppBskyFeedPost) ?? []
    const likeUris = collections.get(ids.AppBskyFeedLike) ?? []
    const repostUris = collections.get(ids.AppBskyFeedRepost) ?? []
    const followUris = collections.get(ids.AppBskyGraphFollow) ?? []
    const [posts, likes, reposts, follows, labels, profileState] =
      await Promise.all([
        this.feed.getPosts(postUris), // reason: mention, reply, quote
        this.feed.getLikes(likeUris), // reason: like
        this.feed.getReposts(repostUris), // reason: repost
        this.graph.getFollows(followUris), // reason: follow
        this.label.getLabelsForSubjects(uris, ctx.labelers),
        this.hydrateProfiles(uris.map(didFromUri), ctx),
      ])
    actionTakedownLabels(postUris, posts, labels)
    return mergeStates(profileState, {
      posts,
      likes,
      reposts,
      follows,
      labels,
      ctx,
    })
  }

  // provides partial hydration state withing getFollows / getFollowers, mainly for applying rules
  async hydrateFollows(uris: string[]): Promise<HydrationState> {
    const follows = await this.graph.getFollows(uris)
    const pairs: RelationshipPair[] = []
    for (const [uri, follow] of follows) {
      if (follow) {
        pairs.push([didFromUri(uri), follow.record.subject])
      }
    }
    const blocks = await this.graph.getBidirectionalBlocks(pairs)
    const followBlocks = new HydrationMap<FollowBlock>()
    for (const [uri, follow] of follows) {
      if (follow) {
        followBlocks.set(
          uri,
          blocks.isBlocked(didFromUri(uri), follow.record.subject),
        )
      } else {
        followBlocks.set(uri, null)
      }
    }
    return { follows, followBlocks }
  }

  // app.bsky.labeler.def#labelerViewDetailed
  // - labeler
  //   - profile
  //     - list basic
  async hydrateLabelers(
    dids: string[],
    ctx: HydrateCtx,
  ): Promise<HydrationState> {
    const [labelers, labelerAggs, labelerViewers, profileState] =
      await Promise.all([
        this.label.getLabelers(dids, ctx.includeTakedowns),
        this.label.getLabelerAggregates(dids),
        ctx.viewer
          ? this.label.getLabelerViewerStates(dids, ctx.viewer)
          : undefined,
        this.hydrateProfiles(dids, ctx),
      ])
    actionTakedownLabels(dids, labelers, profileState.labels ?? new Labels())
    return mergeStates(profileState, {
      labelers,
      labelerAggs,
      labelerViewers,
      ctx,
    })
  }

  // ad-hoc record hydration
  // in com.atproto.repo.getRecord
  async getRecord(
    uri: string,
    includeTakedowns = false,
  ): Promise<RecordInfo<Record<string, unknown>> | undefined> {
    const parsed = new AtUri(uri)
    const collection = parsed.collection
    if (collection === ids.AppBskyFeedPost) {
      return (
        (await this.feed.getPosts([uri], includeTakedowns)).get(uri) ??
        undefined
      )
    } else if (collection === ids.AppBskyFeedRepost) {
      return (
        (await this.feed.getReposts([uri], includeTakedowns)).get(uri) ??
        undefined
      )
    } else if (collection === ids.AppBskyFeedLike) {
      return (
        (await this.feed.getLikes([uri], includeTakedowns)).get(uri) ??
        undefined
      )
    } else if (collection === ids.AppBskyGraphFollow) {
      return (
        (await this.graph.getFollows([uri], includeTakedowns)).get(uri) ??
        undefined
      )
    } else if (collection === ids.AppBskyGraphList) {
      return (
        (await this.graph.getLists([uri], includeTakedowns)).get(uri) ??
        undefined
      )
    } else if (collection === ids.AppBskyGraphListitem) {
      return (
        (await this.graph.getListItems([uri], includeTakedowns)).get(uri) ??
        undefined
      )
    } else if (collection === ids.AppBskyGraphBlock) {
      return (
        (await this.graph.getBlocks([uri], includeTakedowns)).get(uri) ??
        undefined
      )
    } else if (collection === ids.AppBskyFeedGenerator) {
      return (
        (await this.feed.getFeedGens([uri], includeTakedowns)).get(uri) ??
        undefined
      )
    } else if (collection === ids.AppBskyLabelerService) {
      if (parsed.rkey !== 'self') return
      const did = parsed.hostname
      return (
        (await this.label.getLabelers([did], includeTakedowns)).get(did) ??
        undefined
      )
    } else if (collection === ids.ChatBskyActorDeclaration) {
      if (parsed.rkey !== 'self') return
      return (
        (await this.actor.getChatDeclarations([uri], includeTakedowns)).get(
          uri,
        ) ?? undefined
      )
    } else if (collection === ids.AppBskyActorProfile) {
      const did = parsed.hostname
      const actor = (await this.actor.getActors([did], includeTakedowns)).get(
        did,
      )
      if (!actor?.profile || !actor?.profileCid) return undefined
      return {
        record: actor.profile,
        cid: actor.profileCid,
        sortedAt: actor.sortedAt ?? new Date(0), // @NOTE will be present since profile record is present
        takedownRef: actor.profileTakedownRef,
      }
    }
  }

  async createContext(vals: HydrateCtxVals) {
    // ensures we're only apply labelers that exist and are not taken down
    const labelers = vals.labelers.dids
    const nonServiceLabelers = labelers.filter(
      (did) => !this.serviceLabelers.has(did),
    )
    const labelerActors = await this.actor.getActors(
      nonServiceLabelers,
      vals.includeTakedowns,
    )
    const availableDids = labelers.filter(
      (did) => this.serviceLabelers.has(did) || !!labelerActors.get(did),
    )
    const availableLabelers = {
      dids: availableDids,
      redact: vals.labelers.redact,
    }
    return new HydrateCtx({
      labelers: availableLabelers,
      viewer: vals.viewer,
      includeTakedowns: vals.includeTakedowns,
    })
  }
}

// service refs may look like "did:plc:example#service_id". we want to extract the did part "did:plc:example".
const serviceRefToDid = (serviceRef: string) => {
  const idx = serviceRef.indexOf('#')
  return idx !== -1 ? serviceRef.slice(0, idx) : serviceRef
}

const listUrisFromProfileViewer = (item: ProfileViewerState | null) => {
  const listUris: string[] = []
  if (item?.mutedByList) {
    listUris.push(item.mutedByList)
  }
  if (item?.blockingByList) {
    listUris.push(item.blockingByList)
  }
  // blocked-by list does not appear in views, but will be used to evaluate the existence of a block between users.
  if (item?.blockedByList) {
    listUris.push(item.blockedByList)
  }
  return listUris
}

const removeNonModListsFromProfileViewer = (
  item: ProfileViewerState | null,
  state: HydrationState,
) => {
  if (!isModList(item?.mutedByList, state)) {
    delete item?.mutedByList
  }
  if (!isModList(item?.blockingByList, state)) {
    delete item?.blockingByList
  }
  if (!isModList(item?.blockedByList, state)) {
    delete item?.blockedByList
  }
}

const isModList = (
  listUri: string | undefined,
  state: HydrationState,
): boolean => {
  if (!listUri) return false
  const list = state.lists?.get(listUri)
  return list?.record.purpose === 'app.bsky.graph.defs#modlist'
}

const labelSubjectsForDid = (dids: string[]) => {
  return [
    ...dids,
    ...dids.map((did) =>
      AtUri.make(did, ids.AppBskyActorProfile, 'self').toString(),
    ),
  ]
}

const rootUrisFromPosts = (posts: Posts): string[] => {
  const uris: string[] = []
  for (const item of posts.values()) {
    const rootUri = item && rootUriFromPost(item)
    if (rootUri) {
      uris.push(rootUri)
    }
  }
  return uris
}

const rootUriFromPost = (post: Post): string | undefined => {
  return post.record.reply?.root.uri
}

const nestedRecordUrisFromPosts = (
  posts: Posts,
  fromUris?: string[],
): string[] => {
  const uris: string[] = []
  const postUris = fromUris ?? posts.keys()
  for (const uri of postUris) {
    const item = posts.get(uri)
    if (item) {
      uris.push(...nestedRecordUris(item.record))
    }
  }
  return uris
}

const nestedRecordUris = (post: Post['record']): string[] => {
  const uris: string[] = []
  if (!post?.embed) return uris
  if (isEmbedRecord(post.embed)) {
    uris.push(post.embed.record.uri)
  } else if (isEmbedRecordWithMedia(post.embed)) {
    uris.push(post.embed.record.record.uri)
  }
  return uris
}

const getListUrisFromGates = (gates: Threadgates) => {
  const uris: string[] = []
  for (const gate of gates.values()) {
    const listRules = gate?.record.allow?.filter(isListRule) ?? []
    for (const rule of listRules) {
      uris.push(rule.list)
    }
  }
  return uris
}

export const mergeStates = (
  stateA: HydrationState,
  stateB: HydrationState,
): HydrationState => {
  assert(
    !stateA.ctx?.viewer ||
      !stateB.ctx?.viewer ||
      stateA.ctx?.viewer === stateB.ctx?.viewer,
    'incompatible viewers',
  )
  return {
    ctx: stateA.ctx ?? stateB.ctx,
    actors: mergeMaps(stateA.actors, stateB.actors),
    profileAggs: mergeMaps(stateA.profileAggs, stateB.profileAggs),
    profileViewers: mergeMaps(stateA.profileViewers, stateB.profileViewers),
    posts: mergeMaps(stateA.posts, stateB.posts),
    postAggs: mergeMaps(stateA.postAggs, stateB.postAggs),
    postViewers: mergeMaps(stateA.postViewers, stateB.postViewers),
    postBlocks: mergeMaps(stateA.postBlocks, stateB.postBlocks),
    reposts: mergeMaps(stateA.reposts, stateB.reposts),
    follows: mergeMaps(stateA.follows, stateB.follows),
    followBlocks: mergeMaps(stateA.followBlocks, stateB.followBlocks),
    threadgates: mergeMaps(stateA.threadgates, stateB.threadgates),
    lists: mergeMaps(stateA.lists, stateB.lists),
    listViewers: mergeMaps(stateA.listViewers, stateB.listViewers),
    listItems: mergeMaps(stateA.listItems, stateB.listItems),
    likes: mergeMaps(stateA.likes, stateB.likes),
    labels: mergeMaps(stateA.labels, stateB.labels),
    feedgens: mergeMaps(stateA.feedgens, stateB.feedgens),
    feedgenAggs: mergeMaps(stateA.feedgenAggs, stateB.feedgenAggs),
    feedgenViewers: mergeMaps(stateA.feedgenViewers, stateB.feedgenViewers),
    labelers: mergeMaps(stateA.labelers, stateB.labelers),
    labelerAggs: mergeMaps(stateA.labelerAggs, stateB.labelerAggs),
    labelerViewers: mergeMaps(stateA.labelerViewers, stateB.labelerViewers),
  }
}

const mergeMaps = <M extends Merges>(mapA?: M, mapB?: M): M | undefined => {
  if (!mapA) return mapB
  if (!mapB) return mapA
  return mapA.merge(mapB)
}

const mergeManyStates = (...states: HydrationState[]) => {
  return states.reduce(mergeStates, {} as HydrationState)
}

const mergeManyMaps = <T>(...maps: HydrationMap<T>[]) => {
  return maps.reduce(mergeMaps, undefined as HydrationMap<T> | undefined)
}

const actionTakedownLabels = <T>(
  keys: string[],
  hydrationMap: HydrationMap<T>,
  labels: Labels,
) => {
  for (const key of keys) {
    if (labels.get(key)?.isTakendown) {
      hydrationMap.set(key, null)
    }
  }
}

const uriToRef = (uri: string): ItemRef => {
  return { uri }
}
