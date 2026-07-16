/**
 * WebSocket close codes, per RFC 6455 §7.4.1 and the IANA WebSocket Close
 * Code Number registry.
 *
 * Note that some codes never appear in a Close frame on the wire: an endpoint
 * generates them locally to describe how a connection ended
 * ({@link CloseCode.NoStatus}, {@link CloseCode.Abnormal},
 * {@link CloseCode.TlsHandshake}).
 *
 * https://www.rfc-editor.org/rfc/rfc6455#section-7.4.1
 */
export enum CloseCode {
  /** 1000: normal closure — the purpose of the connection has been fulfilled. */
  Normal = 1000,
  /** 1001: endpoint is going away (e.g. server shutdown or page navigation). */
  GoingAway = 1001,
  /** 1002: protocol error. */
  ProtocolError = 1002,
  /** 1003: received a data type it cannot accept (e.g. binary on a text-only endpoint). */
  UnsupportedData = 1003,
  /** 1005: no status code was present. Never sent on the wire. */
  NoStatus = 1005,
  /** 1006: connection closed abnormally, without a Close frame. Never sent on the wire. */
  Abnormal = 1006,
  /** 1007: received a message with inconsistent data (e.g. non-UTF-8 in a text frame). */
  InvalidPayload = 1007,
  /** 1008: received a message that violates the endpoint's policy. */
  Policy = 1008,
  /** 1009: received a message too big to process. */
  MessageTooBig = 1009,
  /** 1010: client is terminating because the server didn't negotiate a required extension. */
  MandatoryExtension = 1010,
  /** 1011: server is terminating due to an unexpected condition. */
  InternalError = 1011,
  /** 1015: TLS handshake failure. Never sent on the wire. */
  TlsHandshake = 1015,
}
