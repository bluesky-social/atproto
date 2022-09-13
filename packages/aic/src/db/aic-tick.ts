import {
  Entity,
  Column,
  PrimaryColumn,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm'

@Entity({ name: 'aic-tick' })
export class AicTick {
  @PrimaryColumn('varchar')
  did: string

  @PrimaryColumn('varchar')
  tid: string

  @Column('text')
  tick: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}

// table.string('did') // did the tick is for /did:aic:[2-7a-z]{16}/
// table.string('tid') // consensus tid of the tick /[2-7a-z]{4}-[2-7a-z]{3}-[2-7a-z]{4}-[2-7a-z]{2}/
// table.text('tick') // the tick signed by the consortium
// table.primary(['did', 'tid'])
