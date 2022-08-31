import { Entity, Column, PrimaryColumn } from 'typeorm'

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
}
