import { describe, expect, expectTypeOf, it } from 'vitest'
import * as browser from '../src/browser.ts'
import * as node from '../src/node.ts'

describe('entrypoint parity', () => {
  it('exports the same named members', () => {
    const nodeKeys = Object.keys(node).sort()
    const browserKeys = Object.keys(browser).sort()
    expect(nodeKeys).toEqual(browserKeys)
  })

  it('both export a constructable WebSocketCore', () => {
    expect(typeof node.WebSocketCore).toBe('function')
    expect(typeof browser.WebSocketCore).toBe('function')
  })

  it('WebSocketCore constructors are type-compatible', () => {
    // Pure type-level assertion: constructing a real WebSocketCore here
    // would open a socket to an unreachable URL, which is unnecessary risk
    // for what is otherwise a type-only check. See Task 11 brief.
    expectTypeOf(node.WebSocketCore).toEqualTypeOf<typeof browser.WebSocketCore>()
  })

  it('binary dataMode binds Uint8Array on both entries', () => {
    // Type-level only: no instance is constructed (that would open a real
    // socket). MessageOf<'binary'> resolves to Uint8Array on both entries,
    // and the two WebSocketCore<'binary'> instance types are identical.
    expectTypeOf<node.MessageOf<'binary'>>().toEqualTypeOf<Uint8Array>()
    expectTypeOf<browser.MessageOf<'binary'>>().toEqualTypeOf<Uint8Array>()
    expectTypeOf<InstanceType<typeof node.WebSocketCore<'binary'>>>().toEqualTypeOf<
      InstanceType<typeof browser.WebSocketCore<'binary'>>
    >()
  })
})
