import axios, { AxiosError } from 'axios'

export const assureAxiosError = (err: unknown): AxiosError => {
  if (axios.isAxiosError(err)) return err
  throw err
}

export const parseAxiosError = (
  e: unknown,
): { code: number; msg: string; err: AxiosError } => {
  const err = assureAxiosError(e)
  const msg = err.response?.data || err.message
  return {
    code: err.response?.status || 500,
    msg,
    err,
  }
}

// this will be self describing from the DID, so we hardwire this for now & make it an env variable
export const didNetworkUrl = (): string => {
  const envVar = process.env.DID_NETWORK_URL
  if (typeof envVar === 'string') {
    return envVar
  }
  return 'http://localhost:2583/did-network'
}

export const cleanHostUrl = (url: string): string => {
  let cleaned = url.replace('http://', '').replace('https://', '')
  if (cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1)
  }
  return cleaned
}
