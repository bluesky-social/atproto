import { DidString, UnknownString } from '@atproto/lex-schema'

export type { DidString, UnknownString }

export type DidServiceIdentifier = 'atproto_labeler' | UnknownString
export type Service = `${DidString}#${DidServiceIdentifier}`

export type CallOptions = {
  labelers?: Iterable<DidString>
  signal?: AbortSignal
  headers?: HeadersInit
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

export type BinaryBodyInit =
  | Uint8Array
  | ArrayBuffer
  | Blob
  | ReadableStream<Uint8Array>
  | AsyncIterable<Uint8Array>
  | string
