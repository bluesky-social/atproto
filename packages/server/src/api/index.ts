import { createServer } from '../lexicon'
import comAtproto from './com/atproto'
import appBsky from './app/bsky'

export default function () {
  const server = createServer()
  comAtproto(server)
  appBsky(server)
  return server
}
