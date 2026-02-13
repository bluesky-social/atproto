import { LexMap, TypedObjectSchema, lexStringify } from '@atproto/lex'
import { BsyncClient } from './bsync'
import { app } from './lexicons/index.js'
import { Method } from './proto/bsync_pb'

export const Namespaces = {
  AppBskyAgeassuranceDefsEvent: app.bsky.ageassurance.defs.event,
  AppBskyBookmarkDefsBookmark: app.bsky.bookmark.defs.bookmark,
  AppBskyContactDefsNotification: app.bsky.contact.defs.notification,
  AppBskyDraftDefsDraftWithId: app.bsky.draft.defs.draftWithId,
  AppBskyNotificationDefsPreferences: app.bsky.notification.defs.preferences,
  AppBskyNotificationDefsSubjectActivitySubscription:
    app.bsky.notification.defs.subjectActivitySubscription,
  AppBskyUnspeccedDefsAgeAssuranceEvent:
    app.bsky.unspecced.defs.ageAssuranceEvent,
} satisfies Record<string, TypedObjectSchema>

export type Namespace = (typeof Namespaces)[keyof typeof Namespaces]

export const createStashClient = (bsyncClient: BsyncClient): StashClient => {
  return new StashClient(bsyncClient)
}

// An abstraction over the BsyncClient, that uses the bsync `PutOperation` RPC
// to store private data, which can be indexed by the dataplane and queried by the appview.
export class StashClient {
  constructor(private readonly bsyncClient: BsyncClient) {}

  create(input: CreateInput) {
    input.namespace.assert(input.payload)
    return this.putOperation(Method.CREATE, input)
  }

  update(input: UpdateInput) {
    input.namespace.assert(input.payload)
    return this.putOperation(Method.UPDATE, input)
  }

  delete(input: DeleteInput) {
    return this.putOperation(Method.DELETE, { ...input, payload: undefined })
  }

  private async putOperation(
    method: Method,
    input: {
      actorDid: string
      namespace: TypedObjectSchema
      key: string
      payload: LexMap | undefined
    },
  ) {
    const { actorDid, namespace, key, payload } = input
    await this.bsyncClient.putOperation({
      actorDid,
      namespace: namespace.$type,
      key,
      method,
      payload: payload
        ? Buffer.from(lexStringify({ ...payload, $type: namespace.$type }))
        : undefined,
    })
  }
}

type CreateInput = {
  actorDid: string
  namespace: Namespace
  key: string
  payload: LexMap
}

type UpdateInput = CreateInput

type DeleteInput = {
  actorDid: string
  namespace: Namespace
  key: string
}
