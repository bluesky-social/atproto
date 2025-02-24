import { z } from 'zod'
import { Did, didSchema } from './did.js'

/**
 * RFC3968 compliant URI
 *
 * @see {@link https://www.rfc-editor.org/rfc/rfc3986}
 */
const rfc3968UriSchema = z.string().refine((data) => {
  try {
    new URL(data)
    return true
  } catch {
    return false
  }
}, 'RFC3968 compliant URI')

const didControllerSchema = z.union([didSchema, z.array(didSchema)])

/**
 * @note this schema might be too permissive
 */
const didRelativeUriSchema = z.union([
  rfc3968UriSchema,
  z.string().regex(/^#[^#]+$/),
])

const didVerificationMethodSchema = z.object({
  id: didRelativeUriSchema,
  type: z.string().min(1),
  controller: didControllerSchema,
  publicKeyJwk: z.record(z.string(), z.unknown()).optional(),
  publicKeyMultibase: z.string().optional(),
})

/**
 * The value of the id property MUST be a URI conforming to [RFC3986]. A
 * conforming producer MUST NOT produce multiple service entries with the same
 * id. A conforming consumer MUST produce an error if it detects multiple
 * service entries with the same id.
 *
 * @note Normally, only rfc3968UriSchema should be allowed here. However, the
 *   did:plc uses relative URI. For this reason, we also allow relative URIs
 *   here.
 */
const didServiceIdSchema = didRelativeUriSchema

/**
 * The value of the type property MUST be a string or a set of strings. In order
 * to maximize interoperability, the service type and its associated properties
 * SHOULD be registered in the DID Specification Registries
 * [DID-SPEC-REGISTRIES].
 */
const didServiceTypeSchema = z.union([z.string(), z.array(z.string())])

/**
 * The value of the serviceEndpoint property MUST be a string, a map, or a set
 * composed of one or more strings and/or maps. All string values MUST be valid
 * URIs conforming to [RFC3986] and normalized according to the Normalization
 * and Comparison rules in RFC3986 and to any normalization rules in its
 * applicable URI scheme specification.
 */
const didServiceEndpointSchema = z.union([
  rfc3968UriSchema,
  z.record(z.string(), rfc3968UriSchema),
  z
    .array(z.union([rfc3968UriSchema, z.record(z.string(), rfc3968UriSchema)]))
    .nonempty(),
])

/**
 * Each service map MUST contain id, type, and serviceEndpoint properties.
 * @see {@link https://www.w3.org/TR/did-core/#services}
 */
const didServiceSchema = z.object({
  id: didServiceIdSchema,
  type: didServiceTypeSchema,
  serviceEndpoint: didServiceEndpointSchema,
})

export type DidService = z.infer<typeof didServiceSchema>

const didAuthenticationSchema = z.union([
  //
  didRelativeUriSchema,
  didVerificationMethodSchema,
])

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
  controller: didControllerSchema.optional(),
  alsoKnownAs: z.array(rfc3968UriSchema).optional(),
  service: z.array(didServiceSchema).optional(),
  authentication: z.array(didAuthenticationSchema).optional(),
  verificationMethod: z
    .array(z.union([didVerificationMethodSchema, didRelativeUriSchema]))
    .optional(),
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
