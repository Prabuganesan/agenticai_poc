const path = require('path');
const dotenv = require('dotenv');
// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, './packages/server/.env') });

let config = {
    mode: 'pm2',
    clusterMode: false,
    instances: 1,
    port: 3030
};

try {
    config = {
        mode: process.env.SERVER_MODE || 'pm2',
        clusterMode: process.env.SERVER_CLUSTER_MODE || false,
        instances: process.env?.SERVER_INSTANCES || 1,
        port: process.env?.PORT || 3030,
        queueMode: process.env?.MODE || false,
        queueCount: process.env?.REDIS_DB_QUEUE || 1
    };
} catch (error) {
    console.warn('Could not read config.json, using defaults:', error.message);
}

// Determine exec mode and instances
const execMode = config.clusterMode && config.instances > 1 ? 'cluster' : 'fork';
const instances = config.clusterMode && config.instances > 1 ? config.instances : 1;

// Determine environment - default to production if not set
const nodeEnv = process.env.NODE_ENV || 'production';

// Security: Override IFRAME_ORIGINS if it's set to '*' in production
// This prevents the security warning and clickjacking risk
let iframeOrigins = process.env.IFRAME_ORIGINS || 'self'
if (nodeEnv === 'production' && iframeOrigins === '*') {
    console.warn('⚠️  Overriding IFRAME_ORIGINS from "*" to "self" for production security')
    iframeOrigins = 'self'
}

// Log configuration for debugging
console.log('PM2 Configuration:');
console.log(`  Mode: ${config.mode}`);
console.log(`  IFRAME_ORIGINS: ${iframeOrigins}`);
module.exports = {
    apps: [
        {
            name: 'agentic-server',
            script: 'packages/server/bin/run',
            args: 'start',
            cwd: './',
            instances: instances,
            exec_mode: execMode,
            interpreter: 'node',
            watch: false,
            max_memory_restart: '4G',
            // Environment variables for production
            // To disable TLS certificate verification (INSECURE - development only), add:
            // NODE_TLS_REJECT_UNAUTHORIZED: '0'
            // OR set ALLOW_INSECURE_TLS: 'true'
            env: {
                NODE_ENV: nodeEnv,
                // Security: Configure IFRAME_ORIGINS to prevent clickjacking
                // Options:
                // - 'self' (same-origin only - most secure)
                // - Comma-separated list: 'https://example.com,https://app.example.com'
                // - '*' (allows all - INSECURE, only for development)
                // In production, '*' is automatically overridden to 'self' for security
                IFRAME_ORIGINS: iframeOrigins
            },
            // Environment variables for development
            env_development: {
                NODE_ENV: 'development',
                // In development, you can use '*' for easier testing, but 'self' is still recommended
                IFRAME_ORIGINS: process.env.IFRAME_ORIGINS || 'self'
                // Uncomment the following lines if you need to disable TLS verification in development:
                // NODE_TLS_REJECT_UNAUTHORIZED: '0'
                // ALLOW_INSECURE_TLS: 'true'
            },
            error_file: './logs/pm2-server-error.log',
            out_file: './logs/pm2-server-out.log',
            log_file: './logs/pm2-server.log',
            time: true,
            merge_logs: true,
            autorestart: true,  // Set to true to automatically restart on crash
            max_restarts: 10,
            min_uptime: '10s',
            restart_delay: 4000
        },
        // Worker process - only needed when MODE=QUEUE
        // The worker processes jobs from Redis queues
        // Start separately with: pnpm start-worker
        // Or use PM2: pm2 start ecosystem.config.js --only agentic-worker
        {
            name: 'agentic-worker',
            script: 'packages/server/bin/run',
            args: 'worker',
            cwd: './',
            instances: 1,  // Workers should typically run as single instances
            exec_mode: 'fork',
            interpreter: 'node',
            watch: false,
            max_memory_restart: '4G',
            env: {
                NODE_ENV: nodeEnv,
                MODE: 'queue'  // Worker requires queue mode
            },
            env_development: {
                NODE_ENV: 'development',
                MODE: 'queue'
            },
            error_file: './logs/pm2-worker-error.log',
            out_file: './logs/pm2-worker-out.log',
            log_file: './logs/pm2-worker.log',
            time: true,
            merge_logs: true,
            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s',
            restart_delay: 4000
        }
    ]
}

