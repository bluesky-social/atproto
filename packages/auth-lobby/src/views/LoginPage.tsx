import React, { useState, useEffect, ChangeEvent } from 'react'

import * as auth from '@adxp/auth'
import * as awake from '@adxp/awake'
import * as env from '../env'

import { Btn } from '../components/Btn'
import { Spinner } from '../components/Spinner'
import { magic, getMagicKeypair } from '../magic'
import { writeCap, YEAR_IN_SEC } from '@adxp/auth'

interface Props {
  authStore: auth.AuthStore
  checkAuthorized: (did?: string) => Promise<boolean>
}

const LoginPage: React.FC<Props> = (props) => {
  const [email, setEmail] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const [accountDid, setAccountDid] = useState('')

  const [pin, setPin] = useState<number | null>(null)
  const [searching, setSearching] = useState<boolean>(false)
  const [error, setError] = useState<boolean>(false)

  const checkLoggedin = async () => {
    const magicKeypair = await getMagicKeypair()
    if (!magicKeypair) return

    const token = await auth.ucans
      .createBuilder()
      .issuedBy(magicKeypair)
      .toAudience(await props.authStore.did())
      .withLifetimeInSeconds(YEAR_IN_SEC)
      .claimCapability(writeCap(magicKeypair.did()))
      .build()

    console.log('Created Device token: ', token)

    await props.authStore.addUcan(token)

    const isAuthorized = await props.checkAuthorized(magicKeypair.did())
    if (isAuthorized) {
      await magic.user.logout()
    } else {
      console.log(
        'Something went wrong with auth check. Try refreshing the page',
      )
    }
  }

  useEffect(() => {
    checkLoggedin()
  }, [])

  const login = async () => {
    setIsLoggingIn(true)
    try {
      await magic.auth.loginWithEmailOTP({ email })
      await checkLoggedin()
    } catch (error) {
      console.log(error)
    }
    setIsLoggingIn(false)
  }

  const handleEmailChange = (evt: ChangeEvent<HTMLInputElement>) => {
    setEmail(evt.target.value)
  }

  const handleAccountDidChange = (evt: ChangeEvent<HTMLInputElement>) => {
    setAccountDid(evt.target.value)
  }

  const linkDevice = async () => {
    setError(false)
    try {
      console.log('ACCOUNT: ', accountDid)
      const requester = await awake.Requester.create(
        env.RELAY_HOST,
        accountDid,
        await props.authStore.did(),
      )
      setSearching(true)
      const pin = await requester.findProvider()
      setSearching(false)
      setPin(pin)
      const token = await requester.awaitDelegation()
      await props.authStore.addUcan(token)
      requester.close()
      props.checkAuthorized(accountDid)
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
        <div className="flex flex-col">
          <h3 className="text-center">Have another device?</h3>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {!searching && !pin && (
              <div>
                <input
                  name="accountDid"
                  required={true}
                  placeholder="Account DID"
                  onChange={handleAccountDidChange}
                ></input>
                <Btn type="primary" filled onClick={linkDevice}>
                  Link Device
                </Btn>
              </div>
            )}
            {searching && (
              <Btn type="primary" filled disabled>
                <Spinner color="white" bgColor="blue" size="w-6 h-6" />
              </Btn>
            )}
            {/* <Btn onClick={props.loginAsRoot}>Debug: Login As Root</Btn> */}
          </div>
          {searching && (
            <div className="mt-4 text-center">Searching for provider...</div>
          )}
          {error && (
            <div className="mt-4 text-center">Linking failed. Try again?</div>
          )}
          {pin && (
            <div className="mt-4 bg-gray-100 rounded-full px-6 py-4 text-2xl text-gray-700 font-bold text-center">
              Pin: <span className="font-mono">{pin}</span>
            </div>
          )}
        </div>
      </div>
      <hr />
      <div className="px-6 py-4 flex flex-col">
        <h3 className="text-center">Or Login/Signup with your email</h3>
        <div className="py-2 flex justify-center">
          <input
            type="email"
            name="email"
            required={true}
            placeholder="email"
            onChange={handleEmailChange}
            disabled={isLoggingIn}
          ></input>
          <Btn type="primary" onClick={login}>
            Login or Signup
          </Btn>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
