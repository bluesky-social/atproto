import { describe, expect, it, test } from 'vitest'
import {
  CloseCode,
  FATAL_CLOSE_CODES,
  isReconnectableClose,
} from './close-codes.js'

describe(isReconnectableClose, () => {
  test.each([
    { note: 'normal shutdown', code: CloseCode.Normal, expected: false },
    { note: 'protocol error', code: CloseCode.ProtocolError, expected: false },
    {
      note: 'unsupported data',
      code: CloseCode.UnsupportedData,
      expected: false,
    },
    {
      note: 'invalid payload',
      code: CloseCode.InvalidPayload,
      expected: false,
    },
    { note: 'message too big', code: CloseCode.MessageTooBig, expected: false },
    {
      note: 'going away (server restart)',
      code: CloseCode.GoingAway,
      expected: true,
    },
    { note: 'internal error', code: CloseCode.InternalError, expected: true },
    { note: 'policy violation', code: CloseCode.Policy, expected: true },
  ])('$note', ({ code, expected }) => {
    expect(isReconnectableClose(code)).toBe(expected)
  })

  it('treats synthetic codes as reconnectable transient trouble', () => {
    // 1005/1006/1015 never appear in a wire close frame (RFC 6455 §7.4.1);
    // they describe local trouble and must classify like a SocketError.
    for (const code of [
      CloseCode.NoStatus,
      CloseCode.Abnormal,
      CloseCode.TlsHandshake,
    ]) {
      expect(FATAL_CLOSE_CODES.has(code)).toBe(false)
      expect(isReconnectableClose(code)).toBe(true)
    }
  })
})
