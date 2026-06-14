import { ConnectRouter } from '@connectrpc/connect'
import { Service } from '../../../proto/sokaa_connect'
import { Database } from '../db'
import feeds from './feeds'
import likes from './likes'
import posts from './posts'
import profile from './profile'

export default (db: Database) => (router: ConnectRouter) =>
  router.service(Service, {
    ...feeds(db),
    ...profile(db),
    ...posts(db),
    ...likes(db),
    async ping() {
      return {}
    },
  })

export { feeds, likes, posts, profile }
