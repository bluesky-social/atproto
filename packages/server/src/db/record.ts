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

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  receivedAt: Date

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  indexedAt: Date
}
