import { LexValue, stringifyLex } from '@atproto/lexicon'
import { BsyncClient } from './bsync'
import { lexicons } from './lexicon/lexicons'
import { Event as AgeAssuranceEventV2 } from './lexicon/types/app/bsky/ageassurance/defs'
import { Bookmark } from './lexicon/types/app/bsky/bookmark/defs'
import { Notification } from './lexicon/types/app/bsky/contact/defs'
import { DraftWithId } from './lexicon/types/app/bsky/draft/defs'
import {
  Preferences,
  SubjectActivitySubscription,
} from './lexicon/types/app/bsky/notification/defs'
import { AgeAssuranceEvent } from './lexicon/types/app/bsky/unspecced/defs'
import { Method } from './proto/bsync_pb'

type PickNSID<T extends { $type?: string }> = Exclude<T['$type'], undefined>

export const Namespaces = {
  AppBskyAgeassuranceDefsEvent:
    'app.bsky.ageassurance.defs#event' satisfies PickNSID<AgeAssuranceEventV2>,
  AppBskyBookmarkDefsBookmark:
    'app.bsky.bookmark.defs#bookmark' satisfies PickNSID<Bookmark>,
  AppBskyContactDefsNotification:
    'app.bsky.contact.defs#notification' satisfies PickNSID<Notification>,
  AppBskyDraftDefsDraftWithId:
    'app.bsky.draft.defs#draftWithId' satisfies PickNSID<DraftWithId>,
  AppBskyNotificationDefsPreferences:
    'app.bsky.notification.defs#preferences' satisfies PickNSID<Preferences>,
  AppBskyNotificationDefsSubjectActivitySubscription:
    'app.bsky.notification.defs#subjectActivitySubscription' satisfies PickNSID<SubjectActivitySubscription>,
  AppBskyUnspeccedDefsAgeAssuranceEvent:
    'app.bsky.unspecced.defs#ageAssuranceEvent' satisfies PickNSID<AgeAssuranceEvent>,
}

export type Namespace = (typeof Namespaces)[keyof typeof Namespaces]

export const createStashClient = (bsyncClient: BsyncClient): StashClient => {
  return new StashClient(bsyncClient)
}

// An abstraction over the BsyncClient, that uses the bsync `PutOperation` RPC
// to store private data, which can be indexed by the dataplane and queried by the appview.
export class StashClient {
  constructor(private readonly bsyncClient: BsyncClient) {}

  create(input: CreateInput) {
    this.validateLexicon(input.namespace, input.payload)
    return this.putOperation(Method.CREATE, input)
  }

  update(input: UpdateInput) {
    this.validateLexicon(input.namespace, input.payload)
    return this.putOperation(Method.UPDATE, input)
  }

  delete(input: DeleteInput) {
    return this.putOperation(Method.DELETE, { ...input, payload: undefined })
  }

  private validateLexicon(namespace: Namespace, payload: LexValue) {
    const result = lexicons.validate(namespace, payload)
    if (!result.success) {
      throw result.error
    }
  }

  private async putOperation(method: Method, input: PutOperationInput) {
    const { actorDid, namespace, key, payload } = input
    await this.bsyncClient.putOperation({
      actorDid,
      namespace,
      key,
      method,
      payload: payload
        ? Buffer.from(
            stringifyLex({
              $type: namespace,
              ...payload,
            }),
          )
        : undefined,
    })
  }
}

type PutOperationInput = {
  actorDid: string
  namespace: Namespace
  key: string
  payload: LexValue | undefined
}

type CreateInput = {
  actorDid: string
  namespace: Namespace
  key: string
  payload: LexValue
}

type UpdateInput = CreateInput

type DeleteInput = {
  actorDid: string
  namespace: Namespace
  key: string
}
