import { Entity, Column, Index, PrimaryGeneratedColumn, ManyToOne, JoinColumn, RelationId } from 'typeorm'
import { IExecution, ExecutionState } from '../../Interface'
import { ChatFlow } from './ChatFlow'
import { ChatSession } from './ChatSession'
import { getBooleanColumnOptions, getTextColumnType } from '../utils/column-types'

@Entity('auto_execution')
export class Execution implements IExecution {
    @PrimaryGeneratedColumn({ type: 'numeric', name: 'id' })
    id: number

    @Column({ type: 'varchar', length: 15, name: 'guid' })
    guid: string

    @Column({ type: getTextColumnType(), name: 'executiondata' })
    executionData: string

    @Column({ type: 'varchar', length: 50, name: 'state' })
    state: ExecutionState

    /** Explicit column for agentflowid - allows direct assignment in inserts */
    @Index()
    @Column({ type: 'varchar', length: 15, name: 'agentflowid' })
    agentflowid: string

    /** Relation to ChatFlow - using agentflowid column */
    @ManyToOne(() => ChatFlow, { onDelete: 'CASCADE', createForeignKeyConstraints: false })
    @JoinColumn({ name: 'agentflowid', referencedColumnName: 'guid' })
    agentflow: ChatFlow

    @RelationId((execution: Execution) => execution.agentflow)
    agentflowId: string // automatically populated from relation

    /** Explicit column for sessionid - allows direct assignment in inserts */
    @Index()
    @Column({ type: 'varchar', name: 'sessionid' })
    sessionid: string

    /** Relation to ChatSession - using sessionid column */
    @ManyToOne(() => ChatSession, { onDelete: 'SET NULL', nullable: true, createForeignKeyConstraints: false })
    @JoinColumn({ name: 'sessionid', referencedColumnName: 'guid' })
    session: ChatSession

    @RelationId((execution: Execution) => execution.session)
    sessionId: string // automatically populated from relation

    @Column({ nullable: true, type: getTextColumnType(), name: 'action' })
    action?: string

    @Column({ ...getBooleanColumnOptions(false), nullable: true, name: 'ispublic' })
    isPublic?: boolean

    @Index()
    @Column({ type: 'numeric', name: 'created_by' })
    created_by: number

    @Column({ type: 'numeric', precision: 25, scale: 0, name: 'created_on' })
    created_on: number

    @Column({ nullable: true, type: 'numeric', name: 'last_modified_by' })
    last_modified_by?: number

    @Column({ nullable: true, type: 'numeric', precision: 25, scale: 0, name: 'last_modified_on' })
    last_modified_on?: number

    @Column({ nullable: true, type: 'numeric', precision: 25, scale: 0, name: 'stoppeddate' })
    stoppedDate?: number
}
