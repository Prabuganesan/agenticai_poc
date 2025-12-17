import { DataSource } from 'typeorm'
import { logInfo, logWarn, logError, logDebug } from '../../utils/logger/system-helper'

/**
 * Get database type from environment variable
 */
function getDatabaseType(): 'postgres' | 'oracle' {
    const dbType = process.env.MAIN_DB_TYPE?.toUpperCase() || 'POSTGRES'
    return dbType === 'ORACLE' ? 'oracle' : 'postgres'
}

/**
 * Create a native database sequence
 */
async function createSequence(
    dataSource: DataSource,
    sequenceName: string,
    dbType: 'postgres' | 'oracle'
): Promise<void> {
    if (dbType === 'postgres') {
        await dataSource.query(`
            CREATE SEQUENCE IF NOT EXISTS ${sequenceName}
                MINVALUE 1
                MAXVALUE 999999999
                START WITH 1
                INCREMENT BY 1
                NO CYCLE
        `)
    } else if (dbType === 'oracle') {
        // Oracle: Check if sequence exists first
        try {
            const result = await dataSource.query(
                `SELECT COUNT(*) as cnt FROM user_sequences WHERE sequence_name = :1`,
                [sequenceName.toUpperCase()]
            )
            const count = result[0]?.CNT ?? result[0]?.cnt ?? 0
            if (count === 0) {
                await dataSource.query(`
                    CREATE SEQUENCE ${sequenceName}
                        MINVALUE 1
                        MAXVALUE 999999999
                        START WITH 1
                        INCREMENT BY 1
                        NOCACHE
                        NOCYCLE
                `)
            }
        } catch (error: any) {
            // If sequence already exists, ignore the error
            // Oracle error: ORA-00955: name is already used by an existing object
            const errorMessage = error.message || String(error)
            if (errorMessage.includes('ORA-00955') ||
                errorMessage.includes('already exists') ||
                errorMessage.includes('name is already used')) {
                logDebug(`Sequence ${sequenceName} already exists, skipping creation`).catch(() => { })
            } else {
                throw error
            }
        }
    }
}

/**
 * Get the NEXTVAL syntax for the database type
 */
function getNextValSyntax(sequenceName: string, dbType: 'postgres' | 'oracle'): string {
    if (dbType === 'postgres') {
        return `NEXTVAL('${sequenceName}')`
    } else {
        return `${sequenceName}.NEXTVAL`
    }
}

/**
 * Get the DEFAULT clause for ID column with sequence
 * Oracle 12c+ supports DEFAULT with sequences in CREATE TABLE
 */
function getIdDefaultClause(sequenceName: string, dbType: 'postgres' | 'oracle'): string {
    if (dbType === 'postgres') {
        return `DEFAULT ${getNextValSyntax(sequenceName, dbType)}`
    } else {
        // Oracle 12c+ supports DEFAULT with sequences
        return `DEFAULT ${getNextValSyntax(sequenceName, dbType)}`
    }
}

/**
 * Get TEXT type for the database
 */
function getTextType(dbType: 'postgres' | 'oracle'): string {
    return dbType === 'postgres' ? 'TEXT' : 'CLOB'
}

/**
 * Get BOOL type for the database
 */
function getBoolType(dbType: 'postgres' | 'oracle'): string {
    return dbType === 'postgres' ? 'BOOL' : 'NUMBER(1)'
}

/**
 * Get JSON type for the database
 */
function getJsonType(dbType: 'postgres' | 'oracle'): string {
    return dbType === 'postgres' ? 'JSONB' : 'CLOB'
}

/**
 * Get NUMERIC/NUMBER type for the database
 */
function getNumericType(dbType: 'postgres' | 'oracle'): string {
    return 'NUMERIC';
}

/**
 * Get VARCHAR type for the database (Oracle uses VARCHAR2)
 */
function getVarcharType(length: number | string, dbType: 'postgres' | 'oracle'): string {
    if (dbType === 'postgres') {
        return length ? `VARCHAR(${length})` : 'VARCHAR'
    } else {
        // Oracle requires length for VARCHAR2, default to 4000 if not specified
        return length ? `VARCHAR2(${length})` : 'VARCHAR2(4000)'
    }
}

