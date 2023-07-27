import AtpAgent from '@atproto/api'

export default interface User {
  email: string
  did: string
  handle: string
  password: string
  agent: AtpAgent
}
