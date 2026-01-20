import { WebSocketServer } from 'ws'
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
  cid: 'bafyreiclp443lavogvhj3d2ob2cxbfuscni2k5jk7bebjzg7khl3esabwq',
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

export async function createWebSocketServer() {
  return new Promise<WebSocketServer & AsyncDisposable>((resolve, reject) => {
    const server = new WebSocketServer({ port: 0 }, () => {
      server.off('error', reject)
      resolve(
        Object.defineProperty(server, Symbol.asyncDispose, {
          value: disposeWebSocketServer,
        }) as WebSocketServer & AsyncDisposable,
      )
    }).once('error', reject)
  })
}

async function disposeWebSocketServer(this: WebSocketServer) {
  return new Promise<void>((resolve, reject) => {
    this.close((err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}
