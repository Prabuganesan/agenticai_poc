import { Entity, Column, Index, PrimaryGeneratedColumn } from 'typeorm'
import { getBooleanColumnOptions, getJsonColumnType, getTimestampDefaultFunction, getTextColumnType } from '../utils/column-types'

@Entity('auto_sab_llm_usage')
export class LlmUsage {
    @PrimaryGeneratedColumn({ type: 'numeric', name: 'id' })
    id: number

    @Column({ type: 'varchar', length: 15, name: 'guid' })
    guid: string

    @Index()
    @Column({ type: 'varchar', length: 255, name: 'request_id', nullable: false })
    requestId: string

    @Index()
    @Column({ type: 'varchar', length: 15, name: 'execution_id', nullable: true })
    executionId?: string

    @Index()
    @Column({ type: 'varchar', length: 255, name: 'user_id', nullable: false })
    userId: string

    @Index()
    @Column({ type: 'varchar', length: 15, name: 'chatflow_id', nullable: true })
    chatflowId?: string

    @Column({ type: 'varchar', length: 255, name: 'chat_id', nullable: true })
    chatId?: string

    @Column({ type: 'varchar', length: 255, name: 'session_id', nullable: true })
    sessionId?: string

    // Feature and Location Tracking
    @Index()
    @Column({ type: 'varchar', length: 50, name: 'feature', nullable: false })
    feature: string

    @Column({ type: 'varchar', length: 255, name: 'node_id', nullable: true })
    nodeId?: string

    @Column({ type: 'varchar', length: 100, name: 'node_type', nullable: true })
    nodeType?: string

    @Column({ type: 'varchar', length: 255, name: 'node_name', nullable: true })
    nodeName?: string

    @Column({ type: 'varchar', length: 255, name: 'location', nullable: true })
    location?: string

    // LLM Details
    @Column({ type: 'varchar', length: 50, name: 'provider', nullable: false })
    provider: string

    @Index()
    @Column({ type: 'varchar', length: 100, name: 'model', nullable: false })
    model: string

    @Column({ type: 'varchar', length: 50, name: 'request_type', nullable: true })
    requestType?: string

    // Token Usage
    @Column({ type: 'integer', name: 'prompt_tokens', default: 0 })
    promptTokens: number

    @Column({ type: 'integer', name: 'completion_tokens', default: 0 })
    completionTokens: number

    @Column({ type: 'integer', name: 'total_tokens', default: 0 })
    totalTokens: number

    // Cost and Performance
    @Column({ type: 'decimal', precision: 20, scale: 12, name: 'cost', default: 0 })
    cost: number

    @Column({ type: 'integer', name: 'processing_time_ms', nullable: true })
    processingTimeMs?: number

    @Column({ type: 'integer', name: 'response_length', nullable: true })
    responseLength?: number

    // Status
    @Column({ ...getBooleanColumnOptions(true), name: 'success' })
    success: boolean

    @Column({ type: getTextColumnType(), name: 'error_message', nullable: true })
    errorMessage?: string

    @Column({ ...getBooleanColumnOptions(false), name: 'cache_hit' })
    cacheHit: boolean

    // Metadata
    @Column({ type: getJsonColumnType(), name: 'metadata', nullable: true })
    metadata?: any

    // Timestamps
    @Index()
    @Column({ type: 'timestamp', name: 'created_at', default: getTimestampDefaultFunction() })
    createdAt: Date
}
