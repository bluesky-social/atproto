import { useState } from 'react'

import * as auth from '@adxp/auth'
import * as awake from '@adxp/awake'
import * as env from './env'

interface Props {
  authStore: auth.AuthStore
  checkAuthorized: () => Promise<void>
}

function LoginPage(props: Props) {
  const [pin, setPin] = useState<number | null>(null)
  const [searching, setSearching] = useState<boolean>(false)
  const [error, setError] = useState<boolean>(false)

  const linkDevice = async () => {
    setError(false)
    try {
      const requester = await awake.Requester.create(
        env.RELAY_HOST,
        env.ROOT_USER,
        await props.authStore.getDid(),
      )
      setSearching(true)
      const pin = await requester.findProvider()
      setSearching(false)
      setPin(pin)
      const token = await requester.awaitDelegation()
      await props.authStore.addUcan(token)
      requester.close()
      props.checkAuthorized()
    } catch (_err) {
      setPin(null)
      setError(true)
    }
  }

  return (
    <div>
      {error && <div>Linking failed. Try again?</div>}
      {!searching && !pin && <button onClick={linkDevice}>Link Device</button>}
      {searching && <div>Searching for provider...</div>}
      {pin && <div>Pin: {pin}</div>}
    </div>
  )
}

export default LoginPage
