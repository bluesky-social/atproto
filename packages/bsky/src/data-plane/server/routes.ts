import { ConnectRouter } from '@connectrpc/connect'
import { Service } from '../gen/bsky_connect'

export default (router: ConnectRouter) =>
  router.service(Service, {
    async getFollowers(req) {
      return {
        uris: [req.actorDid],
        cursor: 'test-cursor',
      }
    },
  })
