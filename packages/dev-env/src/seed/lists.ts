import { SeedClient } from './client'
import { basicSeed } from './index'

export default async (sc: SeedClient) => {
  await basicSeed(sc)

  await sc.createAccount('eve', {
    handle: 'eve.test',
    email: 'eve@eve.com',
    password: '2hunter',
  })

  const newList = await sc.createList(
    sc.dids.alice,
    'blah starter pack list!',
    'reference',
  )
  await sc.addToList(sc.dids.alice, sc.dids.bob, newList)
  await sc.addToList(sc.dids.alice, sc.dids.carla, newList)

  return sc
}
