import express from 'express'
import cors from 'cors'
import * as ucan from 'ucans'
import { service, UserStore, Blockstore, ucanCheck } from '@bluesky-demo/common'

// WARNING: For demo only, do not actually store secret keys in plaintext.
const SECRET_KEY = 'I0HyDksQcCRdJBGVuE78Ts34SzyF7+xNprEQw/IRa51OuFZQc5ugqfgjeWRMehyfr7A1vXICRoUD5kqVadsRHA=='
const SERVER_KEYPAIR = ucan.EdKeypair.fromSecretKey(SECRET_KEY)
const SERVER_DID = SERVER_KEYPAIR.did()

const app = express()
app.use(express.json())
app.use(cors())

// attach blockstore instance
const blockstore = new Blockstore()
app.use((req, res, next) => {
  res.locals.blockstore = blockstore
  next()
})

// Return the server's did
app.get('/.well-known/did.json', (_req, res) => {
  res.send({ id: SERVER_DID })
})

app.post('/post', async (req, res) => {
  // Verify req params
  const { username } = req.body
  if (typeof username !== 'string') {
    return res.status(400).send("Bad param: 'username' should be a string")
  }

  // Get the user's root DID from bluesky
  const userDid = await service.fetchUserDid(username)
  if (!userDid) {
    return res.status(401).send("User DID not found")
  }

  // Check that it's a valid ucan, that it's meant for this server, and that it has permission to post for the given username
  let u: ucan.Chained
  try {
    u = await ucanCheck.checkUcan(
      req,
      ucanCheck.hasAudience(SERVER_DID),
      ucanCheck.hasPostingPermission(username, userDid)
    )
  } catch (err) {
    return res.status(401).send(err)
  }

  // Create a new Ucan to send to bluesky using the user's Ucan as proof that we have permission to post on their behalf
  const blueskyDid = await service.getServerDid()
  const extendUcan = await ucan.build({
    audience: blueskyDid,
    issuer: SERVER_KEYPAIR,
    capabilities: u.attenuation(),
    proofs: [u.encoded()]
  })
  const encoded = ucan.encode(extendUcan)

  const car = await service.fetchUser(userDid)
  const userStore = await UserStore.fromCarFile(car, res.locals.blockstore, SERVER_KEYPAIR)
  await userStore.addPost({
    user: username,
    text: `Hey there! I'm posting on ${username}'s behalf`
  })

  await service.updateUser(await userStore.getCarFile(), encoded)
  res.status(200).send()
})

const PORT = 2584
app.listen(PORT, () => {
  console.log(`⚡️ Third party server is running at http://localhost:${PORT}`)
})
