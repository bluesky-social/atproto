import dns from 'dns/promises'

const TXT_PREFIX = 'atproto='
const SUBDOMAIN = '_did'

export const resolveDns = async (handle: string): Promise<string | null> => {
  const chunkedResults = await dns.resolveTxt(`${SUBDOMAIN}.${handle}`)
  const results = chunkedResults.map((chunks) => chunks.join(''))
  const found = results.find((i) => i.startsWith(TXT_PREFIX))
  if (!found) return null
  return found.slice(TXT_PREFIX.length)
}
