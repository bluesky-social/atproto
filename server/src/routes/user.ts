import express from 'express'
import * as ucan from 'ucans'
import { ucanCheck, UserStore, Blockstore } from '@bluesky-demo/common'
import * as UserDids from '../user-dids'
import * as UserRoots from '../user-roots'
import { readReqBytes } from '../util'
import { SERVER_KEY, SERVER_DID } from '../server-identity'


const router = express.Router()

router.post('/register', async (req, res) => {
  // We look for a simple Ucan with no capabilities as proof the user is in possession of the given key
  let u: ucan.Chained
  try {
    u = await ucanCheck.checkUcan(
      req,
      ucanCheck.hasAudience(SERVER_DID),
      ucanCheck.isRoot()
    )
  } catch(err) {
    res.status(401).send(err)
  }

  let userStore: UserStore
  try {
    const bytes = await readReqBytes(req)
    userStore = await UserStore.fromCarFile(bytes, Blockstore.getGlobal(), SERVER_KEY)
  }catch(err) {
    return res.status(400).send("Could not parse UserStore from CAR File")
  }

  const user = await userStore.getUser()
  const currDid = await UserDids.get(user.name)
  if (currDid !== null) {
    return res.status(409).send(`Username ${user.name} already taken.`)
  }

  await Promise.all([
    UserDids.set(user.name, u.issuer()),
    UserRoots.set(u.issuer(), userStore.root)
  ])

  return res.sendStatus(200)
})

router.post('/update', async (req, res) => {
  let userStore: UserStore
  try {
    const bytes = await readReqBytes(req)
    userStore = await UserStore.fromCarFile(bytes, Blockstore.getGlobal(), SERVER_KEY)
  }catch(err) {
    return res.status(400).send("Could not parse UserStore from CAR File")
  }

  const user = await userStore.getUser()
  const userDid = await UserDids.get(user.name)

  let u: ucan.Chained
  try {
    u = await ucanCheck.checkUcan(
      req,
      ucanCheck.hasAudience(SERVER_DID),
      ucanCheck.hasPostingPermission(user.name, userDid)
    )
  } catch(err) {
    res.status(401).send(err)
  }

  // @@TODO: verify signature on data structure

  await UserRoots.set(userDid, userStore.root)

  return res.sendStatus(200)
})

router.get('/:id', async (req, res) => {
  const { id } = req.params

  const userRoot = await UserRoots.get(id)

  const userStore = await UserStore.get(userRoot, Blockstore.getGlobal(), SERVER_KEY)

  const bytes = await userStore.getCarFile()
  res.status(200).send(Buffer.from(bytes))
})

export default router
