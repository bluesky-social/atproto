import { describe, expect, expectTypeOf, it } from 'vitest'
import type {
  BrowserWebSocketClientOptions,
  BrowserWebSocketConnectionOptions,
  MessageOf,
  NodeWebSocketClientOptions,
  NodeWebSocketConnectionOptions,
} from '../src/index.ts'
import { WebSocketClient, WebSocketConnection } from '../src/index.ts'

describe('entrypoint', () => {
  it('exports a constructable WebSocketConnection and WebSocketClient', () => {
    expect(typeof WebSocketConnection).toBe('function')
    expect(typeof WebSocketClient).toBe('function')
  })

  it('browser options are a subset of node options', () => {
    // Pure type-level assertions: the single public entrypoint accepts the
    // full (node) option set; the named Browser*/Node* option types let
    // consumers opt into platform-accurate checking. Any valid browser
    // options object is also valid node options — not vice versa.
    expectTypeOf<BrowserWebSocketConnectionOptions>().toExtend<NodeWebSocketConnectionOptions>()
    expectTypeOf<BrowserWebSocketClientOptions>().toExtend<NodeWebSocketClientOptions>()
    // headers is the one node-only option: present on node, absent on browser.
    expectTypeOf<NodeWebSocketConnectionOptions>().toHaveProperty('headers')
    expectTypeOf<NodeWebSocketClientOptions>().toHaveProperty('headers')
    expectTypeOf<
      keyof BrowserWebSocketConnectionOptions
    >().not.toExtend<'headers'>()
    expectTypeOf<
      keyof BrowserWebSocketClientOptions
    >().not.toExtend<'headers'>()
  })

  it('binary dataMode binds Uint8Array', () => {
    // Type-level only: no instance is constructed (that would open a real
    // socket). MessageOf<'binary'> resolves to Uint8Array.
    expectTypeOf<MessageOf<'binary'>>().toEqualTypeOf<Uint8Array>()
    expectTypeOf<InstanceType<typeof WebSocketConnection<'binary'>>>().toExtend<
      AsyncIterable<Uint8Array>
    >()
  })
})
