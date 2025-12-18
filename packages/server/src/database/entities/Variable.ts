/* eslint-disable */
import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm'
import { IVariable } from '../../Interface'
import { getTextColumnType } from '../utils/column-types'

@Entity('auto_variable')
export class Variable implements IVariable {
    @PrimaryGeneratedColumn({ type: 'numeric', name: 'id' })
    id: number

    @Column({ type: 'varchar', length: 15, name: 'guid' })
    guid: string

    @Column({ name: 'name' })
    name: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'value' })
    value: string

    @Column({ default: 'string', type: getTextColumnType(), name: 'type' })
    type: string

    @Index()
    @Column({ type: 'numeric', name: 'created_by' })
    created_by: number

    @Column({ type: 'numeric', precision: 25, scale: 0, name: 'created_on' })
    created_on: number

    @Column({ nullable: true, type: 'numeric', name: 'last_modified_by' })
    last_modified_by?: number

    @Column({ nullable: true, type: 'numeric', precision: 25, scale: 0, name: 'last_modified_on' })
    last_modified_on?: number
}
