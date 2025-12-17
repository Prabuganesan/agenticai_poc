import { AUTONOMOUS_METRIC_COUNTERS, IMetricsProvider, LLMUsageMetrics } from '../Interface.Metrics'
import express from 'express'
import promClient, { Counter, Histogram, Registry } from 'prom-client'
import { getVersion } from 'autonomous-components'
import http from 'http'

export class Prometheus implements IMetricsProvider {
    private app: express.Application
    private readonly register: Registry
    private counters: Map<string, promClient.Counter<string> | promClient.Gauge<string> | promClient.Histogram<string>>
    private requestCounter: Counter<string>
    private httpRequestDurationMicroseconds: Histogram<string>
    private llmRequestCounter: Counter<string>
    private llmTokensCounter: Counter<string>
    private llmCostCounter: Counter<string>
    private llmRequestDuration: Histogram<string>
    private llmTokensHistogram: Histogram<string>
    private llmCostHistogram: Histogram<string>

    constructor(app: express.Application) {
        this.app = app
        // Clear any existing default registry metrics to avoid conflicts
        promClient.register.clear()
        // Create a separate registry for our metrics
        this.register = new promClient.Registry()
    }

    public getName(): string {
        return 'Prometheus'
    }

    public getRegister(): Registry {
        return this.register
    }

