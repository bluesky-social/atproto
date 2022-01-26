import axios from 'axios'

const SERVER_URL = 'http://localhost:2583'
const THIRD_PARTY_URL = 'http://localhost:2584'

export const register = async (car: Uint8Array, authToken: string): Promise<void> => {
  await axios.post(`${SERVER_URL}/user/register`, car, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Authorization': `Bearer ${authToken}`
    }
  })
}

export const updateUser = async (car: Uint8Array, authToken: string): Promise<void> => {
  await axios.post(`${SERVER_URL}/user/update`, car, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Authorization': `Bearer ${authToken}`
    }
  })
}

export const fetchUser = async (did: string): Promise<Uint8Array> => {
  const res = await axios.get(`${SERVER_URL}/user/${did}`, { responseType: 'arraybuffer' })
  return new Uint8Array(res.data)
}

export const fetchUsers = async (): Promise<string[]> => {
  const res = await axios.get(`${SERVER_URL}/users`)
  return res.data
}

export const getServerDid = async (): Promise<string> => {
  const res = await axios.get(`${SERVER_URL}/.well-known/did.json`)
  return res.data.id
}

export const fetchUserDid = async (username: string): Promise<string | null> => {
  try {
    const res = await axios.get(`${SERVER_URL}/.well-known/webfinger?resource=${username}`)
    return res.data.id
  } catch (_err) {
    return null
  }
}

export const getThirdPartyDid = async (): Promise<string> => {
  const res = await axios.get(`${THIRD_PARTY_URL}/.well-known/did.json`)
  return res.data.id
}

export const thirdPartyPost = async (username: string, authToken: string): Promise<void> => {
  await axios.post(`${THIRD_PARTY_URL}/post`, { username }, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  })
}
