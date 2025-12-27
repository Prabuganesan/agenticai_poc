import { Entity, Column, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn, RelationId } from 'typeorm'
import { Schedule } from './Schedule'
import { getTextColumnType } from '../utils/column-types'

export enum ScheduleRunStatus {
    PENDING = 'pending',
    RUNNING = 'running',
    COMPLETED = 'completed',
    FAILED = 'failed',
    SKIPPED = 'skipped'
}

export interface IScheduleRun {
    id: number
    guid: string
    scheduleId: string
    status: ScheduleRunStatus
    jobId?: string
    scheduledAt: Date
    startedAt?: Date
    completedAt?: Date
    durationMs?: number
    attempt: number
    result?: string
    errorMessage?: string
    created_on: number
}

@Entity('auto_schedule_run')
export class ScheduleRun implements IScheduleRun {
    @PrimaryGeneratedColumn({ type: 'numeric', name: 'id' })
    id: number

    @Column({ type: 'varchar', length: 15, name: 'guid', unique: true })
    guid: string

    // Reference to schedule
    @Index()
    @Column({ type: 'varchar', length: 15, name: 'schedule_id' })
    scheduleId: string

    @ManyToOne(() => Schedule, { onDelete: 'CASCADE', createForeignKeyConstraints: false })
    @JoinColumn({ name: 'schedule_id', referencedColumnName: 'guid' })
    schedule: Schedule

    @RelationId((scheduleRun: ScheduleRun) => scheduleRun.schedule)
    scheduleRelationId: string

    // Execution details
    @Index()
    @Column({ type: 'varchar', length: 20, name: 'status' })
    status: ScheduleRunStatus

    @Column({ nullable: true, type: 'varchar', length: 100, name: 'job_id' })
    jobId?: string

    // Timing
    @Index()
    @Column({ type: 'timestamp with time zone', name: 'scheduled_at' })
    scheduledAt: Date

    @Column({ nullable: true, type: 'timestamp with time zone', name: 'started_at' })
    startedAt?: Date

    @Column({ nullable: true, type: 'timestamp with time zone', name: 'completed_at' })
    completedAt?: Date

    @Column({ nullable: true, type: 'bigint', name: 'duration_ms' })
    durationMs?: number

    // Retry tracking
    @Column({ type: 'integer', default: 1, name: 'attempt' })
    attempt: number

    // Result data
    @Column({ nullable: true, type: getTextColumnType(), name: 'result' })
    result?: string

    @Column({ nullable: true, type: getTextColumnType(), name: 'error_message' })
    errorMessage?: string

    // Audit
    @Column({ type: 'numeric', precision: 25, scale: 0, name: 'created_on' })
    created_on: number
}
