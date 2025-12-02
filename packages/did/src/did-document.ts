import { z } from 'zod'
import { Did, assertDid, didSchema } from './did.js'
import { isFragment } from './lib/uri.js'

/**
 * @see {@link https://www.rfc-editor.org/rfc/rfc3986 RFC3986}
 */
const rfc3986UriSchema = z.string().url('RFC3986 URI')
const rfc3986SameDocumentRefSchema = z
  .string()
  .refine(
    (value) => value.charCodeAt(0) === 35 /* # */ && isFragment(value, 1),
    { message: 'RFC3986 same-document URI' },
  )

/**
 * ```abnf
 * did-url = did path-abempty [ "?" query ] [ "#" fragment ]
 * path-abempty = *( "/" segment )
 * ```
 *
 * @see {@link https://www.w3.org/TR/did-1.0/#did-url-syntax Decentralized Identifiers - 3.2. DID URL Syntax}
 */
const didUrlSchema = z.string().refine(
  (value): value is `${Did}${`?${string}` | ''}${`#${string}` | ''}` => {
    // Check for "fragment" presence and validity
    const hashIdx = value.indexOf('#', 4)
    if (hashIdx !== -1 && !isFragment(value, hashIdx + 1)) return false

    // Determine "query" (including leading "?") position
    const questIdx = value.indexOf('?', 4)
    const queryStart =
      questIdx !== -1 && (hashIdx === -1 || questIdx < hashIdx) ? questIdx : -1

    // Determine "path" position
    const slashIndex = value.indexOf('/', 4)
    const pathEnd =
      queryStart !== -1 ? queryStart : hashIdx !== -1 ? hashIdx : value.length
    const pathStart =
      slashIndex !== -1 && slashIndex < pathEnd ? slashIndex : pathEnd

    // Validate the DID portion (ignoring "path", "query" and "fragment")
    try {
      assertDid(value, 0, pathStart)
      return true
    } catch {
      return false
    }
  },
  { message: 'DID URL' },
)

export type DidUrl = z.infer<typeof didUrlSchema>

const didUrlWithFragmentSchema = didUrlSchema.refine(
  (value): value is Extract<DidUrl, `${DidUrl}#${string}`> =>
    value.includes('#'),
  { message: 'DID URL with fragment' },
)

export type DidUrlWithFragment = z.infer<typeof didUrlWithFragmentSchema>

/**
 * The value of the type property MUST be a string or a set of strings. In order
 * to maximize interoperability, the service type and its associated properties
 * SHOULD be registered in the DID Specification Registries
 * [DID-SPEC-REGISTRIES].
 */
const didServiceTypeSchema = z.union([z.string(), z.array(z.string())])

/**
 * > The value of the serviceEndpoint property MUST be a string, a map, or a set
 * > composed of one or more strings and/or maps. All string values MUST be
 * > valid URIs conforming to [RFC3986] and normalized according to the
 * > Normalization and Comparison rules in RFC3986 and to any normalization
 * > rules in its applicable URI scheme specification.
 *
 * @note we don't enforce the normalization requirement here
 */
const didServiceEndpointSchema = z.union([
  rfc3986UriSchema,
  z.record(z.string(), rfc3986UriSchema),
  z
    .array(z.union([rfc3986UriSchema, z.record(z.string(), rfc3986UriSchema)]))
    .nonempty(),
])

/**
 * Each service map MUST contain id, type, and serviceEndpoint properties.
 * @see {@link https://www.w3.org/TR/did-core/#services}
 */
const didServiceSchema = z.object({
  /**
   * > The value of the id property MUST be a URI conforming to [RFC3986]. A
   * > conforming producer MUST NOT produce multiple service entries with the same
   * > id. A conforming consumer MUST produce an error if it detects multiple
   * > service entries with the same id.
   *
   * @see {@link https://www.w3.org/TR/did-1.0/#services}
   * @note
   * {@link https://www.rfc-editor.org/rfc/rfc3986#section-4.4 RFC3986 - 4.4. Same-Document Reference }
   * allows relative URIs
   */
  id: z.union([rfc3986SameDocumentRefSchema, didUrlWithFragmentSchema]),
  type: didServiceTypeSchema,
  serviceEndpoint: didServiceEndpointSchema,
})

export type DidService = z.infer<typeof didServiceSchema>

const didVerificationMethodSchema = z.object({
  /**
   * > The value of the id property for a verification method MUST be a string
   * > that conforms to the rules in Section 3.2 DID URL Syntax.
   *
   * @see {@link https://www.w3.org/TR/did-1.0/#verification-methods}
   */
  id: didUrlWithFragmentSchema,
  type: z.string().min(1),
  controller: z.union([didSchema, z.array(didSchema)]),
  publicKeyJwk: z.record(z.string(), z.unknown()).optional(),
  publicKeyMultibase: z.string().optional(),
})

export type DidVerificationMethod = z.infer<typeof didVerificationMethodSchema>

/**
 * @note This schema is incomplete
 * @see {@link https://www.w3.org/TR/did-core/#production-0}
 */
export const didDocumentSchema = z.object({
  '@context': z.union([
    z.literal('https://www.w3.org/ns/did/v1'),
    z
      .array(z.string().url())
      .nonempty()
      .refine((data) => data[0] === 'https://www.w3.org/ns/did/v1', {
        message: 'First @context must be https://www.w3.org/ns/did/v1',
      }),
  ]),
  id: didSchema,
  controller: z.union([didSchema, z.array(didSchema)]).optional(),
  alsoKnownAs: z.array(rfc3986UriSchema).optional(),
  service: z.array(didServiceSchema).optional(),
  authentication: z
    .array(
      z.union([
        didVerificationMethodSchema,
        didUrlWithFragmentSchema,
        rfc3986SameDocumentRefSchema,
      ]),
    )
    .optional(),
  verificationMethod: z.array(didVerificationMethodSchema).optional(),
})

export type DidDocument<Method extends string = string> = z.infer<
  typeof didDocumentSchema
> & { id: Did<Method> }

// @TODO: add other refinements ?
export const didDocumentValidator = didDocumentSchema
  // Ensure that every service id is unique
  .superRefine(({ id: did, service }, ctx) => {
    if (service) {
      const visited = new Set()

      for (let i = 0; i < service.length; i++) {
        const current = service[i]

        const serviceId = current.id.startsWith('#')
          ? current.id
          : current.id.startsWith(did) &&
              current.id.charCodeAt(did.length) === 35 /* # */
            ? current.id.slice(did.length)
            : null

        if (serviceId === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Service id (${current.id}) must be a same-document reference or a DID URL with the DID as the authority`,
            path: ['service', i, 'id'],
          })
        }

        if (!visited.has(serviceId)) {
          visited.add(serviceId)
        } else {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate service id (${current.id}) found in the document`,
            path: ['service', i, 'id'],
          })
        }
      }
    }
  })