    async initializeCounters(): Promise<void> {
        const serviceName: string = process.env.METRICS_SERVICE_NAME || 'Autonomous'
        this.register.setDefaultLabels({
            app: serviceName
        })

        // look at the AUTONOMOUS_COUNTER enum in Interface.Metrics.ts and get all values
        // for each counter in the enum, create a new promClient.Counter and add it to the registry
        this.counters = new Map<string, promClient.Counter<string> | promClient.Gauge<string> | promClient.Histogram<string>>()
        const enumEntries = Object.entries(AUTONOMOUS_METRIC_COUNTERS)
        enumEntries.forEach(([name, value]) => {
            // derive proper counter name from the enum value (chatflow_created = Chatflow Created)
            const properCounterName: string = name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
            try {
                this.counters.set(
                    value,
                    new promClient.Counter({
                        name: value,
                        help: `Total number of ${properCounterName}`,
                        labelNames: ['status'],
                        registers: [this.register] // Explicitly set the registry
                    })
                )
            } catch (error) {
                // If metric already exists, get it from the registry instead
                const existingMetrics = this.register.getSingleMetric(value)
                if (existingMetrics) {
                    this.counters.set(value, existingMetrics as promClient.Counter<string>)
                }
            }
        })

        // in addition to the enum counters, add a few more custom counters
        // version, http_request_duration_ms, http_requests_total
        try {
            const versionGaugeCounter = new promClient.Gauge({
                name: 'autonomous_version_info',
                help: 'Autonomous version info.',
                labelNames: ['version'],
                registers: [this.register] // Explicitly set the registry
            })

            const { version } = await getVersion()
            versionGaugeCounter.set({ version: 'v' + version }, 1)
            this.counters.set('autonomous_version', versionGaugeCounter)
        } catch (error) {
            // If metric already exists, get it from the registry
            const existingMetric = this.register.getSingleMetric('autonomous_version')
            if (existingMetric) {
                this.counters.set('autonomous_version', existingMetric as promClient.Gauge<string>)
            }
        }

        try {
            this.httpRequestDurationMicroseconds = new promClient.Histogram({
                name: 'http_request_duration_ms',
                help: 'Duration of HTTP requests in ms',
                labelNames: ['method', 'route', 'code'],
                buckets: [1, 5, 15, 50, 100, 200, 300, 400, 500], // buckets for response time from 0.1ms to 500ms
                registers: [this.register] // Explicitly set the registry
            })
            this.counters.set('http_request_duration_ms', this.httpRequestDurationMicroseconds)
        } catch (error) {
            // If metric already exists, get it from the registry
            const existingMetric = this.register.getSingleMetric('http_request_duration_ms')
            if (existingMetric) {
                this.httpRequestDurationMicroseconds = existingMetric as Histogram<string>
                this.counters.set('http_request_duration_ms', this.httpRequestDurationMicroseconds)
            }
        }

        try {
            this.requestCounter = new Counter({
                name: 'http_requests_total',
                help: 'Total number of HTTP requests',
                labelNames: ['method', 'path', 'status'],
                registers: [this.register] // Explicitly set the registry
            })
            this.counters.set('http_requests_total', this.requestCounter)
        } catch (error) {
            // If metric already exists, get it from the registry
            const existingMetric = this.register.getSingleMetric('http_requests_total')
            if (existingMetric) {
                this.requestCounter = existingMetric as Counter<string>
                this.counters.set('http_requests_total', this.requestCounter)
            }
        }

        // Initialize LLM metrics
        try {
            this.llmRequestCounter = new Counter({
                name: 'llm_requests_total',
                help: 'Total number of LLM API requests',
                labelNames: ['provider', 'model', 'feature', 'status', 'org_id', 'node_type'],
                registers: [this.register]
            })
            this.counters.set('llm_requests_total', this.llmRequestCounter)
        } catch (error) {
            const existingMetric = this.register.getSingleMetric('llm_requests_total')
            if (existingMetric) {
                this.llmRequestCounter = existingMetric as Counter<string>
                this.counters.set('llm_requests_total', this.llmRequestCounter)
            }
        }

        try {
            this.llmTokensCounter = new Counter({
                name: 'llm_tokens_total',
                help: 'Total tokens consumed',
                labelNames: ['provider', 'model', 'token_type', 'feature', 'org_id'],
                registers: [this.register]
            })
            this.counters.set('llm_tokens_total', this.llmTokensCounter)
        } catch (error) {
            const existingMetric = this.register.getSingleMetric('llm_tokens_total')
            if (existingMetric) {
                this.llmTokensCounter = existingMetric as Counter<string>
                this.counters.set('llm_tokens_total', this.llmTokensCounter)
            }
        }

        try {
            this.llmCostCounter = new Counter({
                name: 'llm_cost_total_usd',
                help: 'Total cost in USD',
                labelNames: ['provider', 'model', 'feature', 'org_id'],
                registers: [this.register]
            })
            this.counters.set('llm_cost_total_usd', this.llmCostCounter)
        } catch (error) {
            const existingMetric = this.register.getSingleMetric('llm_cost_total_usd')
            if (existingMetric) {
                this.llmCostCounter = existingMetric as Counter<string>
                this.counters.set('llm_cost_total_usd', this.llmCostCounter)
            }
        }

        try {
            this.llmRequestDuration = new Histogram({
                name: 'llm_request_duration_seconds',
                help: 'Duration of LLM requests in seconds',
                labelNames: ['provider', 'model', 'feature', 'org_id', 'node_type'],
                buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
                registers: [this.register]
            })
            this.counters.set('llm_request_duration_seconds', this.llmRequestDuration)
        } catch (error) {
            const existingMetric = this.register.getSingleMetric('llm_request_duration_seconds')
            if (existingMetric) {
                this.llmRequestDuration = existingMetric as Histogram<string>
                this.counters.set('llm_request_duration_seconds', this.llmRequestDuration)
            }
        }

        try {
            this.llmTokensHistogram = new Histogram({
                name: 'llm_tokens_per_request',
                help: 'Token distribution per request',
                labelNames: ['provider', 'model', 'token_type', 'feature', 'org_id'],
                buckets: [100, 500, 1000, 2000, 5000, 10000, 20000, 50000],
                registers: [this.register]
            })
            this.counters.set('llm_tokens_per_request', this.llmTokensHistogram)
        } catch (error) {
            const existingMetric = this.register.getSingleMetric('llm_tokens_per_request')
            if (existingMetric) {
                this.llmTokensHistogram = existingMetric as Histogram<string>
                this.counters.set('llm_tokens_per_request', this.llmTokensHistogram)
            }
        }

        try {
            this.llmCostHistogram = new Histogram({
                name: 'llm_cost_per_request_usd',
                help: 'Cost distribution per request',
                labelNames: ['provider', 'model', 'feature', 'org_id'],
                buckets: [0.0001, 0.001, 0.01, 0.1, 1, 10, 100],
                registers: [this.register]
            })
            this.counters.set('llm_cost_per_request_usd', this.llmCostHistogram)
        } catch (error) {
            const existingMetric = this.register.getSingleMetric('llm_cost_per_request_usd')
            if (existingMetric) {
                this.llmCostHistogram = existingMetric as Histogram<string>
                this.counters.set('llm_cost_per_request_usd', this.llmCostHistogram)
            }
        }

        // Only register metrics that aren't already in the registry
        this.registerMetrics()
    }

