import { Entity, Column, PrimaryColumn, Index } from 'typeorm'

@Entity({ name: 'users' })
export class User {
  @PrimaryColumn('varchar')
  did: string

  @Column({ type: 'varchar', unique: true })
  @Index()
  username: string

  @Column({ type: 'varchar', collation: 'nocase' })
  email: string

  @Column('varchar')
  password: string

  @Column('varchar')
  lastSeenNotifs: string

  @Column('varchar')
  createdAt: string
}
