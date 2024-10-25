import { LexiconDoc, Lexicons } from '@atproto/lexicon'
import { DuplexOptions } from 'node:stream'
import { createWebSocketStream, WebSocket } from 'ws'

import { getDecoder } from './decoder.js'
import { buildUrl, EndpointOptions } from './endpoint.js'
import {
  AccountEvent,
  CommitEvent,
  EventBase,
  IdentityEvent,
  isAccountEvent,
  isCommitCreate,
  isCommitDelete,
  isCommitEvent,
  isCommitUpdate,
  isIdentityEvent,
} from './events.js'
import { RecordId, InferRecord } from './lexicon-infer.js'

export type JetstreamOptions<
  Schemas extends readonly LexiconDoc[],
  Collections extends RecordId<Schemas>,
> = DuplexOptions &
  Omit<EndpointOptions, 'wantedCollections'> & {
    schemas: Schemas
    /**
     * @default all the record collections defined in the schemas
     */
    wantedCollections?: Collections[]
  }

export function jetstream<
  const Schemas extends readonly LexiconDoc[],
  Collections extends RecordId<Schemas> = RecordId<Schemas>,
>(
  options: JetstreamOptions<Schemas, Collections>,
): AsyncGenerator<
  AccountEvent | IdentityEvent | CommitEvent<InferRecord<Schemas, Collections>>
>

export async function* jetstream({
  schemas,
  compress = true,
  wantedCollections = schemas
    .filter((l) => l['defs']?.['main']?.['type'] === 'record')
    .map((l) => l.id),
  ...options
}: DuplexOptions &
  EndpointOptions & {
    schemas: readonly LexiconDoc[]
  }): AsyncGenerator<AccountEvent | IdentityEvent | CommitEvent> {
  const lexicons = new Lexicons(schemas)

  for (const collection of wantedCollections) {
    lexicons.getDefOrThrow(collection)
  }

  const decoder = compress ? await getDecoder() : null

  // @TODO: add error handling

  const url = buildUrl({ ...options, compress, wantedCollections })
  const ws = new WebSocket(url)

  for await (const bytes of createWebSocketStream(ws, {
    ...options,
    readableObjectMode: true,
  })) {
    const decoded = decoder ? await decoder.decode(bytes) : bytes

    const event = JSON.parse(decoded.toString()) as EventBase

    if (isCommitEvent(event)) {
      if (isCommitDelete(event.commit)) {
        yield event
      } else if (isCommitCreate(event.commit) || isCommitUpdate(event.commit)) {
        const { collection, record } = event.commit
        if (lexicons.validate(collection, record).success) {
          yield event
        } else {
          // record does not match schema, ignore to ensure type safety
        }
      } else {
        // unknown operation (not supported)
      }
    } else if (isAccountEvent(event) || isIdentityEvent(event)) {
      yield event
    } else {
      // unknown event (not supported)
    }
  }
}
