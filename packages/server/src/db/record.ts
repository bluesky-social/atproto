import {
  Entity,
  Column,
  PrimaryColumn,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm'

@Entity({ name: 'records' })
export class AdxRecord {
  @PrimaryColumn('varchar')
  uri: string

  @Column('varchar')
  did: string

  @Column('varchar')
  collection: string

  @Column('varchar')
  tid: string

  @CreateDateColumn()
  receivedAt: Date

  @UpdateDateColumn()
  indexedAt: Date
}
