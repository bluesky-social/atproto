import { Labeler } from './base'

export class NoopLabeler implements Labeler {
  async labelRecord(): Promise<string[]> {
    return []
  }
  async labelText(): Promise<string[]> {
    return []
  }
  async labelImg(): Promise<string[]> {
    return []
  }
}
