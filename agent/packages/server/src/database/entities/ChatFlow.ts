/* eslint-disable */
import { Entity, Column, PrimaryGeneratedColumn, Unique, Index } from 'typeorm'
import { ChatflowType, IChatFlow } from '../../Interface'
import { getBooleanColumnOptions, getTextColumnType } from '../utils/column-types'

export enum EnumChatflowType {
    CHATFLOW = 'CHATFLOW',
    AGENTFLOW = 'AGENTFLOW',
    ASSISTANT = 'ASSISTANT'
}

@Entity('auto_chat_flow')
@Unique(['name'])
export class ChatFlow implements IChatFlow {
    @PrimaryGeneratedColumn({ type: 'numeric', name: 'id' })
    id: number

    @Column({ type: 'varchar', length: 15, name: 'guid' })
    guid: string

    @Column({ name: 'name' })
    name: string

    @Column({ nullable: true, length: 50, name: 'display_name' })
    display_name?: string

    @Column({ type: getTextColumnType(), name: 'flowdata' })
    flowData: string

    @Column({ ...getBooleanColumnOptions(false), nullable: true, name: 'deployed' })
    deployed?: boolean

    @Column({ ...getBooleanColumnOptions(false), nullable: true, name: 'ispublic' })
    isPublic?: boolean

    @Column({ nullable: true, name: 'apikeyid' })
    apikeyid?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'chatbotconfig' })
    chatbotConfig?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'apiconfig' })
    apiConfig?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'analytic' })
    analytic?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'speechtotext' })
    speechToText?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'texttospeech' })
    textToSpeech?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'followupprompts' })
    followUpPrompts?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'category' })
    category?: string

    @Column({ type: 'varchar', length: 20, default: EnumChatflowType.CHATFLOW, name: 'type' })
    type?: ChatflowType

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
