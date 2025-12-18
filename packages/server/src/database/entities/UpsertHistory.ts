/* eslint-disable */
import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm'
import { IUpsertHistory } from '../../Interface'

@Entity('auto_upsert_history')
export class UpsertHistory implements IUpsertHistory {
    @PrimaryGeneratedColumn({ type: 'numeric', name: 'id' })
    id: number

    @Column({ type: 'varchar', length: 15, name: 'guid' })
    guid: string

    @Index()
    @Column({ type: 'varchar', length: 15, name: 'chatflowid' })
    chatflowid: string

    @Column({ name: 'result' })
    result: string

    @Column({ name: 'flowdata' })
    flowData: string

    @Index()
    @Column({ type: 'numeric', name: 'created_by' })
    created_by: number

    @Column({ type: 'numeric', precision: 25, scale: 0, name: 'created_on' })
    created_on: number
}
