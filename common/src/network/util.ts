import axios, { AxiosError } from 'axios'

export const assureAxiosError = (err: unknown): AxiosError => {
  if (axios.isAxiosError(err)) return err
  throw err
}
