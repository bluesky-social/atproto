import { Entity, Column, PrimaryColumn } from 'typeorm'

@Entity({ name: 'operations' })
export class OperationsTable {
  @PrimaryColumn('varchar')
  did: string

  @Column('text')
  operation: string

  @PrimaryColumn('varchar')
  cid: string

  @Column('datetime')
  createdAt: Date
}

export default OperationsTable
