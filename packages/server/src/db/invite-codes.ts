import { Entity, Column, PrimaryColumn } from 'typeorm'

@Entity({ name: 'invite_codes' })
export class InviteCode {
  @PrimaryColumn('varchar')
  code: string

  @Column('integer')
  availableUses: number

  @Column({ type: 'boolean', default: false })
  disabled: boolean

  @Column('varchar')
  forUser: string

  @Column('varchar')
  createdBy: string
}

@Entity({ name: 'invite_codes_uses' })
export class InviteCodeUse {
  @PrimaryColumn('varchar')
  code: string

  @PrimaryColumn('varchar')
  usedBy: string

  @Column('varchar')
  usedAt: string
}
