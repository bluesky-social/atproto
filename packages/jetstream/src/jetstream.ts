import { LexiconDoc, Lexicons } from '@atproto/lexicon'
import { DuplexOptions } from 'node:stream'
import { createWebSocketStream, WebSocket } from 'ws'

import { getDecoder } from './decoder.js'
import { buildUrl, EndpointOptions } from './endpoint.js'
import {
  AccountEvent,
  CommitEvent,
  CommitOperation,
  IdentityEvent,
  isAccountEvent,
  isCommitEvent,
  isIdentityEvent,
  UnknownEvent,
} from './events.js'
import { InferRecord, RecordId } from './lexicon-infer.js'

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
    lexicons.getDefOrThrow(collection, ['record'])
  }

  const decoder = compress ? await getDecoder() : null

  // @TODO: add error handling & retries

  const url = buildUrl({ ...options, compress, wantedCollections })
  const ws = new WebSocket(url)

  for await (const bytes of createWebSocketStream(ws, {
    ...options,
    readableObjectMode: true,
  })) {
    const decoded = decoder ? await decoder.decode(bytes) : bytes

    const event = JSON.parse(decoded.toString()) as UnknownEvent

    if (isAccountEvent(event)) {
      yield event
    } else if (isIdentityEvent(event)) {
      yield event
    } else if (isCommitEvent(event)) {
      const { commit } = event

      if (commit.operation === CommitOperation.Delete) {
        yield event
      } else if (
        commit.operation === CommitOperation.Create ||
        commit.operation === CommitOperation.Update
      ) {
        const result = lexicons.validate(commit.collection, commit.record)
        commit.recordValid = result.success
        yield event
      }
    }
  }
}
