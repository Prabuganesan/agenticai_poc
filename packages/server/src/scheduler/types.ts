import { Schedule } from '../database/entities/Schedule'
import { ScheduleRun } from '../database/entities/ScheduleRun'
import { IComponentNodes } from '../Interface'
import { CachePool } from '../CachePool'
import { UsageCacheManager } from '../UsageCacheManager'
import { QueueManager } from '../queue/QueueManager'

export interface ISchedulerWorkerOptions {
    componentNodes: IComponentNodes
    cachePool: CachePool
    usageCacheManager: UsageCacheManager
    queueManager: QueueManager
    pollIntervalMs?: number
}

export interface IScheduleExecutionContext {
    schedule: Schedule
    runId: string
    scheduleRun: ScheduleRun
}

export { Schedule, ScheduleRun }
