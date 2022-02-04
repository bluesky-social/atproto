import styles from "@components/App.module.scss";

import React, { ChangeEvent, FormEvent } from 'react'

import { service, LocalUser, UserStore, Blockstore } from '@bluesky-demo/common'
import * as ucan from 'ucans'
import * as localStore from '@common/localstore'

interface Props {
  blockstore: Blockstore
  onRegister: (user: LocalUser) => void
}

function Register(props: Props) {

  const [username, setUsername] = React.useState<string>('')

  const updateUsername = (e: ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value)
  }


  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const keypair = await ucan.EdKeypair.create({ exportable: true })
    const blueskyDid = await service.getServerDid()
    const token = await ucan.build({
      audience: blueskyDid,
      issuer: keypair
    })
    const userStore = await UserStore.create(username, props.blockstore, keypair)
    await service.register(await userStore.getCarFile(), ucan.encode(token))

    // LOCAL STORAGE IS NOT SAFE. DO NOT DO THIS IN PRODUCTION
    localStore.setUser(username, await keypair.export('base64pad'))
    props.onRegister({ username, keypair })
  }

  return (
    <div>
      <p className={styles.paragraph}>Register account</p>
      <form onSubmit={onSubmit}>
        <input onChange={updateUsername} value={username} />
        <br/>
        <button type='submit'>Register</button>
      </form>
    </div>
  )

}

export default Register
