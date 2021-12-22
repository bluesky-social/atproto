import axios from 'axios'

const SERVER_URL = 'http://localhost:2583'

export const register = async (name: string, authToken: string): Promise<void> => {
  await axios.post(`${SERVER_URL}/register`, { name }, { 
    headers: { 
      'Authorization': `Bearer ${authToken}`
    }
  })
}

export const updateUser = async (car: Uint8Array, authToken: string): Promise<void> => {
  await axios.post(`${SERVER_URL}/update`, car, { 
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

export const getServerDid = async (): Promise<string> => {
  const cached = localStorage.getItem('serverDid')
  if (cached && cached.length > 0) {
    return cached
  }
  const res = await axios.get(`${SERVER_URL}/.well-known/did.json`)
  const did = res.data.id
  localStorage.setItem('serverDid', did)
  return did
}
