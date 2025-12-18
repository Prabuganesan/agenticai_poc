/* eslint-disable */
import { Entity, Column, PrimaryGeneratedColumn, Index, Unique, ManyToOne, JoinColumn, Check } from 'typeorm'
import { IChatMessageFeedback, ChatMessageRatingType } from '../../Interface'
import { ChatMessage } from './ChatMessage'
import { ChatFlow } from './ChatFlow'
import { getTextColumnType } from '../utils/column-types'

@Entity('auto_chat_message_feedback')
@Unique(['messageId'])
@Check(`rating IS NULL OR rating IN ('positive', 'negative', 'neutral')`)
export class ChatMessageFeedback implements IChatMessageFeedback {
    @PrimaryGeneratedColumn({ type: 'numeric', name: 'id' })
    id: number

    @Column({ type: 'varchar', length: 15, name: 'guid' })
    guid: string

    @Index()
    @ManyToOne(() => ChatFlow, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'chatflowid', referencedColumnName: 'guid' })
    chatflow: ChatFlow

    @Column({ type: 'varchar', name: 'chatflowid' })
    chatflowid: string

    @Index()
    @Column({ type: 'varchar', name: 'chatid' })
    chatId: string

    @ManyToOne(() => ChatMessage, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'messageid', referencedColumnName: 'guid' })
    message: ChatMessage

    @Column({ type: 'varchar', name: 'messageid' })
    messageId: string

    @Column({ nullable: true, name: 'rating' })
    rating: ChatMessageRatingType

    @Column({ nullable: true, type: getTextColumnType(), name: 'content' })
    content?: string

    @Index()
    @Column({ type: 'numeric', name: 'created_by' })
    created_by: number

    @Column({ type: 'numeric', precision: 25, scale: 0, name: 'created_on' })
    created_on: number
}