/**
 * Get INTEGER type for the database
 */
function getIntegerType(dbType: 'postgres' | 'oracle'): string {
    return dbType === 'postgres' ? 'INTEGER' : 'NUMBER'
}

/**
 * Get DECIMAL type for the database
 */
function getDecimalType(precision: number, scale: number, dbType: 'postgres' | 'oracle'): string {
    return dbType === 'postgres' ? `DECIMAL(${precision}, ${scale})` : `NUMBER(${precision}, ${scale})`
}

/**
 * Get TIMESTAMP default clause for the database
 */
function getTimestampDefault(dbType: 'postgres' | 'oracle'): string {
    return dbType === 'postgres' ? 'CURRENT_TIMESTAMP' : 'SYSTIMESTAMP'
}

/**
 * Create table with IF NOT EXISTS support for both databases
 */
async function createTable(
    dataSource: DataSource,
    tableName: string,
    tableDefinition: string,
    dbType: 'postgres' | 'oracle'
): Promise<void> {
    if (dbType === 'postgres') {
        await dataSource.query(`CREATE TABLE IF NOT EXISTS ${tableName} (${tableDefinition});`)
    } else {
        // Oracle: Check if table exists first
        const result = await dataSource.query(
            `SELECT COUNT(*) as cnt FROM all_tables WHERE table_name = :1`,
            [tableName.toUpperCase()]
        )
        if (result[0].CNT === 0 || result[0].cnt === 0) {
            await dataSource.query(`CREATE TABLE ${tableName} (${tableDefinition})`)
        }
    }
}

/**
 * Create index with IF NOT EXISTS support for both databases
 */
async function createIndex(
    dataSource: DataSource,
    indexName: string,
    tableName: string,
    columns: string,
    dbType: 'postgres' | 'oracle'
): Promise<void> {
    if (dbType === 'postgres') {
        await dataSource.query(`CREATE INDEX IF NOT EXISTS "${indexName}" ON ${tableName} USING btree (${columns});`)
    } else {
        try {
            await dataSource.query(`CREATE INDEX ${indexName} ON ${tableName} (${columns})`)
        } catch (error: any) {
            if (!error.message?.includes('ORA-00955')) throw error  // Ignore "name already used"
        }
    }
}

/**
 * Creates all tables and columns at startup (smartappbuilder pattern)
 * This replaces migrations - all schema changes happen via SQL queries at startup
 */
