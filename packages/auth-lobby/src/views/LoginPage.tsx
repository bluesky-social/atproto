import React, { useState } from 'react'

import * as auth from '@adxp/auth'
import * as awake from '@adxp/awake'
import * as env from '../env'

import { Btn } from '../components/Btn'
import { Spinner } from '../components/Spinner'

interface Props {
  authStore: auth.AuthStore
  loginAsRoot: () => void
  checkAuthorized: () => Promise<void>
}

const LoginPage: React.FC<Props> = (props) => {
  const [pin, setPin] = useState<number | null>(null)
  const [searching, setSearching] = useState<boolean>(false)
  const [error, setError] = useState<boolean>(false)

  const linkDevice = async () => {
    setError(false)
    try {
      const requester = await awake.Requester.create(
        env.RELAY_HOST,
        env.ROOT_USER,
        await props.authStore.did(),
      )
      setSearching(true)
      const pin = await requester.findProvider()
      setSearching(false)
      setPin(pin)
      const token = await requester.awaitDelegation()
      await props.authStore.addUcan(token)
      requester.close()
      props.checkAuthorized()
    } catch (err: any) {
      console.log(err)
      setPin(null)
      setError(true)
    }
  }

  return (
    <div className="mx-auto sm:max-w-lg sm:my-4 sm:border sm:border-gray-400 sm:rounded-xl">
      <h1 className="text-3xl font-bold border-b border-gray-200 px-6 py-4">
        Log in{' '}
        <small className="text-gray-500 font-mono relative -inset-y-px">
          [dev]
        </small>
      </h1>
      <div className="px-6 py-4">
        <div className="flex flex-col sm:flex-row gap-2">
          {!searching && !pin && (
            <Btn type="primary" filled onClick={linkDevice}>
              Link Device
            </Btn>
          )}
          {searching && (
            <Btn type="primary" filled disabled>
              <Spinner color="white" bgColor="blue" size="w-6 h-6" />
            </Btn>
          )}
          <Btn onClick={props.loginAsRoot}>Debug: Login As Root</Btn>
        </div>
        {searching && <div className="mt-4">Searching for provider...</div>}
        {error && <div className="mt-4">Linking failed. Try again?</div>}
        {pin && (
          <div className="mt-4 bg-gray-100 rounded-full px-6 py-4 text-2xl text-gray-700 font-bold text-center">
            Pin: <span className="font-mono">{pin}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default LoginPage
