export type ParsedLabelers = {
  dids: string[]
  redact: Set<string>
}

export const parseLabelerHeader = (header: string): ParsedLabelers => {
  const labelers = header.split(',').map((part) => part.trim())
  const labelerDids = new Set<string>()
  const redactDids = new Set<string>()
  for (const labeler of labelers) {
    if (labeler.length === 0) {
      continue
    }
    const parts = labeler.split(';')
    const did = parts[0].trim()
    labelerDids.add(did)
    const rest = parts.slice(1).map((part) => part.trim())
    if (rest.includes('redact')) {
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
