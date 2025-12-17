/* eslint-disable */
import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm'
import { AssistantType, IAssistant } from '../../Interface'
import { getTextColumnType } from '../utils/column-types'

@Entity('auto_assistant')
export class Assistant implements IAssistant {
    @PrimaryGeneratedColumn({ type: 'numeric', name: 'id' })
    id: number

    @Column({ type: 'varchar', length: 15, name: 'guid' })
    guid: string

    @Column({ nullable: true, length: 50, name: 'display_name' })
    display_name?: string

    @Column({ type: getTextColumnType(), name: 'details' })
    details: string

    @Column({ type: 'varchar', length: 15, nullable: true, name: 'credential' })
    credential?: string

    @Column({ nullable: true, name: 'iconsrc' })
    iconSrc?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'type' })
    type?: AssistantType

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
