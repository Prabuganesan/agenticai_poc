import { ICustomTemplate } from '../../Interface'
import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm'
import { getTextColumnType } from '../utils/column-types'

@Entity('auto_custom_template')
export class CustomTemplate implements ICustomTemplate {
    @PrimaryGeneratedColumn({ type: 'numeric', name: 'id' })
    id: number

    @Column({ type: 'varchar', length: 15, name: 'guid' })
    guid: string

    @Column({ name: 'name' })
    name: string

    @Column({ type: getTextColumnType(), name: 'flowdata' })
    flowData: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'description' })
    description?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'badge' })
    badge?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'framework' })
    framework?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'usecases' })
    usecases?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'type' })
    type?: string

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
