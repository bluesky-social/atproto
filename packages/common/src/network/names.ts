import axios from 'axios'
import { AdxUri } from './uri'

const WELL_KNOWN_PATH = '/.well-known/adx-did'

export class NameResolveError extends Error {
  constructor(
    username: string,
    public responseStatus: number,
    public responseBody: any,
  ) {
    super(`${username} did not respond with a DID`)
  }
}

export async function resolveName(name: string) {
  try {
    const urip = new AdxUri(name)
    name = urip.host
    if (name.startsWith('did:')) {
      throw new Error()
    }
  } catch (e: any) {
    throw new Error(`Invalid name: ${name}`)
  }

  let endpoint = `https://${name}${WELL_KNOWN_PATH}`
  if (name.includes('localhost')) {
    // special handling for localhost
    const [_, port] = name.split(':')
    endpoint = 'http://localhost' + (port ? `:${port}` : '') + WELL_KNOWN_PATH
  }
  const res = await axios.get<string>(endpoint, {
    headers: { Accept: 'text/plain', Host: name },
  })
  if (typeof res.data !== 'string' || !res.data.trim().startsWith('did:')) {
    throw new NameResolveError(name, res.status, res.data)
  }
  return res.data.trim()
}
