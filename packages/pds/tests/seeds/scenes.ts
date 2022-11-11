import { SeedClient } from './client'

// requires usersSeed to be run first
export default async (sc: SeedClient) => {
  const alice = sc.dids.alice
  const bob = sc.dids.bob
  const carol = sc.dids.carol
  const dan = sc.dids.dan

  await sc.createScene(bob, 'scene.test')
  await sc.inviteToScene('scene.test', sc.actorRef(alice))
  await sc.inviteToScene('scene.test', sc.actorRef(carol))
  await sc.inviteToScene('scene.test', sc.actorRef(dan))
  await sc.acceptSceneInvite(
    alice,
    'scene.test',
    sc.sceneInvites['scene.test'][alice],
  )
  await sc.acceptSceneInvite(
    carol,
    'scene.test',
    sc.sceneInvites['scene.test'][carol],
  )
  await sc.acceptSceneInvite(
    dan,
    'scene.test',
    sc.sceneInvites['scene.test'][dan],
  )

  await sc.createScene(alice, 'alice-scene.test')

  await sc.createScene(bob, 'other-scene.test')
  await sc.inviteToScene('other-scene.test', sc.actorRef(alice))
  await sc.inviteToScene('other-scene.test', sc.actorRef(carol))

  await sc.createScene(carol, 'carol-scene.test')
  await sc.inviteToScene('carol-scene.test', sc.actorRef(alice))
  await sc.inviteToScene('carol-scene.test', sc.actorRef(bob))
  await sc.inviteToScene('carol-scene.test', sc.actorRef(dan))
  await sc.acceptSceneInvite(
    alice,
    'carol-scene.test',
    sc.sceneInvites['carol-scene.test'][alice],
  )
  await sc.acceptSceneInvite(
    dan,
    'carol-scene.test',
    sc.sceneInvites['carol-scene.test'][dan],
  )
}
