import { Labeler } from './base'

export class NoopLabeler extends Labeler {
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
