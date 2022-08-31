import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm'

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

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  indexedAt: Date
}
