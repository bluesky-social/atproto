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
    {
      email: 'aimagiceveryday@group.social',
      did: '',
      handle: 'aimagiceveryday.group',
      password: 'hunter2',
      agent: env.pds.getClient(),
    },
    {
      email: 'aiglamsquad@group.social',
      did: '',
      handle: 'aiglamsquad.group',
      password: 'hunter2',
      agent: env.pds.getClient(),
    },
    {
      email: 'thephototriothatrules@group.social',
      did: '',
      handle: 'thephototriothatrules.group',
      password: 'hunter2',
      agent: env.pds.getClient(),
    },
    {
      email: 'smarthomegadgets@group.social',
      did: '',
      handle: 'smarthomegadgets.group',
      password: 'hunter2',
      agent: env.pds.getClient(),
    },
    {
      email: 'testgroup@group.social',
      did: '',
      handle: 'testgroup.group',
      password: 'hunter2',
      agent: env.pds.getClient(),
    },
  ]
}
