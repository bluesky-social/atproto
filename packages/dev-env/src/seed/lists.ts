import { SeedClient } from './client'
import { basicSeed } from './index'

export default async (sc: SeedClient) => {
  await basicSeed(sc)

  await sc.createAccount('eve', {
    handle: 'eve.test',
    email: 'eve@eve.com',
    password: 'hunter2',
  })
  await sc.createAccount('frankie', {
    handle: 'frankie.test',
    email: 'frankie@frankie.com',
    password: '2hunter2real',
  })
  await sc.createAccount('greta', {
    handle: 'greta.test',
    email: 'greta@greta.com',
    password: 'hunter4real',
  })

  const newList = await sc.createList(
    sc.dids.eve,
    'blah starter pack list!',
    'reference',
  )
  await sc.addToList(sc.dids.eve, sc.dids.eve, newList)
  await sc.addToList(sc.dids.eve, sc.dids.bob, newList)
  await sc.addToList(sc.dids.eve, sc.dids.frankie, newList)
  await sc.block(sc.dids.frankie, sc.dids.eve)

  return sc
}
