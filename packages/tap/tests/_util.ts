import { HandlerOpts } from '../src/channel'
import { IdentityEvent, RecordEvent } from '../src/types'

export type MockOpts = HandlerOpts & { acked: boolean }

export const createMockOpts = (): MockOpts => {
  const opts = {
    signal: new AbortController().signal,
    acked: false,
    ack: async () => {
      opts.acked = true
    },
  }
  return opts
}

export const createRecordEvent = (
  overrides: Partial<RecordEvent> = {},
): RecordEvent => ({
  id: 1,
  type: 'record',
  did: 'did:example:alice',
  rev: 'abc123',
  collection: 'com.example.post',
  rkey: 'abc123',
  action: 'create',
  record: { text: 'hello' },
  cid: 'bafyabc',
  live: true,
  ...overrides,
})

export const createIdentityEvent = (): IdentityEvent => ({
  id: 2,
  type: 'identity',
  did: 'did:example:alice',
  handle: 'alice.test',
  isActive: true,
  status: 'active',
})
