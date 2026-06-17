export type Identifier<D extends string, I extends string> =
  | `#${I}`
  | `${D}#${I}`
export function matchesIdentifier<D extends string, I extends string>(
  did: D,
  id: I,
  candidate: string,
): candidate is Identifier<D, I> {
  // optimized implementation of:
  // return candidate === `#${id}` || candidate === `${did}#${id}`

  return candidate.charCodeAt(0) === 35 // '#'
    ? candidate.length === id.length + 1 && candidate.endsWith(id)
    : candidate.length === id.length + 1 + did.length &&
        candidate.charCodeAt(did.length) === 35 && // '#'
        candidate.startsWith(did) &&
        candidate.endsWith(id)
}
