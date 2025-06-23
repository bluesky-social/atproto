import { LexValue, stringifyLex } from '@atproto/lexicon'
import { BsyncClient } from './bsync'
import { lexicons } from './lexicon/lexicons'
import {
  Preferences,
  Seen,
  SubjectActivitySubscription,
} from './lexicon/types/app/bsky/notification/defs'
import { Method } from './proto/bsync_pb'

type Namespace<T extends { $type?: string }> = Exclude<T['$type'], undefined>

export const NamespaceAppBskyNotificationDefsPreferences: Namespace<Preferences> =
  'app.bsky.notification.defs#preferences'

export const NamespaceAppBskyNotificationDefsSeen: Namespace<Seen> =
  'app.bsky.notification.defs#seen'

export const NamespaceAppBskyNotificationDefsSubjectActivitySubscription: Namespace<SubjectActivitySubscription> =
  'app.bsky.notification.defs#subjectActivitySubscription'

export type StashNamespace =
  | typeof NamespaceAppBskyNotificationDefsPreferences
  | typeof NamespaceAppBskyNotificationDefsSeen
  | typeof NamespaceAppBskyNotificationDefsSubjectActivitySubscription

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

  private validateLexicon(namespace: string, payload: LexValue) {
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
  namespace: string
  key: string
  payload: LexValue | undefined
}

type CreateInput = {
  actorDid: string
  namespace: string
  key: string
  payload: LexValue
}

type UpdateInput = CreateInput

type DeleteInput = {
  actorDid: string
  namespace: string
  key: string
}
