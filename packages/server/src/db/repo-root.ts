import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'repo_roots' })
export class RepoRoot {
  @PrimaryColumn('varchar')
  did: string

  @Column('varchar')
  root: string

  @UpdateDateColumn()
  indexedAt: Date
}
