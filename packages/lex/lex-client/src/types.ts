import { DidString, LexValue, UnknownString } from '@atproto/lex-schema'

export type { DidString, LexValue, UnknownString }

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

export type EncodingString = `${string}/${string}`

export function isEncodingString(
  contentType: string,
): contentType is EncodingString {
  return contentType.includes('/')
}

export type XrpcUnknownResponsePayload<
  TBinary extends BinaryBodyInit = Uint8Array,
> = {
  encoding: EncodingString
  body: LexValue | TBinary
}