    async setupMetricsEndpoint() {
        // Get context path from environment
        const apiContextPath = process.env.CONTEXT_PATH || '/autonomous'

        // Helper function to aggregate metrics from worker if in queue mode
        const getAggregatedMetrics = async (): Promise<string> => {
            const serverMetrics = await this.register.metrics()

            // In queue mode, also fetch worker metrics and merge them
            // Check MODE environment variable (case-insensitive)
            const mode = process.env.MODE?.toLowerCase()
            const isQueueMode = mode === 'queue'

            if (isQueueMode && process.env.ENABLE_METRICS === 'true') {
                try {
                    const workerMetricsPort = process.env.WORKER_METRICS_PORT || '3031'
                    // Use the same context path as the server for consistency
                    const workerMetricsPath =
                        apiContextPath && apiContextPath !== '/' ? `${apiContextPath}/api/v1/metrics` : '/api/v1/metrics'
                    const workerMetricsUrl = `http://localhost:${workerMetricsPort}${workerMetricsPath}`

                    const workerMetrics = await this.fetchWorkerMetrics(workerMetricsUrl)
                    if (workerMetrics) {
                        // Combine server and worker metrics
                        return serverMetrics + '\n' + workerMetrics
                    } else {
                        console.warn(`[Prometheus] Worker metrics fetch returned null/empty (worker may not be running or accessible)`)
                    }
                    // Silently fail - if worker is not running, just return server metrics
                } catch (error: any) {
                    console.error(`[Prometheus] Error fetching worker metrics:`, error.message || error)
                    // Silently fail - if worker is not running, just return server metrics
                }
            }

            return serverMetrics
        }

        // Add Prometheus middleware to the app at root path
        this.app.use('/api/v1/metrics', async (req, res) => {
            res.set('Content-Type', this.register.contentType)
            const aggregatedMetrics = await getAggregatedMetrics()
            res.send(aggregatedMetrics).end()
        })

        // Also mount metrics endpoint at context path for requests coming from /autonomous/api/v1/metrics
        if (apiContextPath && apiContextPath !== '/') {
            this.app.use(`${apiContextPath}/api/v1/metrics`, async (req, res) => {
                res.set('Content-Type', this.register.contentType)
                const aggregatedMetrics = await getAggregatedMetrics()
                res.send(aggregatedMetrics).end()
            })
        }

        // Runs before each requests
        this.app.use((req, res, next) => {
            res.locals.startEpoch = Date.now()
            next()
        })

        // Setup request tracking
        this.setupRequestTracking()
    }

    private async fetchWorkerMetrics(url: string): Promise<string | null> {
        return new Promise((resolve) => {
            const request = http.get(url, { timeout: 5000 }, (response) => {
                if (response.statusCode !== 200) {
                    console.error(`[Prometheus] Worker metrics returned status ${response.statusCode} from ${url}`)
                    resolve(null)
                    return
                }

                let data = ''
                response.on('data', (chunk) => {
                    data += chunk
                })
                response.on('end', () => {
                    if (data.length === 0) {
                        console.warn(`[Prometheus] Worker metrics response is empty from ${url}`)
                        resolve(null)
                    } else {
                        resolve(data)
                    }
                })
            })

            request.on('error', (error: any) => {
                console.error(`[Prometheus] Error fetching worker metrics from ${url}:`, error.message || error.code || error)
                resolve(null)
            })

            request.on('timeout', () => {
                console.warn(`[Prometheus] Timeout fetching worker metrics from ${url} (5s timeout)`)
                request.destroy()
                resolve(null)
            })
        })
    }

