import { Entity, Column, PrimaryColumn, Index } from 'typeorm'

@Entity({ name: 'user_dids' })
export class UserDid {
  @PrimaryColumn('varchar')
  did: string

  @Column({ type: 'varchar', unique: true })
  @Index()
  username: string
}
