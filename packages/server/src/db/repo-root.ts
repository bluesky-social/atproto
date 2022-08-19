import { Entity, Column, PrimaryColumn } from 'typeorm'

@Entity({ name: 'repo_roots' })
export class RepoRoot {
  @PrimaryColumn('varchar')
  did: string

  @Column('varchar')
  root: string
}
