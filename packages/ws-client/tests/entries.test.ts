import { describe, expect, expectTypeOf, it } from 'vitest'
import type {
  BrowserWebSocketClientOptions,
  BrowserWebSocketOptions,
  MessageOf,
  NodeWebSocketClientOptions,
  NodeWebSocketOptions,
} from '../src/index.ts'
import { WebSocketClient, websocket } from '../src/index.ts'

describe('public entrypoint', () => {
  it('exports websocket() and a constructable WebSocketClient', () => {
    expect(typeof websocket).toBe('function')
    expect(typeof WebSocketClient).toBe('function')
  })

  it('exposes no close() on the client', () => {
    // Termination is break/throw/signal/asyncDispose — deliberately one idiom.
    expect('close' in WebSocketClient.prototype).toBe(false)
  })

  it('types browser options as a subset of node options', () => {
    expectTypeOf<BrowserWebSocketOptions>().toExtend<NodeWebSocketOptions>()
    expectTypeOf<BrowserWebSocketClientOptions>().toExtend<NodeWebSocketClientOptions>()
    // headers is the one node-only option.
    expectTypeOf<NodeWebSocketOptions>().toHaveProperty('headers')
    expectTypeOf<keyof BrowserWebSocketOptions>().not.toExtend<'headers'>()
    expectTypeOf<
      keyof BrowserWebSocketClientOptions
    >().not.toExtend<'headers'>()
  })

  it('binds dataMode to the yielded type, with all generator type args', () => {
    expectTypeOf<MessageOf<'binary'>>().toEqualTypeOf<Uint8Array>()
    expectTypeOf<MessageOf<'text'>>().toEqualTypeOf<string>()
    expectTypeOf(websocket<'binary'>).returns.toEqualTypeOf<
      AsyncGenerator<Uint8Array, void, undefined>
    >()
  })
})
