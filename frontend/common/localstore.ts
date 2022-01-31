export function setUser (username: string, secretKeyBase64: string) {
  localStorage.setItem('username', username)
  localStorage.setItem('secretKey', secretKeyBase64)
}

export function clearUser () {
  localStorage.removeItem('username')
  localStorage.removeItem('secretKey')
}