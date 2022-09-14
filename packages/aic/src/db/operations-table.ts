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

  @Column('int')
  num: number

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
