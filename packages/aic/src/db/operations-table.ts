import {
  Entity,
  Column,
  PrimaryColumn,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm'

@Entity({ name: 'operations' })
export class OperationsTable {
  @PrimaryColumn('varchar')
  did: string

  @Column('text')
  operation: string

  @PrimaryColumn('varchar')
  cid: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}

export default OperationsTable
