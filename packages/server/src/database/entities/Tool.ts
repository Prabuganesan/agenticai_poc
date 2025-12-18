/* eslint-disable */
import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm'
import { ITool } from '../../Interface'
import { getTextColumnType } from '../utils/column-types'

@Entity('auto_tool')
export class Tool implements ITool {
    @PrimaryGeneratedColumn({ type: 'numeric', name: 'id' })
    id: number

    @Column({ type: 'varchar', length: 15, name: 'guid' })
    guid: string

    @Column({ name: 'name' })
    name: string

    @Column({ type: getTextColumnType(), name: 'description' })
    description: string

    @Column({ name: 'color' })
    color: string

    @Column({ nullable: true, name: 'iconsrc' })
    iconSrc?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'schema' })
    schema?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'func' })
    func?: string

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
