import styles from "@components/App.module.scss";

import React, { ChangeEvent, FormEvent } from 'react'

import axios from 'axios'
import * as ucan from 'ucans'
import { LocalUser } from '@root/common/types'
import { TWITTER_DID } from "@root/common/const";

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
    const token = await ucan.build({
      audience: TWITTER_DID,
      issuer: keypair
    })
    const encoded = ucan.encode(token)
    await axios.post('http://localhost:2583/register', username, { headers: { "authorization": `Bearer ${encoded}` }})
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
