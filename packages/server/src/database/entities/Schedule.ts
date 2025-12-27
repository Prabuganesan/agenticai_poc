import { Entity, Column, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn, RelationId } from 'typeorm'
import { ChatFlow } from './ChatFlow'
import { getBooleanColumnOptions, getTextColumnType } from '../utils/column-types'

export enum ScheduleType {
    ONE_TIME = 'one-time',
    INTERVAL = 'interval',
    CRON = 'cron'
}

export enum ScheduleStatus {
    ACTIVE = 'active',
    PAUSED = 'paused',
    COMPLETED = 'completed',
    FAILED = 'failed'
}

export enum ScheduleTargetType {
    CHATFLOW = 'CHATFLOW',
    AGENTFLOW = 'AGENTFLOW'
}

export interface ISchedule {
    id: number
    guid: string
    name: string
    targetType: ScheduleTargetType
    targetId: string
    frozenVersion?: string
    scheduleType: ScheduleType
    cronExpression?: string
    intervalMs?: number
    timezone: string
    nextRunAt?: Date
    lastRunAt?: Date
    startedAt?: Date
    endsAt?: Date
    maxRetries: number
    retryDelayMs: number
    status: ScheduleStatus
    runCount: number
    failureCount: number
    inputPayload?: string
    created_by: number
    created_on: number
    last_modified_by?: number
    last_modified_on?: number
}

@Entity('auto_schedule')
export class Schedule implements ISchedule {
    @PrimaryGeneratedColumn({ type: 'numeric', name: 'id' })
    id: number

    @Column({ type: 'varchar', length: 15, name: 'guid', unique: true })
    guid: string

    @Column({ type: 'varchar', length: 255, name: 'name' })
    name: string

    // Target configuration
    @Column({ type: 'varchar', length: 20, name: 'target_type' })
    targetType: ScheduleTargetType

    @Index()
    @Column({ type: 'varchar', length: 15, name: 'target_id' })
    targetId: string

    @ManyToOne(() => ChatFlow, { onDelete: 'CASCADE', createForeignKeyConstraints: false })
    @JoinColumn({ name: 'target_id', referencedColumnName: 'guid' })
    target: ChatFlow

    @RelationId((schedule: Schedule) => schedule.target)
    targetRelationId: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'frozen_version' })
    frozenVersion?: string

    // Schedule configuration
    @Column({ type: 'varchar', length: 20, name: 'schedule_type' })
    scheduleType: ScheduleType

    @Column({ nullable: true, type: 'varchar', length: 100, name: 'cron_expression' })
    cronExpression?: string

    @Column({ nullable: true, type: 'bigint', name: 'interval_ms' })
    intervalMs?: number

    @Column({ type: 'varchar', length: 50, default: 'UTC', name: 'timezone' })
    timezone: string

    // Timing
    @Index()
    @Column({ nullable: true, type: 'timestamp with time zone', name: 'next_run_at' })
    nextRunAt?: Date

    @Column({ nullable: true, type: 'timestamp with time zone', name: 'last_run_at' })
    lastRunAt?: Date

    @Column({ nullable: true, type: 'timestamp with time zone', name: 'started_at' })
    startedAt?: Date

    @Column({ nullable: true, type: 'timestamp with time zone', name: 'ends_at' })
    endsAt?: Date

    // Retry configuration
    @Column({ type: 'integer', default: 3, name: 'max_retries' })
    maxRetries: number

    @Column({ type: 'bigint', default: 1000, name: 'retry_delay_ms' })
    retryDelayMs: number

    // Status
    @Index()
    @Column({ type: 'varchar', length: 20, default: ScheduleStatus.ACTIVE, name: 'status' })
    status: ScheduleStatus

    @Column({ type: 'integer', default: 0, name: 'run_count' })
    runCount: number

    @Column({ type: 'integer', default: 0, name: 'failure_count' })
    failureCount: number

    // Input configuration
    @Column({ nullable: true, type: getTextColumnType(), name: 'input_payload' })
    inputPayload?: string

    // Audit fields (matching existing pattern)
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
