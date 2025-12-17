import { Column, Entity, PrimaryGeneratedColumn, Unique, Index } from 'typeorm'
import { IApiKey } from '../../Interface'
import { getTextColumnType } from '../utils/column-types'

@Entity('auto_apikey')
@Unique(['keyName'])
export class ApiKey implements IApiKey {
    @PrimaryGeneratedColumn({ type: 'numeric', name: 'id' })
    id: number

    @Column({ type: 'varchar', length: 15, name: 'guid' })
    guid: string

    @Column({ type: getTextColumnType(), name: 'apikey' })
    apiKey: string

    @Column({ type: getTextColumnType(), name: 'apisecret' })
    apiSecret: string

    @Column({ type: getTextColumnType(), name: 'keyname' })
    keyName: string

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
