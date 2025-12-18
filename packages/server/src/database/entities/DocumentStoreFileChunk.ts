import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import { IDocumentStoreFileChunk } from '../../Interface'
import { getTextColumnType } from '../utils/column-types'

@Entity('auto_document_store_file_chunk')
export class DocumentStoreFileChunk implements IDocumentStoreFileChunk {
    @PrimaryGeneratedColumn({ type: 'numeric', name: 'id' })
    id: number

    @Column({ type: 'varchar', length: 15, name: 'guid' })
    guid: string

    @Index()
    @Column({ type: 'varchar', length: 15, name: 'docid' })
    docId: string

    @Index()
    @Column({ type: 'varchar', length: 15, name: 'storeid' })
    storeId: string

    @Column({ name: 'chunkno' })
    chunkNo: number

    @Column({ nullable: false, type: getTextColumnType(), name: 'pagecontent' })
    pageContent: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'metadata' })
    metadata: string
}
