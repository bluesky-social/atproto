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

  const linkDevice = async () => {
    const requester = await awake.Requester.create(
      env.RELAY_HOST,
      env.ROOT_USER,
      await props.authStore.getDid(),
    )
    const pin = await requester.findProvider()
    setPin(pin)
    const token = await requester.awaitDelegation()
    await props.authStore.addUcan(token)
    console.log('SUCCESS')
    props.checkAuthorized()
  }

  return (
    <div>
      <button onClick={linkDevice}>Link Device</button>
      {pin && <div>Pin: {pin}</div>}
    </div>
  )
}

export default LoginPage
