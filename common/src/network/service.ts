import axios from 'axios'
import { CID } from 'multiformats'
import { authCfg, didNetworkUrl, parseAxiosError } from './util.js'
import * as check from '../common/check.js'
import { schema as repoSchema } from '../repo/types.js'
import * as ucan from 'ucans'
import * as uint8arrays from 'uint8arrays'
import * as auth from '@adxp/auth'

export const registerToDidNetwork = async (
  username: string,
  signer: auth.AuthStore,
): Promise<void> => {
  const url = didNetworkUrl()
  const dataBytes = uint8arrays.fromString(username, 'utf8')
  const sigBytes = await signer.sign(dataBytes)
  const signature = uint8arrays.toString(sigBytes, 'base64url')
  const did = await signer.getDid()
  const data = { did, username, signature }
  try {
    await axios.post(url, data)
  } catch (e) {
    const err = parseAxiosError(e)
    throw new Error(err.msg)
  }
}

export const getUsernameFromDidNetwork = async (
  did: string,
): Promise<string | null> => {
  const url = didNetworkUrl()
  const params = { did }
  try {
    const res = await axios.get(url, { params })
    return res.data.username
  } catch (e) {
    const err = parseAxiosError(e)
    if (err.code === 404) {
      return null
    }
    throw new Error(err.msg)
  }
}

export const register = async (
  url: string,
  username: string,
  did: string,
  createRepo: boolean,
  token: ucan.Chained,
): Promise<void> => {
  const data = { username, did, createRepo }
  try {
    await axios.post(`${url}/id/register`, data, authCfg(token))
  } catch (e) {
    const err = parseAxiosError(e)
    throw new Error(err.msg)
  }
}

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
    const err = parseAxiosError(e)
    if (err.code === 404) {
      return null
    }
    throw new Error(err.msg)
  }
}

export const getServerDid = async (url: string): Promise<string> => {
  try {
    const res = await axios.get(`${url}/.well-known/did.json`)
    return res.data.id
  } catch (e) {
    const err = parseAxiosError(e)
    throw new Error(`Could not retrieve server did ${err.msg}`)
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
    const err = parseAxiosError(e)
    if (err.code === 404) {
      return null
    }
    throw new Error(`Could not retrieve server did ${err.msg}`)
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
    const err = parseAxiosError(e)
    throw new Error(`Could not retrieve server did ${err.msg}`)
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
    const err = parseAxiosError(e)
    throw new Error(`Could not retrieve server did ${err.msg}`)
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
    const err = parseAxiosError(e)
    if (err.code === 404) {
      return null
    }
    throw new Error(`Could not retrieve server did ${err.msg}`)
  }
}
