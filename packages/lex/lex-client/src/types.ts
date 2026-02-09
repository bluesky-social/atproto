import { DidString, UnknownString } from '@atproto/lex-schema'

export type { DidString, UnknownString }

/**
 * Service identifier fragment for DID service endpoints.
 *
 * Common values include 'atproto_labeler' for labeling services,
 * or custom service identifiers.
 */
export type DidServiceIdentifier = 'atproto_labeler' | UnknownString

/**
 * A full service proxy identifier combining a DID with a service fragment.
 *
 * Used to route requests through a specific service endpoint.
 *
 * @example
 * ```typescript
 * const service: Service = 'did:web:api.bsky.app#bsky_appview'
 * ```
 */
export type Service = `${DidString}#${DidServiceIdentifier}`

/**
 * Common options available for all XRPC calls.
 *
 * These options can be passed to any method that makes XRPC requests,
 * including `xrpc()`, `call()`, and record operations.
 */
export type CallOptions = {
  /** Labeler DIDs to request labels from for content moderation. */
  labelers?: Iterable<DidString>
  /** AbortSignal to cancel the request. */
  signal?: AbortSignal
  /** Additional HTTP headers to include in the request. */
  headers?: HeadersInit
  /** Service proxy identifier for routing requests through a specific service. */
  service?: Service

  /**
   * Whether to validate the request against the method's input schema. Enabling
   * this can help catch errors early but may have a performance cost. This
   * would typically only be set to `true` in development or debugging
   * scenarios.
   *
   * @default false
   */
  validateRequest?: boolean

  /**
   * Whether to validate the response against the method's output schema.
   * Disabling this can improve performance but may lead to runtime errors if
   * the response does not conform to the expected schema. Only set this to
   * `false` if you are certain that the upstream service will always return
   * valid responses.
   *
   * @default true
   */
  validateResponse?: boolean
}

/**
 * Valid input types for binary request bodies.
 *
 * These types can be used as the body for procedures that expect
 * non-JSON content (e.g., blob uploads, binary data).
 *
 * @example Uploading a blob
 * ```typescript
 * const imageData: BinaryBodyInit = new Uint8Array(buffer)
 * await client.uploadBlob(imageData, { encoding: 'image/png' })
 * ```
 *
 * @example Streaming upload
 * ```typescript
 * const stream: BinaryBodyInit = someReadableStream
 * await client.xrpc(uploadMethod, { body: stream })
 * ```
 *
 * @example File upload in browser
 * ```typescript
 * const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
 * const file: BinaryBodyInit = fileInput.files[0]
 * await client.xrpc(uploadMethod, { body: file })
 * ```
 */
export type BinaryBodyInit =
  | Uint8Array
  | ArrayBuffer
  | Blob
  | ReadableStream<Uint8Array>
  | AsyncIterable<Uint8Array>
  | string
