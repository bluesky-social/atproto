export const formatAdminAuthHeader = (password: string) => {
  return 'Basic ' + Buffer.from(`admin:${password}`).toString('base64')
}

export const parseAdminAuthHeader = (header: string) => {
  const noPrefix = header.startsWith('Basic ') ? header.slice(6) : header
  const [username, password] = Buffer.from(noPrefix, 'base64')
    .toString()
    .split(':')
  if (username !== 'admin') {
    throw new Error("Unexpected username in admin headers. Expected 'admin'")
  }
  return password
}
