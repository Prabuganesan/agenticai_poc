/* eslint-disable */
import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm'
import { IChatSession } from '../../Interface'
import { getTextColumnType } from '../utils/column-types'

@Entity('auto_sab_chat_session')
export class ChatSession implements IChatSession {
    @PrimaryGeneratedColumn({ type: 'numeric', name: 'id' })
    id: number

    @Column({ type: 'varchar', length: 15, name: 'guid' })
    guid: string

    @Index()
    @Column({ type: 'varchar', length: 15, name: 'chatflowid' })
    chatflowId: string

    @Index()
    @Column({ type: 'varchar', unique: true, name: 'chatid' })
    chatId: string

    @Column({ type: 'varchar', length: 255, nullable: true, name: 'title' })
    title?: string

    @Index()
    @Column({ type: 'numeric', name: 'created_by' })
    created_by: number

    @Column({ type: 'numeric', precision: 25, scale: 0, name: 'created_on' })
    created_on: number

    @Column({ type: 'integer', default: 0, name: 'messagecount' })
    messageCount: number

    @Column({ type: getTextColumnType(), nullable: true, name: 'preview' })
    preview?: string
}

