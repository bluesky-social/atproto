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
    await awake.Requester.openChannel(
      env.RELAY_HOST,
      env.ROOT_USER,
      props.authStore,
      setPin,
      onSuccess,
    )
  }

  const onSuccess = async () => {
    console.log('SUCCESS')
    // @TODO any other clean up?
    props.checkAuthorized()
  }

  const onError = async () => {
    console.log('OH NO AN ERROR')
    // @TODO handle errors
  }

  return (
    <div>
      <button onClick={linkDevice}>Link Device</button>
      {pin && <div>Pin: {pin}</div>}
    </div>
  )
}

export default LoginPage
