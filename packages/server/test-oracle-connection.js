const oracledb = require('oracledb')
const path = require('path')
const fs = require('fs')
const os = require('os')

// Oracle connection details
const ORACLE_CONFIG = {
    host: 'dxchoracledb1.chainsys.com',
    port: 1596,
    database: 'csdev',
    username: 'CSP_DEV_META',
    password: 'BSbHlCJcLIlvRVIG'
}

// Oracle Instant Client path
const ORACLE_CLIENT_PATH = path.join(os.homedir(), 'lib', 'instantclient_19_16')

console.log('🔍 Oracle Connection Test Script')
console.log('================================\n')

// Step 1: Check if Oracle client path exists
console.log('Step 1: Checking Oracle Instant Client installation...')
if (fs.existsSync(ORACLE_CLIENT_PATH)) {
    console.log(`✅ Oracle client found at: ${ORACLE_CLIENT_PATH}`)
    
    // List files in the directory to verify it's correct
    const files = fs.readdirSync(ORACLE_CLIENT_PATH)
    const hasLibFiles = files.some(f => f.endsWith('.dylib') || f.endsWith('.so') || f.endsWith('.dll'))
    if (hasLibFiles) {
        console.log(`✅ Client library files detected (${files.filter(f => f.endsWith('.dylib') || f.endsWith('.so') || f.endsWith('.dll')).length} files)`)
    } else {
        console.log(`⚠️  Warning: No library files (.dylib/.so/.dll) found in client directory`)
    }
} else {
    console.log(`❌ Oracle client NOT found at: ${ORACLE_CLIENT_PATH}`)
    console.log(`   Please ensure the instantclient_19_16 folder is in ~/lib/`)
    process.exit(1)
}

// Step 2: Initialize Oracle client
console.log('\nStep 2: Initializing Oracle client...')
try {
    oracledb.initOracleClient({ libDir: ORACLE_CLIENT_PATH })
    console.log('✅ Oracle client initialized successfully')
} catch (error) {
    if (error.message && error.message.includes('already been initialized')) {
        console.log('✅ Oracle client already initialized')
    } else {
        console.log(`❌ Failed to initialize Oracle client: ${error.message}`)
        console.log(`   Error details:`, error)
        process.exit(1)
    }
}

// Step 3: Test connection
console.log('\nStep 3: Testing Oracle database connection...')
console.log(`   Host: ${ORACLE_CONFIG.host}`)
console.log(`   Port: ${ORACLE_CONFIG.port}`)
console.log(`   Database: ${ORACLE_CONFIG.database}`)
console.log(`   Username: ${ORACLE_CONFIG.username}`)

// Build connection string
const connectString = `${ORACLE_CONFIG.host}:${ORACLE_CONFIG.port}/${ORACLE_CONFIG.database}`

async function testConnection() {
    let connection
    
    try {
        console.log(`\n   Attempting to connect to: ${connectString}...`)
        
        connection = await oracledb.getConnection({
            user: ORACLE_CONFIG.username,
            password: ORACLE_CONFIG.password,
            connectString: connectString
        })
        
        console.log('✅ Connection established successfully!')
        
        // Step 4: Test a simple query
        console.log('\nStep 4: Testing database query...')
        const result = await connection.execute('SELECT 1 as test_value, SYSDATE as current_date FROM DUAL')
        console.log('✅ Query executed successfully!')
        console.log(`   Test result: ${JSON.stringify(result.rows[0])}`)
        
        // Step 5: Get database version
        console.log('\nStep 5: Getting database version...')
        const versionResult = await connection.execute(
            "SELECT BANNER FROM v$version WHERE BANNER LIKE 'Oracle%'"
        )
        if (versionResult.rows && versionResult.rows.length > 0) {
            console.log(`✅ Database version: ${versionResult.rows[0][0]}`)
        }
        
        // Step 6: Check if we can query system tables
        console.log('\nStep 6: Checking access to system tables...')
        const tableResult = await connection.execute(
            "SELECT COUNT(*) as table_count FROM user_tables"
        )
        console.log(`✅ Can access system tables. User has access to ${tableResult.rows[0][0]} tables`)
        
        console.log('\n✅✅✅ ALL TESTS PASSED! Oracle connection is working correctly. ✅✅✅\n')
        
    } catch (error) {
        console.log(`\n❌ Connection failed!`)
        console.log(`   Error: ${error.message}`)
        
        // Troubleshooting tips
        console.log('\n🔧 Troubleshooting Tips:')
        
        if (error.message.includes('ORA-12154')) {
            console.log('   - ORA-12154: TNS:could not resolve the connect identifier')
            console.log('   - Check if the host, port, and database name are correct')
            console.log('   - Verify network connectivity to the database server')
        } else if (error.message.includes('ORA-12541')) {
            console.log('   - ORA-12541: TNS:no listener')
            console.log('   - The database server may not be running or the port is incorrect')
        } else if (error.message.includes('ORA-01017')) {
            console.log('   - ORA-01017: invalid username/password')
            console.log('   - Check if the username and password are correct')
        } else if (error.message.includes('ORA-12514')) {
            console.log('   - ORA-12514: TNS:listener does not currently know of service')
            console.log('   - The database service name may be incorrect')
        } else if (error.message.includes('NJS-') || error.message.includes('DPI-')) {
            console.log('   - This is an Oracle client library error')
            console.log('   - Verify the Oracle Instant Client is correctly installed')
            console.log('   - Check if all required library files are present')
        } else {
            console.log('   - Check network connectivity')
            console.log('   - Verify database server is running')
            console.log('   - Confirm credentials are correct')
            console.log('   - Check firewall settings')
        }
        
        console.log(`\n   Full error details:`)
        console.log(`   ${error.stack || error}`)
        
        process.exit(1)
    } finally {
        if (connection) {
            try {
                await connection.close()
                console.log('\n✅ Connection closed successfully')
            } catch (closeError) {
                console.log(`⚠️  Warning: Error closing connection: ${closeError.message}`)
            }
        }
    }
}

// Run the test
testConnection().catch(error => {
    console.error('\n❌ Unexpected error:', error)
    process.exit(1)
})

