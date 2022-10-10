import { createServer } from '../lexicon'
import todoAdx from './todo/adx'
import todoSocial from './todo/social'

export default function () {
  const server = createServer()
  todoAdx(server)
  todoSocial(server)
  return server
}
