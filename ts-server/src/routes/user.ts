import express from 'express'
import * as ucan from 'ucans'
import { ucanCheck, UserStore, MemoryDB } from '@bluesky-demo/common'
import * as UserDids from '../user-dids'
import * as UserRoots from '../user-roots'
import { readReqBytes } from '../util'
import { SERVER_KEY, SERVER_DID } from '../server-identity'


const router = express.Router()

router.post('/register', async (req, res) => {
  let u: ucan.Chained
  try {
    u = await ucanCheck.checkUcan(
      req,
      ucanCheck.hasAudience(SERVER_DID)
    )
  } catch(err) {
    res.status(401).send(err)
  }

  const bytes = await readReqBytes(req)
  const userStore = await UserStore.fromCarFile(bytes, MemoryDB.getGlobal(), SERVER_KEY)
  const user = await userStore.getUser()

  // @@TODO: Verify UserStore

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
  let u: ucan.Chained
  try {
    u = await ucanCheck.checkUcan(
      req,
      ucanCheck.hasAudience(SERVER_DID)
    )
  } catch(err) {
    res.status(401).send(err)
  }

  // @@TODO: Verify UserStore

  const bytes = await readReqBytes(req)
  const userStore = await UserStore.fromCarFile(bytes, MemoryDB.getGlobal(), SERVER_KEY)
  await UserRoots.set(u.issuer(), userStore.root)

  return res.sendStatus(200)
})

router.get('/:id', async (req, res) => {
  const { id } = req.params

  const userRoot = await UserRoots.get(id)

  const userStore = await UserStore.get(userRoot, MemoryDB.getGlobal(), SERVER_KEY)

  const bytes = await userStore.getCarFile()
  res.status(200).send(Buffer.from(bytes))
})

export default router
