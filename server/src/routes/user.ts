import express from 'express'
import * as ucan from 'ucans'
import { ucanCheck, UserStore, MemoryDB } from '@bluesky-demo/common'
import * as UserDids from '../user-dids.js'
import * as UserRoots from '../user-roots.js'
import { readReqBytes } from '../util.js'
import { SERVER_KEYPAIR, SERVER_DID } from '../server-identity.js'


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
  } catch(err: any) {
    return res.status(401).send(`Invalid Ucan: ${err.toString()}`)
  }

  let userStore: UserStore
  try {
    const bytes = await readReqBytes(req)
    // @TODO: make a read-only vesion of user store that doesn't require keypair
    userStore = await UserStore.fromCarFile(bytes, MemoryDB.getGlobal(), SERVER_KEYPAIR)
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
    userStore = await UserStore.fromCarFile(bytes, MemoryDB.getGlobal(), SERVER_KEYPAIR)
  }catch(err) {
    return res.status(400).send("Could not parse UserStore from CAR File")
  }

  const user = await userStore.getUser()
  const userDid = await UserDids.get(user.name)

  let u: ucan.Chained
  try {
    if (userDid) {
      u = await ucanCheck.checkUcan(
        req,
        ucanCheck.hasAudience(SERVER_DID),
        ucanCheck.hasPostingPermission(user.name, userDid)
      )
    } else {
      throw new Error(`User not found: ${user.name}`)
    }
  } catch(err) {
    return res.status(401).send(err)
  }

  // @TODO: verify signature on data structure

  await UserRoots.set(userDid, userStore.root)

  return res.sendStatus(200)
})

router.get('/:id', async (req, res) => {
  const { id } = req.params

  const userRoot = await UserRoots.get(id)

  if (!userRoot) {
    return res.status(404).end()
  }

  const userStore = await UserStore.get(userRoot, MemoryDB.getGlobal(), SERVER_KEYPAIR)

  const bytes = await userStore.getCarFile()
  return res.status(200).send(Buffer.from(bytes))
})

export default router