    // Runs after each requests
    private setupRequestTracking() {
        this.app.use((req, res, next) => {
            res.on('finish', async () => {
                if (res.locals.startEpoch) {
                    // Increment request counter with proper labels: method, path, status
                    this.requestCounter.labels(req.method, req.path || req.baseUrl, res.statusCode.toString()).inc()
                    const responseTimeInMs = Date.now() - res.locals.startEpoch
                    // Record request duration with labels: method, route, code
                    this.httpRequestDurationMicroseconds
                        .labels(req.method, req.baseUrl || req.path, res.statusCode.toString())
                        .observe(responseTimeInMs)
                }
            })
            next()
        })
    }

    public incrementCounter(counter: AUTONOMOUS_METRIC_COUNTERS, payload: any) {
        // increment the counter with the payload
        if (this.counters.has(counter)) {
            ;(this.counters.get(counter) as Counter<string>).labels(payload).inc()
        }
    }

    public trackLLMUsage(usage: LLMUsageMetrics): void {
        try {
            const status = usage.success ? 'success' : 'failure'
            const orgIdStr = String(usage.orgId || 'unknown')

            // Increment request counter
            this.llmRequestCounter.labels(usage.provider, usage.model, usage.feature, status, orgIdStr, usage.nodeType).inc()

            // Record duration (convert ms to seconds)
            const durationSeconds = (usage.processingTimeMs || 0) / 1000
            this.llmRequestDuration.labels(usage.provider, usage.model, usage.feature, orgIdStr, usage.nodeType).observe(durationSeconds)

            // Track tokens (counters)
            this.llmTokensCounter.labels(usage.provider, usage.model, 'prompt', usage.feature, orgIdStr).inc(usage.promptTokens || 0)

            this.llmTokensCounter
                .labels(usage.provider, usage.model, 'completion', usage.feature, orgIdStr)
                .inc(usage.completionTokens || 0)

            this.llmTokensCounter.labels(usage.provider, usage.model, 'total', usage.feature, orgIdStr).inc(usage.totalTokens || 0)

            // Track tokens per request (histogram)
            this.llmTokensHistogram.labels(usage.provider, usage.model, 'prompt', usage.feature, orgIdStr).observe(usage.promptTokens || 0)

            this.llmTokensHistogram
                .labels(usage.provider, usage.model, 'completion', usage.feature, orgIdStr)
                .observe(usage.completionTokens || 0)

            this.llmTokensHistogram.labels(usage.provider, usage.model, 'total', usage.feature, orgIdStr).observe(usage.totalTokens || 0)

            // Track cost
            this.llmCostCounter.labels(usage.provider, usage.model, usage.feature, orgIdStr).inc(usage.cost || 0)

            this.llmCostHistogram.labels(usage.provider, usage.model, usage.feature, orgIdStr).observe(usage.cost || 0)
        } catch (error) {
            // Silently fail - Prometheus tracking should not break the flow
        }
    }

    private registerMetrics() {
        if (process.env.METRICS_INCLUDE_NODE_METRICS !== 'false') {
            // Clear any existing default metrics to avoid conflicts
            promClient.register.clear()
            // enable default metrics like CPU usage, memory usage, etc.
            // and ensure they're only registered with our custom registry
            promClient.collectDefaultMetrics({
                register: this.register,
                prefix: 'autonomous_' // Add a prefix to avoid conflicts
            })
        }

        // Add only the custom metrics that haven't been registered yet
        for (const counter of this.counters.values()) {
            try {
                // Type assertion to access the name property
                const metricName = (counter as any).name
                if (!this.register.getSingleMetric(metricName)) {
                    this.register.registerMetric(counter)
                }
            } catch (error) {
                // If we can't register the metric, it probably already exists
                // Just continue with the next one
            }
        }
    }
}
