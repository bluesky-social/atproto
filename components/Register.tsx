import styles from "@components/App.module.scss";

import React, { ChangeEvent, FormEvent } from 'react'

import * as service from '@common/service'
import * as ucan from 'ucans'

import { LocalUser } from '@root/common/types'
import UserStore from "@root/common/user-store";

interface Props {
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
    const twitterDid = await service.getServerDid()
    const token = await ucan.build({
      audience: twitterDid,
      issuer: keypair
    })
    const userStore = await UserStore.create(username, keypair)
    await service.register(await userStore.getCarFile(), ucan.encode(token))

    // LOCAL STORAGE IS NOT SAFE. DO NOT DO THIS IN PRODUCTION
    localStorage.setItem('secretKey', await keypair.export('base64pad'))
    localStorage.setItem('username', username)
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
