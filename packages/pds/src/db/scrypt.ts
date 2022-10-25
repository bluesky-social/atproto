import crypto from 'crypto'

export const hash = (password: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex')
    crypto.scrypt(password, salt, 64, (err, hash) => {
      if (err) reject(err)
      resolve(salt + ':' + hash.toString('hex'))
    })
  })
}

export const verify = (
  password: string,
  storedHash: string,
): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const [salt, hash] = storedHash.split(':')
    crypto.scrypt(password, salt, 64, (err, derivedHash) => {
      if (err) reject(err)
      resolve(hash === derivedHash.toString('hex'))
    })
  })
}