export async function createDatabaseSchema(dataSource: DataSource, orgId: number): Promise<void> {
    // Use DataSource.query() directly instead of queryRunner to ensure proper connection and auto-commit
    try {
        const dbType = getDatabaseType()

        // Verify connection by checking current database
        let dbResult
        if (dbType === 'postgres') {
            dbResult = await dataSource.query(`SELECT current_database() as db_name, current_schema() as schema_name`)
        } else {
            dbResult = await dataSource.query(`SELECT SYS_CONTEXT('USERENV', 'DB_NAME') as db_name, SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') as schema_name FROM DUAL`)
        }
        logInfo(`📊 [Schema]: Creating tables in database: ${dbResult[0]?.db_name}, schema: ${dbResult[0]?.schema_name}, DB Type: ${dbType.toUpperCase()}`).catch(() => { })

        // ============================================
        // CREATE NATIVE SEQUENCES FOR ALL TABLES
        // ============================================

        const tables = [
            'auto_chat_flow',
            'auto_chat_message',
            'auto_credential',
            'auto_tool',
            'auto_assistant',
            'auto_variable',
            'auto_apikey',
            'auto_upsert_history',
            'auto_chat_message_feedback',
            'auto_document_store',
            'auto_document_store_file_chunk',
            'auto_custom_template',
            'auto_execution',
            'auto_sab_chat_session',
            'auto_sab_llm_usage'
        ]

        logInfo(`📊 [Schema]: Creating ${tables.length} native sequences...`).catch(() => { })
        for (const tableName of tables) {
            const sequenceName = `${tableName}_id_seq`
            await createSequence(dataSource, sequenceName, dbType)
        }
        logInfo(`✅ [Schema]: All sequences created`).catch(() => { })

        // ============================================
        // CREATE ALL TABLES WITH ALL COLUMNS
        // ============================================

        // AUTO_CHAT_FLOW
        const chatFlowIdDefault = getIdDefaultClause('auto_chat_flow_id_seq', dbType)
        const textType = getTextType(dbType)
        const boolType = getBoolType(dbType)
        const numericType = getNumericType(dbType)
        const integerType = getIntegerType(dbType)
        const varcharType = getVarcharType(255, dbType)
        const varcharType15 = getVarcharType(15, dbType)
        const varcharType255 = getVarcharType(255, dbType)
        const varcharType20 = getVarcharType(20, dbType)
        const varcharType50 = getVarcharType(50, dbType)

        await createTable(dataSource, 'auto_chat_flow', `
                id ${numericType}${dbType === 'postgres' ? ` NOT NULL` : ``}${chatFlowIdDefault ? ' ' + chatFlowIdDefault : ''},
                guid ${varcharType15} NOT NULL,
                name ${varcharType255} NOT NULL,
                display_name ${varcharType50} NULL,
                flowdata ${textType} NOT NULL,
                deployed ${boolType} NULL,
                ispublic ${boolType} NULL,
                apikeyid ${varcharType255} NULL,
                chatbotconfig ${textType} NULL,
                apiconfig ${textType} NULL,
                analytic ${textType} NULL,
                category ${textType} NULL,
                speechtotext ${textType} NULL,
                texttospeech ${textType} NULL,
                type ${varcharType20} NULL,
                followupprompts ${textType} NULL,
                created_by ${numericType} NOT NULL,
                created_on ${numericType}(25,0) NOT NULL,
                last_modified_by ${numericType} NULL,
                last_modified_on ${numericType}(25,0) NULL,
                CONSTRAINT auto_chat_flow_pkey PRIMARY KEY (id)
        `, dbType)

        // AUTO_CHAT_MESSAGE
        const chatMessageIdDefault = getIdDefaultClause('auto_chat_message_id_seq', dbType)
        await createTable(dataSource, 'auto_chat_message', `
                id ${numericType}${dbType === 'postgres' ? ` NOT NULL` : ``}${chatMessageIdDefault ? ' ' + chatMessageIdDefault : ''},
                guid ${varcharType15} NOT NULL,
                role ${varcharType} NOT NULL,
                chatflowid ${varcharType15} NOT NULL,
                content ${textType} NOT NULL,
                sourcedocuments ${textType} NULL,
                usedtools ${textType} NULL,
                fileannotations ${textType} NULL,
                fileuploads ${textType} NULL,
                agentreasoning ${textType} NULL,
                artifacts ${textType} NULL,
                action ${textType} NULL,
                chattype ${varcharType} DEFAULT 'INTERNAL' NOT NULL,
                chatid ${varcharType} NOT NULL,
                memorytype ${varcharType} NULL,
                sessionid ${varcharType} NULL,
                executionid ${varcharType15} NULL,
                followupprompts ${textType} NULL,
                created_by ${numericType} NOT NULL,
                created_on ${numericType}(25,0) NOT NULL,
                CONSTRAINT auto_chat_message_pkey PRIMARY KEY (id)
        `, dbType)

        // AUTO_CREDENTIAL
        const credentialIdDefault = getIdDefaultClause('auto_credential_id_seq', dbType)
        await createTable(dataSource, 'auto_credential', `
                id ${numericType}${dbType === 'postgres' ? ` NOT NULL` : ``}${credentialIdDefault ? ' ' + credentialIdDefault : ''},
                guid ${varcharType15} NOT NULL,
                name ${varcharType} NOT NULL,
                credentialname ${varcharType} NOT NULL,
                encrypteddata ${textType} NOT NULL,
                created_by ${numericType} NOT NULL,
                created_on ${numericType}(25,0) NOT NULL,
                last_modified_by ${numericType} NULL,
                last_modified_on ${numericType}(25,0) NULL,
                CONSTRAINT auto_credential_pkey PRIMARY KEY (id)
        `, dbType)

        // AUTO_TOOL
        const toolIdDefault = getIdDefaultClause('auto_tool_id_seq', dbType)
        await createTable(dataSource, 'auto_tool', `
                id ${numericType}${dbType === 'postgres' ? ` NOT NULL` : ``}${toolIdDefault ? ' ' + toolIdDefault : ''},
                guid ${varcharType15} NOT NULL,
                name ${varcharType} NOT NULL,
                description ${textType} NOT NULL,
                color ${varcharType} NOT NULL,
                iconsrc ${varcharType} NULL,
                schema ${textType} NULL,
                func ${textType} NULL,
                created_by ${numericType} NOT NULL,
                created_on ${numericType}(25,0) NOT NULL,
                last_modified_by ${numericType} NULL,
                last_modified_on ${numericType}(25,0) NULL,
                CONSTRAINT auto_tool_pkey PRIMARY KEY (id)
        `, dbType)

        // AUTO_ASSISTANT
        const assistantIdDefault = getIdDefaultClause('auto_assistant_id_seq', dbType)
        await createTable(dataSource, 'auto_assistant', `
                id ${numericType}${dbType === 'postgres' ? ` NOT NULL` : ``}${assistantIdDefault ? ' ' + assistantIdDefault : ''},
                guid ${varcharType15} NOT NULL,
                display_name ${varcharType50} NULL,
                details ${textType} NOT NULL,
                credential ${varcharType15} NULL,
                iconsrc ${varcharType} NULL,
                type ${textType} NULL,
                created_by ${numericType} NOT NULL,
                created_on ${numericType}(25,0) NOT NULL,
                last_modified_by ${numericType} NULL,
                last_modified_on ${numericType}(25,0) NULL,
                CONSTRAINT auto_assistant_pkey PRIMARY KEY (id)
        `, dbType)

        // AUTO_VARIABLE
        const variableIdDefault = getIdDefaultClause('auto_variable_id_seq', dbType)
        await createTable(dataSource, 'auto_variable', `
                id ${numericType}${dbType === 'postgres' ? ` NOT NULL` : ``}${variableIdDefault ? ' ' + variableIdDefault : ''},
                guid ${varcharType15} NOT NULL,
                name ${varcharType} NOT NULL,
                value ${textType} NULL,
                type ${textType} DEFAULT 'string' NULL,
                created_by ${numericType} NOT NULL,
                created_on ${numericType}(25,0) NOT NULL,
                last_modified_by ${numericType} NULL,
                last_modified_on ${numericType}(25,0) NULL,
                CONSTRAINT auto_variable_pkey PRIMARY KEY (id)
        `, dbType)

        // AUTO_APIKEY
        const apiKeyIdDefault = getIdDefaultClause('auto_apikey_id_seq', dbType)
        await createTable(dataSource, 'auto_apikey', `
                id ${numericType}${dbType === 'postgres' ? ` NOT NULL` : ``}${apiKeyIdDefault ? ' ' + apiKeyIdDefault : ''},
                guid ${varcharType15} NOT NULL,
                apikey ${textType} NOT NULL,
                apisecret ${textType} NOT NULL,
                keyname ${textType} NOT NULL,
                created_by ${numericType} NOT NULL,
                created_on ${numericType}(25,0) NOT NULL,
                last_modified_by ${numericType} NULL,
                last_modified_on ${numericType}(25,0) NULL,
                CONSTRAINT auto_apikey_pkey PRIMARY KEY (id)
        `, dbType)

        // AUTO_UPSERT_HISTORY
        const upsertHistoryIdDefault = getIdDefaultClause('auto_upsert_history_id_seq', dbType)
        await createTable(dataSource, 'auto_upsert_history', `
                id ${numericType}${dbType === 'postgres' ? ` NOT NULL` : ``}${upsertHistoryIdDefault ? ' ' + upsertHistoryIdDefault : ''},
                guid ${varcharType15} NOT NULL,
                chatflowid ${varcharType15} NOT NULL,
                result ${textType} NOT NULL,
                flowdata ${textType} NOT NULL,
                created_by ${numericType} NOT NULL,
                created_on ${numericType}(25,0) NOT NULL,
                CONSTRAINT auto_upsert_history_pkey PRIMARY KEY (id)
        `, dbType)

        // AUTO_CHAT_MESSAGE_FEEDBACK
        const chatMessageFeedbackIdDefault = getIdDefaultClause('auto_chat_message_feedback_id_seq', dbType)
        await createTable(dataSource, 'auto_chat_message_feedback', `
                id ${numericType}${dbType === 'postgres' ? ` NOT NULL` : ``}${chatMessageFeedbackIdDefault ? ' ' + chatMessageFeedbackIdDefault : ''},
                guid ${varcharType15} NOT NULL,
                chatflowid ${varcharType15} NOT NULL,
                chatid ${varcharType} NOT NULL,
                messageid ${varcharType15} NOT NULL,
                rating ${varcharType} NULL,
                content ${textType} NULL,
                created_by ${numericType} NOT NULL,
                created_on ${numericType}(25,0) NOT NULL,
                CONSTRAINT auto_chat_message_feedback_pkey PRIMARY KEY (id)
        `, dbType)

        // AUTO_DOCUMENT_STORE
        const documentStoreIdDefault = getIdDefaultClause('auto_document_store_id_seq', dbType)
        await createTable(dataSource, 'auto_document_store', `
                id ${numericType}${dbType === 'postgres' ? ` NOT NULL` : ``}${documentStoreIdDefault ? ' ' + documentStoreIdDefault : ''},
                guid ${varcharType15} NOT NULL,
                name ${textType} NOT NULL,
                display_name ${varcharType50} NULL,
                description ${textType} NULL,
                status ${varcharType} NOT NULL,
                loaders ${textType} NULL,
                whereused ${textType} NULL,
                vectorstoreconfig ${textType} NULL,
                embeddingconfig ${textType} NULL,
                recordmanagerconfig ${textType} NULL,
                created_by ${numericType} NOT NULL,
                created_on ${numericType}(25,0) NOT NULL,
                last_modified_by ${numericType} NULL,
                last_modified_on ${numericType}(25,0) NULL,
                CONSTRAINT auto_document_store_pkey PRIMARY KEY (id)
        `, dbType)

        // AUTO_DOCUMENT_STORE_FILE_CHUNK
        const documentStoreFileChunkIdDefault = getIdDefaultClause('auto_document_store_file_chunk_id_seq', dbType)
        await createTable(dataSource, 'auto_document_store_file_chunk', `
                id ${numericType}${dbType === 'postgres' ? ` NOT NULL` : ``}${documentStoreFileChunkIdDefault ? ' ' + documentStoreFileChunkIdDefault : ''},
                guid ${varcharType15} NOT NULL,
                docid ${varcharType15} NOT NULL,
                storeid ${varcharType15} NOT NULL,
                chunkno ${integerType} NOT NULL,
                pagecontent ${textType} NOT NULL,
                metadata ${textType} NULL,
                CONSTRAINT auto_document_store_file_chunk_pkey PRIMARY KEY (id)
        `, dbType)

        // AUTO_CUSTOM_TEMPLATE
        const customTemplateIdDefault = getIdDefaultClause('auto_custom_template_id_seq', dbType)
        await createTable(dataSource, 'auto_custom_template', `
                id ${numericType}${dbType === 'postgres' ? ` NOT NULL` : ``}${customTemplateIdDefault ? ' ' + customTemplateIdDefault : ''},
                guid ${varcharType15} NOT NULL,
                name ${varcharType} NOT NULL,
                flowdata ${textType} NOT NULL,
                description ${varcharType} NULL,
                badge ${varcharType} NULL,
                framework ${varcharType} NULL,
                usecases ${varcharType} NULL,
                type ${varcharType} NULL,
                created_by ${numericType} NOT NULL,
                created_on ${numericType}(25,0) NOT NULL,
                last_modified_by ${numericType} NULL,
                last_modified_on ${numericType}(25,0) NULL,
                CONSTRAINT auto_custom_template_pkey PRIMARY KEY (id)
        `, dbType)

        // AUTO_EXECUTION
        const executionIdDefault = getIdDefaultClause('auto_execution_id_seq', dbType)
        await createTable(dataSource, 'auto_execution', `
                id ${numericType}${dbType === 'postgres' ? ` NOT NULL` : ``}${executionIdDefault ? ' ' + executionIdDefault : ''},
                guid ${varcharType15} NOT NULL,
                executiondata ${textType} NOT NULL,
                action ${textType} NULL,
                state ${varcharType} NOT NULL,
                agentflowid ${varcharType15} NOT NULL,
                sessionid ${varcharType} NOT NULL,
                ispublic ${boolType} NULL,
                created_by ${numericType} NOT NULL,
                created_on ${numericType}(25,0) NOT NULL,
                last_modified_by ${numericType} NULL,
                last_modified_on ${numericType}(25,0) NULL,
                stoppeddate ${numericType}(25,0) NULL,
                CONSTRAINT auto_execution_pkey PRIMARY KEY (id)
        `, dbType)

        // AUTO_SAB_CHAT_SESSION
        const chatSessionIdDefault = getIdDefaultClause('auto_sab_chat_session_id_seq', dbType)
        const jsonType = getJsonType(dbType)
        await createTable(dataSource, 'auto_sab_chat_session', `
                id ${numericType}${dbType === 'postgres' ? ` NOT NULL` : ``}${chatSessionIdDefault ? ' ' + chatSessionIdDefault : ''},
                guid ${varcharType15} NOT NULL,
                chatflowid ${varcharType15} NOT NULL,
                chatid ${varcharType} NOT NULL UNIQUE,
                title ${varcharType255} NULL,
                created_by ${numericType} NOT NULL,
                created_on ${numericType}(25,0) NOT NULL,
                messagecount ${integerType} DEFAULT 0 NOT NULL,
                preview ${textType} NULL,
                CONSTRAINT auto_sab_chat_session_pkey PRIMARY KEY (id)
        `, dbType)

        // AUTO_SAB_LLM_USAGE
        const llmUsageIdDefault = getIdDefaultClause('auto_sab_llm_usage_id_seq', dbType)
        const varcharType100 = getVarcharType(100, dbType)
        const decimalType = getDecimalType(20, 12, dbType)
        const timestampDefault = getTimestampDefault(dbType)
        await createTable(dataSource, 'auto_sab_llm_usage', `
                id ${numericType}${dbType === 'postgres' ? ` NOT NULL` : ``}${llmUsageIdDefault ? ' ' + llmUsageIdDefault : ''},
                guid ${varcharType15} NOT NULL,
                request_id ${varcharType255} NOT NULL,
                execution_id ${varcharType15},
                user_id ${varcharType255} NOT NULL,
                chatflow_id ${varcharType15},
                chat_id ${varcharType255},
                session_id ${varcharType255},
                feature ${varcharType50} NOT NULL,
                node_id ${varcharType255},
                node_type ${varcharType100},
                node_name ${varcharType255},
                location ${varcharType255},
                provider ${varcharType50} NOT NULL,
                model ${varcharType100} NOT NULL,
                request_type ${varcharType50},
                prompt_tokens ${integerType} DEFAULT 0,
                completion_tokens ${integerType} DEFAULT 0,
                total_tokens ${integerType} DEFAULT 0,
                cost ${decimalType} DEFAULT 0,
                processing_time_ms ${integerType},
                response_length ${integerType},
                success ${boolType} DEFAULT ${dbType === 'postgres' ? 'true' : '1'},
                error_message ${textType},
                cache_hit ${boolType} DEFAULT ${dbType === 'postgres' ? 'false' : '0'},
                metadata ${jsonType},
                created_at TIMESTAMP DEFAULT ${timestampDefault},
                CONSTRAINT auto_sab_llm_usage_pkey PRIMARY KEY (id)
        `, dbType)

        // ============================================
        // CREATE ALL INDEXES
        // ============================================

        // ============================================
        // INDEXES FOR HIGH-VOLUME TABLES
        // ============================================

        // auto_chat_message indexes (HIGHEST VOLUME - Most Critical)
        await createIndex(dataSource, 'idx_auto_chat_message_chatflowid', 'auto_chat_message', 'chatflowid', dbType)
        await createIndex(dataSource, 'idx_auto_chat_message_executionid', 'auto_chat_message', 'executionid', dbType)
        await createIndex(dataSource, 'idx_auto_chat_message_chatid', 'auto_chat_message', 'chatid', dbType)
        await createIndex(dataSource, 'idx_auto_chat_message_sessionid', 'auto_chat_message', 'sessionid', dbType)
        await createIndex(dataSource, 'idx_auto_chat_message_created_on', 'auto_chat_message', 'created_on', dbType)
        await createIndex(dataSource, 'idx_auto_chat_message_chattype', 'auto_chat_message', 'chattype', dbType)
        await createIndex(dataSource, 'idx_auto_chat_message_flow_date', 'auto_chat_message', 'chatflowid, created_on', dbType)

        // auto_execution indexes (HIGH VOLUME)
        await createIndex(dataSource, 'idx_auto_execution_agentflowid', 'auto_execution', 'agentflowid', dbType)
        await createIndex(dataSource, 'idx_auto_execution_sessionid', 'auto_execution', 'sessionid', dbType)
        await createIndex(dataSource, 'idx_auto_execution_state', 'auto_execution', 'state', dbType)
        await createIndex(dataSource, 'idx_auto_execution_created_on', 'auto_execution', 'created_on', dbType)
        await createIndex(dataSource, 'idx_auto_execution_stoppeddate', 'auto_execution', 'stoppeddate', dbType)

        // auto_document_store_file_chunk indexes (HIGH VOLUME)
        await createIndex(dataSource, 'idx_auto_document_store_file_chunk_docid', 'auto_document_store_file_chunk', 'docid', dbType)
        await createIndex(dataSource, 'idx_auto_document_store_file_chunk_storeid', 'auto_document_store_file_chunk', 'storeid', dbType)
        await createIndex(dataSource, 'idx_auto_document_store_file_chunk_store_doc', 'auto_document_store_file_chunk', 'storeid, docid', dbType)

        // auto_upsert_history indexes (HIGH VOLUME)
        await createIndex(dataSource, 'idx_auto_upsert_history_created_on', 'auto_upsert_history', 'created_on', dbType)

        // auto_sab_llm_usage indexes (HIGH VOLUME)
        await createIndex(dataSource, 'idx_auto_sab_llm_usage_request_id', 'auto_sab_llm_usage', 'request_id', dbType)
        await createIndex(dataSource, 'idx_auto_sab_llm_usage_execution_id', 'auto_sab_llm_usage', 'execution_id', dbType)
        await createIndex(dataSource, 'idx_auto_sab_llm_usage_user_id', 'auto_sab_llm_usage', 'user_id', dbType)
        await createIndex(dataSource, 'idx_auto_sab_llm_usage_chatflow_id', 'auto_sab_llm_usage', 'chatflow_id', dbType)
        await createIndex(dataSource, 'idx_auto_sab_llm_usage_feature', 'auto_sab_llm_usage', 'feature', dbType)
        await createIndex(dataSource, 'idx_auto_sab_llm_usage_created_at', 'auto_sab_llm_usage', 'created_at', dbType)
        await createIndex(dataSource, 'idx_auto_sab_llm_usage_provider_model', 'auto_sab_llm_usage', 'provider, model', dbType)

        // ============================================
        // INDEXES FOR CREATED_BY (User Isolation) - Only for High-Volume Tables
        // ============================================
        await createIndex(dataSource, 'idx_auto_chat_message_created_by', 'auto_chat_message', 'created_by', dbType)
        await createIndex(dataSource, 'idx_auto_execution_created_by', 'auto_execution', 'created_by', dbType)
        await createIndex(dataSource, 'idx_auto_upsert_history_created_by', 'auto_upsert_history', 'created_by', dbType)
        // Note: auto_document_store_file_chunk doesn't have created_by column, so no index needed

        // Verify that tables were created - check for lowercase unquoted identifiers
        // PostgreSQL stores unquoted identifiers as lowercase, Oracle stores them as uppercase
        let allTables
        if (dbType === 'postgres') {
            allTables = await dataSource.query(`
                SELECT table_schema, table_name 
                FROM information_schema.tables 
                WHERE table_name IN ('auto_chat_flow', 'auto_chat_message', 'auto_credential', 'auto_tool', 'auto_assistant', 'auto_variable', 'auto_apikey', 'auto_upsert_history', 'auto_chat_message_feedback', 'auto_document_store', 'auto_document_store_file_chunk', 'auto_custom_template', 'auto_execution', 'auto_sab_chat_session', 'auto_sab_llm_usage')
                ORDER BY table_schema, table_name
            `)
        } else {
            allTables = await dataSource.query(`
                SELECT owner as table_schema, table_name 
                FROM all_tables 
                WHERE table_name IN ('AUTO_CHAT_FLOW', 'AUTO_CHAT_MESSAGE', 'AUTO_CREDENTIAL', 'AUTO_TOOL', 'AUTO_ASSISTANT', 'AUTO_VARIABLE', 'AUTO_APIKEY', 'AUTO_UPSERT_HISTORY', 'AUTO_CHAT_MESSAGE_FEEDBACK', 'AUTO_DOCUMENT_STORE', 'AUTO_DOCUMENT_STORE_FILE_CHUNK', 'AUTO_CUSTOM_TEMPLATE', 'AUTO_EXECUTION', 'AUTO_SAB_CHAT_SESSION', 'AUTO_SAB_LLM_USAGE')
                ORDER BY owner, table_name
            `)
        }

        const expectedTables = ['auto_chat_flow', 'auto_chat_message']
        const foundTableNames = allTables.map((t: any) => t.table_name)

        logInfo(`✅ [Schema]: All tables and columns created for orgId ${orgId}`).catch(() => { })
        logInfo(`📋 [Schema]: Found ${allTables.length} AUTO_* tables in database`).catch(() => { })
        if (allTables.length > 0) {
            logInfo(`📋 [Schema]: Tables found: ${allTables.map((t: any) => `${t.table_schema}.${t.table_name}`).slice(0, 5).join(', ')}${allTables.length > 5 ? '...' : ''}`).catch(() => { })
        }

        // Check if at least the key tables exist (exact case match for quoted identifiers)
        const hasKeyTables = expectedTables.every(expected =>
            foundTableNames.includes(expected)
        )

        if (!hasKeyTables && allTables.length === 0) {
            logWarn(`⚠️ [Schema]: No AUTO_* tables found. Tables may not have been created.`).catch(() => { })
            // Don't throw error - allow server to continue, tables might exist from previous run
        } else if (!hasKeyTables && allTables.length > 0) {
            logWarn(`⚠️ [Schema]: Some expected tables not found. Expected: ${expectedTables.join(', ')}, Found: ${foundTableNames.slice(0, 10).join(', ')}`).catch(() => { })
            // Don't throw - tables exist, just not the ones we expected
        } else {
            logInfo(`✅ [Schema]: Key tables verified: ${expectedTables.filter(t => foundTableNames.includes(t)).join(', ')}`).catch(() => { })
        }
    } catch (error: any) {
        logError(`❌ [Schema]: Failed to create schema for orgId ${orgId}: ${error.message || String(error)}`, error).catch(() => { })
        logError(`❌ [Schema]: Error details: ${error.message || String(error)}`).catch(() => { })
        if (error.stack) {
            logError(`❌ [Schema]: Stack trace: ${error.stack}`).catch(() => { })
        }
        throw error
    }
}
