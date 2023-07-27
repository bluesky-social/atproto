import { TestNetworkNoAppView } from '../../network-no-appview'
import User from './User'

export default (env: TestNetworkNoAppView): User[] => {
  return [
    {
      email: 'betterweb@group.social',
      did: '',
      handle: 'betterweb.group',
      password: 'hunter2',
      agent: env.pds.getClient(),
    },
  ]
}
