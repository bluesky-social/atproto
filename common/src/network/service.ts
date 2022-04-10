import axios from 'axios'
import { CID } from 'multiformats'
import { assureAxiosError } from './util.js'
import * as check from '../common/check.js'
import { schema as repoSchema } from '../repo/types.js'

export const lookupDid = async (
  url: string,
  name: string,
): Promise<string | null> => {
  const params = { resource: name }
  try {
    const res = await axios.get(`${url}/.well-known/webfinger`, {
      params,
    })
    return check.assure(repoSchema.did, res.data.id)
  } catch (e) {
    const err = assureAxiosError(e)
    if (err.response?.status === 404) {
      return null
    }
    throw new Error(err.message)
  }
}

export const getRemoteRoot = async (
  url: string,
  did: string,
): Promise<CID | null> => {
  const params = { did }
  try {
    const res = await axios.get(`${url}/data/root`, { params })
    return CID.parse(res.data.root)
  } catch (e) {
    const err = assureAxiosError(e)
    if (err.response?.status === 404) {
      return null
    }
    throw new Error(`Could not retrieve server did ${err.message}`)
  }
}

export const subscribe = async (
  url: string,
  did: string,
  ownUrl: string,
): Promise<void> => {
  const data = { did, host: ownUrl }
  try {
    await axios.post(`${url}/data/subscribe`, data)
  } catch (e) {
    const err = assureAxiosError(e)
    throw new Error(`Could not retrieve server did ${err.message}`)
  }
}

export const pushRepo = async (
  url: string,
  did: string,
  car: Uint8Array,
): Promise<void> => {
  try {
    await axios.post(`${url}/data/repo/${did}`, car, {
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    })
  } catch (e) {
    const err = assureAxiosError(e)
    throw new Error(`Could not retrieve server did ${err.message}`)
  }
}

export const pullRepo = async (
  url: string,
  did: string,
  from?: CID,
): Promise<Uint8Array | null> => {
  const params = { did, from: from?.toString() }
  try {
    const res = await axios.get(`${url}/data/repo`, {
      params,
      responseType: 'arraybuffer',
    })
    return new Uint8Array(res.data)
  } catch (e) {
    const err = assureAxiosError(e)
    if (err.response?.status === 404) {
      return null
    }
    throw new Error(`Could not retrieve server did ${err.message}`)
  }
}
