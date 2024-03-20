import { parseList } from 'structured-headers'

export type ParsedLabelers = {
  dids: string[]
  redact: Set<string>
}

export const parseLabelerHeader = (
  header: string | undefined,
): ParsedLabelers | null => {
  if (!header) return null
  const labelerDids = new Set<string>()
  const redactDids = new Set<string>()
  const parsed = parseList(header)
  for (const item of parsed) {
    const did = item[0].toString()
    if (!did) {
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

export const defaultLabelerHeader = (dids: string[]): ParsedLabelers => {
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
