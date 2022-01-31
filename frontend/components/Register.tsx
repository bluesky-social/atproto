import styles from "@components/App.module.scss";

import React, { ChangeEvent, FormEvent } from 'react'

import { service, LocalUser, UserStore, check } from '@bluesky-demo/common'
import * as ucan from 'ucans'

interface Props {
  onRegister: (user: LocalUser) => void
}

function Register(props: Props) {

  const [username, setUsername] = React.useState<string>('')
  const [usernameIssue, setUsernameIssue] = React.useState<string>('')

  const updateUsername = (e: ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value)
  }


  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setUsernameIssue('')

    if (!check.isUsername(username)) {
      // TODO: the domain comes from somewhere else, obviously
      setUsernameIssue('Must be an email-like username, e.g. bob@home.com')
      return
    }

    const keypair = await ucan.EdKeypair.create({ exportable: true })
    const blueskyDid = await service.getServerDid()
    const token = await ucan.build({
      audience: blueskyDid,
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
        {usernameIssue !== '' ? <div className={styles.error}>{usernameIssue}</div> : null}
        <br/>
        <button type='submit'>Register</button>
      </form>
    </div>
  )

}

export default Register
