import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm'
import { DocumentStoreStatus, IDocumentStore } from '../../Interface'
import { getTextColumnType } from '../utils/column-types'
import dotenv from 'dotenv'
import path from 'path'

const envPath = path.join(__dirname,'..', '..', '..', '.env')
dotenv.config({ path: envPath, override: true })
@Entity('auto_document_store')
export class DocumentStore implements IDocumentStore {
    @PrimaryGeneratedColumn({ type: 'numeric', name: 'id' })
    id: number

    @Column({ type: 'varchar', length: 15, name: 'guid' })
    guid: string

    @Column({ nullable: false, type: getTextColumnType(), name: 'name' })
    name: string

    @Column({ nullable: true, length: 50, name: 'display_name' })
    display_name?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'description' })
    description: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'loaders' })
    loaders: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'whereused' })
    whereUsed: string

    @Column({ nullable: false, type: getTextColumnType(), name: 'status' })
    status: DocumentStoreStatus

    @Column({ nullable: true, type: getTextColumnType(), name: 'vectorstoreconfig' })
    vectorStoreConfig: string | null

    @Column({ nullable: true, type: getTextColumnType(), name: 'embeddingconfig' })
    embeddingConfig: string | null

    @Column({ nullable: true, type: getTextColumnType(), name: 'recordmanagerconfig' })
    recordManagerConfig: string | null

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
