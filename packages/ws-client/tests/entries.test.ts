import { describe, expect, expectTypeOf, it } from 'vitest'
import type {
  BrowserWebSocketOptions,
  MessageOf,
  NodeWebSocketOptions,
  WebSocketIterable,
} from '../src/index.ts'
import { websocket } from '../src/index.ts'

describe('public entrypoint', () => {
  it('exports websocket() as the one way to consume a socket', () => {
    expect(typeof websocket).toBe('function')
  })

  it('types browser options as a subset of node options', () => {
    expectTypeOf<BrowserWebSocketOptions>().toExtend<NodeWebSocketOptions>()
    // headers is the one node-only option.
    expectTypeOf<NodeWebSocketOptions>().toHaveProperty('headers')
    expectTypeOf<keyof BrowserWebSocketOptions>().not.toExtend<'headers'>()
  })

  it('binds dataMode to the yielded type, with all generator type args', () => {
    expectTypeOf<MessageOf<'binary'>>().toEqualTypeOf<Uint8Array>()
    expectTypeOf<MessageOf<'text'>>().toEqualTypeOf<string>()
    // The named alias is what consumers annotate with; it must stay equivalent
    // to the spelled-out generator, all three type args included — TReturn and
    // TNext default to `any`, which would silently un-type next()/return().
    expectTypeOf<WebSocketIterable<'binary'>>().toEqualTypeOf<
      AsyncGenerator<Uint8Array, void, undefined>
    >()
    expectTypeOf(websocket<'binary'>).returns.toEqualTypeOf<
      WebSocketIterable<'binary'>
    >()
  })
})
