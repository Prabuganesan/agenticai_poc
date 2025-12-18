/* eslint-disable */
import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm'
import { IChatMessage, MessageType } from '../../Interface'
import { getTextColumnType } from '../utils/column-types'

@Entity('auto_chat_message')
export class ChatMessage implements IChatMessage {
    @PrimaryGeneratedColumn({ type: 'numeric', name: 'id' })
    id: number

    @Column({ type: 'varchar', length: 15, name: 'guid' })
    guid: string

    @Column({ name: 'role' })
    role: MessageType

    @Index()
    @Column({ type: 'varchar', name: 'chatflowid' })
    chatflowid: string

    @Index()
    @Column({ nullable: true, type: 'varchar', name: 'executionid' })
    executionId?: string

    @Column({ type: getTextColumnType(), name: 'content' })
    content: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'sourcedocuments' })
    sourceDocuments?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'usedtools' })
    usedTools?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'fileannotations' })
    fileAnnotations?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'fileuploads' })
    fileUploads?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'agentreasoning' })
    agentReasoning?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'artifacts' })
    artifacts?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'action' })
    action?: string | null

    @Column({ name: 'chattype' })
    chatType: string

    @Index()
    @Column({ type: 'varchar', name: 'chatid' })
    chatId: string

    @Column({ nullable: true, name: 'memorytype' })
    memoryType?: string

    @Index()
    @Column({ type: 'varchar', nullable: true, name: 'sessionid' })
    sessionId?: string

    @Index()
    @Column({ type: 'numeric', name: 'created_by' })
    created_by: number

    @Column({ type: 'numeric', precision: 25, scale: 0, name: 'created_on' })
    created_on: number

    @Column({ nullable: true, type: getTextColumnType(), name: 'followupprompts' })
    followUpPrompts?: string
}
