import { parseList } from 'structured-headers'
import { DidString } from '@atproto/lex'
import { isValidDid } from '@atproto/syntax'

export type ParsedLabelers = {
  dids: DidString[]
  redact: Set<DidString>
}

export const parseLabelerHeader = (
  header: string | undefined,
): ParsedLabelers | null => {
  // An empty header is valid, so we shouldn't return null
  // https://datatracker.ietf.org/doc/html/rfc7230#section-3.2
  if (header === undefined) return null
  const labelerDids = new Set<DidString>()
  const redactDids = new Set<DidString>()
  const parsed = parseList(header)
  for (const item of parsed) {
    const did = item[0].toString()
    if (!isValidDid(did)) {
      return null
    }
    labelerDids.add(did)
    const redact = item[1].get('redact')?.valueOf()
    if (redact === true) {
      redactDids.add(did)
    }
  }
  return {
    dids: [...labelerDids],
    redact: redactDids,
  }
}

export const defaultLabelerHeader = (dids: DidString[]): ParsedLabelers => {
  return {
    dids,
    redact: new Set(dids),
  }
}

export const formatLabelerHeader = (parsed: ParsedLabelers): string => {
  const parts = parsed.dids.map((did) =>
    parsed.redact.has(did) ? `${did};redact` : did,
  )
  return parts.join(',')
}
