import AtpAgent from '@waverlyai/atproto-api'

export default interface User {
  email: string
  did: string
  handle: string
  password: string
  agent: AtpAgent
}
