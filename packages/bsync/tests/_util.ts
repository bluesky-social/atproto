import { type Code, ConnectError } from '@connectrpc/connect'
import { assert, expect } from 'vitest'

/**
 * Checks a {@link ConnectError} by code and message, for `rejects.toSatisfy()`.
 * `toEqual(new ConnectError(…))` would also compare the response headers the
 * client puts in `metadata`.
 */
export function isConnectError(message: string, code: Code) {
  return (err: unknown) => {
    assert(err instanceof ConnectError)
    expect(err.code).toBe(code)
    expect(err.rawMessage).toBe(message)
    return true
  }
}
