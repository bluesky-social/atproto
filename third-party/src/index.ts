import express from 'express'
import cors from 'cors'
import * as ucan from 'ucans'
import * as check from './ucan-checks'
import { service, UserStore } from '@bluesky-demo/common'

// WARNING: For demo only, do not actually store secret keys in plaintext.
const SECRET_KEY = 'I0HyDksQcCRdJBGVuE78Ts34SzyF7+xNprEQw/IRa51OuFZQc5ugqfgjeWRMehyfr7A1vXICRoUD5kqVadsRHA=='
const SERVER_KEY = ucan.EdKeypair.fromSecretKey(SECRET_KEY)
const SERVER_DID = SERVER_KEY.did()

const app = express()
app.use(express.json())
app.use(cors())

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

  // Get the user's root DID from twitter
  const userDid = await service.fetchUserDid(username)
  if (!userDid) {
    return res.status(401).send("User DID not found")
  }

  // Check that it's a valid ucan, that it's meant for this server, and that it has permission to post for the given username
  let u: ucan.Ucan
  try {
    u = await check.checkUcan(req, check.hasAudience(SERVER_DID), check.hasPostingPermission(username), check.hasRootDid(userDid))
  } catch (err) {
    return res.status(401).send(err)
  }

  // Create a new Ucan to send to twitter using the user's Ucan as proof that we have permission to post on their behalf
  const twitterDid = await service.getServerDid()
  const extendUcan = await ucan.build({
    audience: twitterDid,
    issuer: SERVER_KEY,
    capabilities: u.payload.att,
    proofs: [ucan.encode(u)]
  })
  const encoded = ucan.encode(extendUcan)

  const car = await service.fetchUser(userDid)
  const userStore = await UserStore.fromCarFile(car, SERVER_KEY)
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
