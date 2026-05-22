import { DidService } from './did-document.js'
import { AtprotoDidDocument } from './atproto.js'
import { AtprotoDidRefAbsolute } from './did-ref.js'

/**
 * Sections of a DID document that contain referenceable entries.
 */
type DidDocumentSection =
  | 'verificationMethod'
  | 'service'
  | 'assertionMethod'
  | 'authentication'

type VerificationMethod = NonNullable<
  AtprotoDidDocument['verificationMethod']
>[number]

type EntryFor<S extends DidDocumentSection> = S extends 'verificationMethod'
  ? VerificationMethod
  : S extends 'service'
    ? DidService
    : { id: string }

/**
 * Look up an entry in a DID document by reference. The reference is a
 * `#fragment` (relative — resolved against `doc.id`) or a `did#fragment`
 * (absolute — must match `doc.id`).
 *
 * Returns the matching entry, or `null` if not found.
 */
export function lookupDidReference<S extends DidDocumentSection>(
  doc: AtprotoDidDocument,
  ref: `#${string}` | AtprotoDidRefAbsolute,
  section: S,
): EntryFor<S> | null {
  const hashIdx = ref.indexOf('#')
  if (hashIdx === -1) return null // not a reference
  const refDid = hashIdx === 0 ? doc.id : ref.slice(0, hashIdx)
  if (refDid !== doc.id) return null // absolute ref to a different DID
  const fragId = ref.slice(hashIdx) // includes leading '#'
  const absoluteId = `${doc.id}${fragId}` // e.g. did:plc:xxx#atproto
  const entries = (doc[section as keyof AtprotoDidDocument] ?? []) as readonly unknown[]
  for (const entry of entries) {
    // Handle both strings (references) and objects (embedded entries)
    const entryId = typeof entry === 'string' ? entry : (entry as { id: string }).id
    if (entryId === fragId || entryId === absoluteId) {
      return entry as EntryFor<S>
    }
  }
  return null
}
