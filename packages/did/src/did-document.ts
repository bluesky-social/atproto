import { z } from 'zod'
import { Did, assertDid, didSchema } from './did.js'
import { canParse, findDidUrlSeparator } from './lib/uri.js'

/**
 * @see {@link https://www.rfc-editor.org/rfc/rfc3986 RFC3986}
 */
const rfc3986UriSchema = z.string().url('RFC3986 URI')

export type DidUrl = Exclude<
  `${Did | ''}${`/${string}` | ''}${`?${string}` | ''}${`#${string}` | ''}`,
  ''
>

/**
 * Validates full or relative DID URLs.
 *
 * ```abnf
 * did-url = did path-abempty [ "?" query ] [ "#" fragment ]
 * path-abempty = *( "/" segment )
 * ```
 *
 * @see {@link https://www.w3.org/TR/did-1.0/#did-url-syntax Decentralized Identifiers - 3.2. DID URL Syntax}
 */
export const didUrlSchema = z.string().refine(
  (input): input is DidUrl => {
    if (!input) {
      return false
    }

    const separatorIndex = findDidUrlSeparator(input)
    // If there is no separator, check the whole input as a DID
    if (separatorIndex === -1) {
      try {
        assertDid(input)
      } catch {
        return false
      }

      // No separator, valid DID
      return true
    }

    // Make sure everything up to the separator is a valid DID
    if (separatorIndex !== 0) {
      try {
        assertDid(input, 0, separatorIndex)
      } catch {
        return false
      }
    }

    // make sure the rest is a valid URI component
    return canParse(input.slice(separatorIndex), 'http://x')
  },
  { message: 'DID URL' },
)

/**
 * Each service map MUST contain id, type, and serviceEndpoint properties.
 * @see {@link https://www.w3.org/TR/did-core/#services}
 */
const didServiceSchema = z.object({
  /**
   * > The value of the `id` property MUST be a URI conforming to [RFC3986]. A
   * > conforming producer MUST NOT produce multiple service entries with the
   * > same id. A conforming consumer MUST produce an error if it detects
   * > multiple service entries with the same id.
   */
  id: z.union([
    rfc3986UriSchema,
    // Note we must allow relative DID URLs here too (which rfc3986UriSchema
    // does not allow):
    didUrlSchema,
  ]),
  /**
   * > The value of the `type` property MUST be a string or a set of strings. In
   * > order to maximize interoperability, the service type and its associated
   * > properties SHOULD be registered in the DID Specification Registries
   * > [DID-SPEC-REGISTRIES].
   */
  type: z.union([z.string(), z.array(z.string())]),
  /**
   * > The value of the `serviceEndpoint` property MUST be a string, a map, or a
   * > set composed of one or more strings and/or maps. All string values MUST
   * > be valid URIs conforming to [RFC3986] and normalized according to the
   * > Normalization and Comparison rules in RFC3986 and to any normalization
   * > rules in its applicable URI scheme specification.
   *
   * @note we don't enforce the normalization requirement here
   */
  serviceEndpoint: z.union([
    rfc3986UriSchema,
    z.record(z.string(), rfc3986UriSchema),
    z
      .array(
        z.union([rfc3986UriSchema, z.record(z.string(), rfc3986UriSchema)]),
      )
      .nonempty(),
  ]),
})

export type DidService = z.infer<typeof didServiceSchema>

const didVerificationMethodSchema = z.object({
  /**
   * > The value of the id property for a verification method MUST be a string
   * > that conforms to the rules in Section 3.2 DID URL Syntax.
   *
   * @see {@link https://www.w3.org/TR/did-1.0/#verification-methods}
   */
  id: didUrlSchema,
  type: z.string(),
  controller: z.union([didSchema, z.array(didSchema)]),
  publicKeyJwk: z.record(z.string(), z.unknown()).optional(),
  publicKeyMultibase: z.string().optional(),
})

export type DidVerificationMethod = z.infer<typeof didVerificationMethodSchema>

const didVerificationRelationshipSchema = z.union([
  didVerificationMethodSchema,
  didUrlSchema,
])

const didVerificationRelationshipsSchema = z
  .array(didVerificationRelationshipSchema)
  .optional()

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

  // Identifiers
  id: didSchema,
  alsoKnownAs: z.array(rfc3986UriSchema).optional(),
  controller: z.union([didSchema, z.array(didSchema)]).optional(),

  // Verification Methods
  verificationMethod: z.array(didVerificationMethodSchema).optional(),

  // Verification relationships
  authentication: didVerificationRelationshipsSchema,
  assertionMethod: didVerificationRelationshipsSchema,
  keyAgreement: didVerificationRelationshipsSchema,
  capabilityInvocation: didVerificationRelationshipsSchema,
  capabilityDelegation: didVerificationRelationshipsSchema,

  // Services
  service: z.array(didServiceSchema).optional(),
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

        const serviceId =
          // Resolve relative service IDs according to RFC3986 (ish)
          current.id.startsWith('#') ||
          current.id.startsWith('/') ||
          current.id.startsWith('?')
            ? `${did}${current.id}`
            : current.id

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
