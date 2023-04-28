import { Analytics } from '@segment/analytics-node'

// instantiation
const analytics = new Analytics({
  writeKey: 'SEGMENT_WRITE_KEY', // TODO: get this from .env
})

analytics.on('error', (err) => console.error(err)) // TODO: replace with logger

// identify new user (create account)
interface IdentifyNewUserProps {
  did: string
  handle: string
  email: string
  createdAt: string
  inviteCode?: string
}

const identifyNewUser = ({
  did,
  handle,
  email,
  createdAt,
  inviteCode,
}: IdentifyNewUserProps) => {
  return analytics.identify({
    userId: did,
    traits: {
      username: handle,
      email: email,
      createdAt: createdAt,
      inviteCode: inviteCode,
    },
  })
}

export { analytics, identifyNewUser }
