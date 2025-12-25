# Encryption Key File (`encryption.key`) - Complete Guide

## Overview

The `encryption.key` file is a **critical security component** of Kodivian that stores the master encryption key used to encrypt and decrypt sensitive credential data (API keys, passwords, tokens, etc.) stored in the database.

**Important Distinction**: 
- **Credential Encryption** (uses `encryption.key`): AES encryption for credentials stored in database - **Always enabled**
- **E2E Encryption** (RSA + AES-256-GCM): Optional request/response encryption - **Separate system**, uses RSA key pair (not `encryption.key`)

---

## 1. What is `encryption.key`?

### Purpose

The `encryption.key` file contains a **master encryption key** (32 bytes, base64-encoded = 44 characters) that is used to:
- **Encrypt** credential data before storing in the database
- **Decrypt** credential data when nodes need to use credentials during execution

### Key Characteristics

- **Auto-generated**: Created automatically on first server startup if it doesn't exist
- **Persistent**: Stored on disk and reused across server restarts
- **Critical**: **Losing this file means all encrypted credentials become unusable**
- **Single key**: One key per Kodivian instance (shared across all organizations)
- **File-based**: Stored as plain text file (not encrypted itself)
- **Length**: 32 characters (24 random bytes → base64 encoding)
- **Format**: Base64-encoded string, single line, no newlines
- **Encoding**: UTF-8

---

## 2. File Location

### Default Location

**Path**: `{KODIVIAN_DATA_PATH}/.kodivian/encryption.key`

**Default**: `packages/server/.kodivian/encryption.key`

### Path Resolution Logic

**File**: `packages/server/src/utils/index.ts` (lines 100-113)

```typescript
export const getKodivianDataPath = (): string => {
    if (process.env.KODIVIAN_DATA_PATH) {
        return path.join(process.env.KODIVIAN_DATA_PATH, '.kodivian')
    }
    // Default to .kodivian inside the server package directory
    const serverRoot = path.resolve(__dirname, '..', '..')
    return path.join(serverRoot, '.kodivian')
}
```

**File**: `packages/components/src/utils.ts` (lines 496-520)

The system checks multiple possible locations in order:

1. `SECRETKEY_PATH/encryption.key` (if `SECRETKEY_PATH` env var is set)
2. `{KODIVIAN_DATA_PATH}/.kodivian/encryption.key` (if `KODIVIAN_DATA_PATH` is set)
3. Various relative paths from components directory (legacy support)
4. Default: `packages/server/.kodivian/encryption.key`

### Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `KODIVIAN_DATA_PATH` | Base directory for all Kodivian data | `/data/kodivian` → `/data/kodivian/.kodivian/encryption.key` |
| `SECRETKEY_PATH` | Override path for encryption key specifically | `/secrets` → `/secrets/encryption.key` |

**Priority**: `SECRETKEY_PATH` > `KODIVIAN_DATA_PATH/.kodivian` > default

---

## 3. File Creation

### Automatic Creation

**When**: On first server startup if file doesn't exist

**File**: `packages/server/src/utils/index.ts` (lines 1610-1658)

**Process**:

1. **Check if file exists**
   ```typescript
   try {
       const key = await fs.promises.readFile(encryptionKeyPath, 'utf8')
       if (key && key.trim().length > 0) {
           return key.trim()  // Return existing key
       }
   } catch (readError) {
       // File doesn't exist - create it
   }
   ```

2. **Generate new key**
   ```typescript
   const encryptKey = generateEncryptKey()  // 24 random bytes → base64
   ```

3. **Ensure directory exists**
   ```typescript
   ensureKodivianDataPath()  // Creates .kodivian directory if needed
   ```

4. **Write file exclusively**
   ```typescript
   await fs.promises.writeFile(encryptionKeyPath, encryptKey, { flag: 'wx' })
   // 'wx' flag: Create file exclusively (fails if exists)
   // Prevents race conditions in cluster environments
   ```

### Key Generation

**File**: `packages/server/src/utils/index.ts` (line 1705)

```typescript
export const generateEncryptKey = (): string => {
    return randomBytes(24).toString('base64')
    // 24 bytes = 192 bits
    // Base64 encoding = 32 characters
}
```

**Note**: Components package uses same logic but generates 24 bytes:
```typescript
const crypto = await import('crypto')
const encryptKey = crypto.randomBytes(24).toString('base64')
```

### Cluster-Safe Creation

**Race Condition Handling**:

In cluster/multi-instance environments, multiple instances may try to create the file simultaneously:

1. **First instance**: Creates file with `wx` flag (exclusive write)
2. **Other instances**: Get `EEXIST` error → Retry reading the file
3. **Result**: All instances use the same key

```typescript
try {
    await fs.promises.writeFile(encryptionKeyPath, encryptKey, { flag: 'wx' })
} catch (writeError: any) {
    if (writeError.code === 'EEXIST') {
        // File created by another instance - read it
        const existingKey = await fs.promises.readFile(encryptionKeyPath, 'utf8')
        return existingKey.trim()
    }
}
```

---

## 4. File Format

### Content

- **Format**: Plain text, base64-encoded string
- **Length**: 32 characters (24 bytes → base64)
- **Example**: `aBc123XyZ456DeF789GhI012JkL345MnO`
- **Encoding**: UTF-8
- **No newlines**: Single line, trimmed

### Example File

```
aBc123XyZ456DeF789GhI012JkL345MnO
```

**Note**: This is just an example - actual keys are randomly generated.

---

## 5. Usage Areas

### A. Credential Encryption/Decryption

**Primary Use Case**: Encrypting and decrypting credential data stored in the database

#### Encryption Flow

**File**: `packages/server/src/utils/index.ts` (lines 1665-1668)

```typescript
export const encryptCredentialData = async (
    plainDataObj: ICredentialDataDecrypted
): Promise<string> => {
    const encryptKey = await getEncryptionKey()
    return AES.encrypt(JSON.stringify(plainDataObj), encryptKey).toString()
}
```

**Process**:
1. Read encryption key from file
2. Convert credential object to JSON string
3. Encrypt using AES (CryptoJS library)
4. Return encrypted string (stored in database)

**Example**:
```typescript
// Input (plain)
{
    "apiKey": "sk-1234567890",
    "apiSecret": "secret123"
}

// Output (encrypted)
"U2FsdGVkX1+abc123xyz456..."  // AES-encrypted string
```

#### Decryption Flow

**File**: `packages/server/src/utils/index.ts` (lines 1677-1699)

```typescript
export const decryptCredentialData = async (
    encryptedData: string,
    componentCredentialName?: string,
    componentCredentials?: IComponentCredentials
): Promise<ICredentialDataDecrypted> => {
    const encryptKey = await getEncryptionKey()
    const decryptedData = AES.decrypt(encryptedData, encryptKey)
    const decryptedDataStr = decryptedData.toString(enc.Utf8)
    
    return JSON.parse(decryptedDataStr)
}
```

**Process**:
1. Read encryption key from file
2. Decrypt encrypted string using AES
3. Convert to UTF-8 string
4. Parse JSON to get credential object

**Example**:
```typescript
// Input (encrypted)
"U2FsdGVkX1+abc123xyz456..."

// Output (decrypted)
{
    "apiKey": "sk-1234567890",
    "apiSecret": "secret123"
}
```

### B. Credential Storage in Database

**Table**: `auto_credential`

**Column**: `encryptedData` (TEXT/CLOB)

**Storage**:
- Credentials are **never stored in plain text**
- Only encrypted data is stored in database
- Encryption key is **never stored in database**

**Example Database Record**:
```sql
INSERT INTO auto_credential (
    guid,
    name,
    credentialName,
    encryptedData,  -- AES-encrypted JSON string
    created_by,
    created_on
) VALUES (
    'cred-guid-123',
    'OpenAI API Key',
    'openAIApi',
    'U2FsdGVkX1+abc123xyz456...',  -- Encrypted credential data
    1,
    1700000000000
);
```

### C. Node Execution

**File**: `packages/components/src/utils.ts` (lines 638-699)

When a node needs credential data during execution:

1. **Node requests credential**:
   ```typescript
   const credentialData = await getCredentialData(credentialId, options)
   ```

2. **System fetches credential from database**:
   ```typescript
   const credential = await repository.findOneBy({ guid: credentialId })
   ```

3. **Decrypt credential data**:
   ```typescript
   const decryptedData = await decryptCredentialData(credential.encryptedData)
   ```

4. **Node uses decrypted data**:
   ```typescript
   const apiKey = decryptedData.apiKey
   // Use apiKey to make API calls
   ```

### D. Credential Management APIs

**Endpoints**:
- `POST /api/v1/credentials` - Create credential (encrypts before saving)
- `PUT /api/v1/credentials/:id` - Update credential (encrypts before saving)
- `GET /api/v1/credentials/:id` - Get credential (decrypts before returning)

**File**: `packages/server/src/services/credentials/index.ts`

**Create Credential**:
```typescript
const encryptedData = await encryptCredentialData(body.plainDataObj)
const newCredential = {
    ...body,
    encryptedData  // Store encrypted, not plain text
}
await repository.save(newCredential)
```

**Get Credential**:
```typescript
const credential = await repository.findOneBy({ guid: id })

// Decrypt credential data
const decryptedData = await decryptCredentialData(
    credential.encryptedData,
    credential.credentialName,
    componentCredentials  // For password type redaction
)

// Return with plainDataObj (decrypted), exclude encryptedData
return {
    ...credential,
    plainDataObj: decryptedData,  // Decrypted for UI
    encryptedData: undefined      // Never returned to client
}
```

**Update Credential**:
```typescript
// Get existing credential
const credential = await repository.findOneBy({ guid: id })

// Decrypt existing data
const decryptedData = await decryptCredentialData(credential.encryptedData)

// Handle redacted values (password type fields)
// If new value is REDACTED_CREDENTIAL_VALUE, keep old value
for (const key in requestBody.plainDataObj) {
    if (requestBody.plainDataObj[key] === REDACTED_CREDENTIAL_VALUE) {
        requestBody.plainDataObj[key] = decryptedData[key]  // Keep old value
    }
}

// Merge old and new data
requestBody.plainDataObj = { ...decryptedData, ...requestBody.plainDataObj }

// Transform and encrypt
const updateCredential = await transformToCredentialEntity(requestBody)
updateCredential.last_modified_by = userId
updateCredential.last_modified_on = Date.now()

// Save updated credential
await repository.save(updateCredential)
```

**List Credentials**:
```typescript
// Returns credentials WITHOUT encryptedData
const credentials = await repository.find()
return credentials.map(cred => omit(cred, ['encryptedData']))
```

### E. Credential Redaction (Password Type Fields)

**Purpose**: Prevent password fields from being returned to client in API responses

**Constant**: `REDACTED_CREDENTIAL_VALUE = '_KODIVIAN_BLANK_07167752-1a71-43b1-bf8f-4f32252165db'`

**File**: `packages/server/src/utils/index.ts` (line 67, 1738-1751)

**How It Works**:
1. When credential is retrieved, system checks credential definition
2. Fields marked as `type: 'password'` in credential inputs are redacted
3. Redacted fields are replaced with `REDACTED_CREDENTIAL_VALUE`
4. Client receives redacted value instead of actual password
5. When updating, if value is `REDACTED_CREDENTIAL_VALUE`, old value is preserved

**Example**:
```typescript
// Credential definition
{
    "inputs": [
        { "name": "apiKey", "type": "string" },
        { "name": "apiSecret", "type": "password" }  // Password type
    ]
}

// Decrypted credential data
{
    "apiKey": "sk-1234567890",
    "apiSecret": "secret123"
}

// After redaction (returned to client)
{
    "apiKey": "sk-1234567890",
    "apiSecret": "_KODIVIAN_BLANK_07167752-1a71-43b1-bf8f-4f32252165db"
}
```

**Update Logic**:
```typescript
// Client sends update with redacted password
{
    "apiKey": "sk-new-key",
    "apiSecret": "_KODIVIAN_BLANK_07167752-1a71-43b1-bf8f-4f32252165db"
}

// Server preserves old password value
{
    "apiKey": "sk-new-key",        // Updated
    "apiSecret": "secret123"      // Preserved (old value)
}
```

### F. Credential Types and Validation

**Credential Types**: Defined in `packages/components/credentials/` directory

**Common Types**:
- `openAIApi` - OpenAI API key
- `googleGenerativeAI` - Google AI API key
- `anthropicApi` - Anthropic API key
- `awsCredential` - AWS credentials
- `azureCredential` - Azure credentials
- `customCredential` - Custom credentials

**Validation**:
- Credential definitions specify required fields and types
- Password type fields are automatically redacted
- Credential names must match registered credential types
- Each credential has `credentialName` field that maps to credential definition

**File**: `packages/components/credentials/*.credential.ts`

---

## 6. Encryption Algorithm

### Algorithm: AES (Advanced Encryption Standard)

**Library**: `crypto-js` (CryptoJS)

**Mode**: Default AES mode (CBC with PKCS7 padding)

**Key Size**: 192 bits (24 bytes)

**Key Format**: Base64-encoded string (32 characters)

**Implementation**:
```typescript
import { AES, enc } from 'crypto-js'

// Encryption
const encrypted = AES.encrypt(JSON.stringify(data), key).toString()
// Returns: "U2FsdGVkX1+abc123xyz456..." (Base64 format)

// Decryption
const decrypted = AES.decrypt(encrypted, key)
const plaintext = decrypted.toString(enc.Utf8)
// Returns: Original JSON string
```

### Encryption Format

**CryptoJS Output Format**:
- **Format**: `Salted__{salt}{encrypted_data}` (Base64)
- **Salt**: 8 bytes (random, generated by CryptoJS)
- **Encrypted Data**: AES-encrypted data (Base64)

**Example Encrypted String**:
```
U2FsdGVkX1+abc123xyz456def789ghi012jkl345mno678pqr901stu234vwx567yz
```

**Structure**:
- `U2FsdGVkX1+` - Base64 encoding of "Salted__" prefix
- `abc123...` - Base64 encoding of salt + encrypted data

### Security Properties

- **Symmetric encryption**: Same key for encryption and decryption
- **Deterministic**: Same input + same key = same output (allows verification)
- **Secure**: AES is industry-standard encryption algorithm
- **Key derivation**: Key is stored directly (not derived from password)
- **Salt**: CryptoJS automatically generates random salt for each encryption
- **IV**: Initialization vector generated automatically by CryptoJS

### Comparison with E2E Encryption

| Feature | Credential Encryption (encryption.key) | E2E Encryption |
|---------|--------------------------------------|---------------|
| **Purpose** | Encrypt credentials in database | Encrypt API requests/responses |
| **Algorithm** | AES (CryptoJS) | RSA + AES-256-GCM |
| **Key Storage** | File (`encryption.key`) | RSA key pair (memory) + session keys (Redis) |
| **Key Size** | 192 bits (24 bytes) | RSA: 2048 bits, AES: 256 bits |
| **Status** | Always enabled | Optional (`ENABLE_E2E_ENCRYPTION=true`) |
| **Usage** | Database storage | Network transmission |
| **Library** | crypto-js | Node.js crypto (RSA) + crypto-js (AES) |

---

## 7. Initialization

### Server Startup

**File**: `packages/server/src/index.ts` (line 809)

```typescript
// Initialize encryption key
await getEncryptionKey()
logInfo('🔑 [server]: Encryption key initialized successfully')
```

**Timing**: 
- Called during server startup
- Before any credential operations
- Ensures key exists before use

**Error Handling**:
- If key file cannot be created → Server startup fails
- If key file cannot be read → Server startup fails
- Critical for server operation

---

## 8. File Permissions & Security

### Current Implementation

**File Permissions**: Default file system permissions (usually `644`)

**Security Considerations**:

⚠️ **Current State**:
- File is stored as **plain text** (not encrypted)
- Accessible to anyone with file system access
- No additional encryption layer

✅ **Best Practices**:
- Store in secure directory with restricted permissions
- Use `SECRETKEY_PATH` to point to secure location
- In production, use secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
- Set file permissions: `chmod 600 encryption.key` (owner read/write only)
- Use environment variables for sensitive paths

### Recommended File Permissions

```bash
# Set restrictive permissions
chmod 600 encryption.key

# Verify permissions
ls -l encryption.key
# Output: -rw------- 1 user user 32 encryption.key
```

### Production Recommendations

1. **Use Secrets Manager**:
   - AWS Secrets Manager
   - Azure Key Vault
   - HashiCorp Vault
   - Google Cloud Secret Manager

2. **Environment Variables**:
   ```bash
   # Point to secure location
   export SECRETKEY_PATH=/secure/secrets
   export KODIVIAN_DATA_PATH=/data/kodivian
   ```

3. **Docker Secrets**:
   ```yaml
   secrets:
     encryption_key:
       file: ./secrets/encryption.key
   ```

4. **Kubernetes Secrets**:
   ```yaml
   apiVersion: v1
   kind: Secret
   metadata:
     name: encryption-key
   data:
     encryption.key: <base64-encoded-key>
   ```

---

## 9. Backup & Recovery

### Backup Strategy

**Critical**: The encryption key file **must be backed up** along with the database.

**Why**: 
- Database contains encrypted credentials
- Without encryption key, credentials cannot be decrypted
- **Losing key = losing all credentials**

### Backup Process

1. **Backup encryption key**:
   ```bash
   cp .kodivian/encryption.key /backup/encryption.key.backup
   ```

2. **Backup database**:
   ```bash
   pg_dump kodivian_db > /backup/database.sql
   ```

3. **Store backups securely**:
   - Encrypted backup storage
   - Separate from database backups
   - Multiple locations

### Recovery Process

**If encryption key is lost**:

❌ **Cannot recover** - All encrypted credentials are permanently lost

**If encryption key is corrupted**:

1. Restore from backup:
   ```bash
   cp /backup/encryption.key.backup .kodivian/encryption.key
   ```

2. Verify decryption:
   ```bash
   # Test with a known credential
   # If decryption fails, key is wrong
   ```

**If encryption key is wrong**:

- Credentials cannot be decrypted
- Nodes will fail when trying to use credentials
- Error: `"Failed to decrypt credential - encryption key may be incorrect"`

### Migration Between Servers

**Scenario**: Moving Kodivian to new server

**Required Files**:
1. `encryption.key` - **Must be copied**
2. Database files - Must be copied
3. Configuration files - Optional

**Process**:
```bash
# On old server
cp .kodivian/encryption.key /backup/

# On new server
cp /backup/encryption.key .kodivian/
# Ensure same path or set KODIVIAN_DATA_PATH
```

**Warning**: 
- **Do not generate new key** on new server
- **Do not lose the key** during migration
- Test decryption after migration

---

## 10. Multi-Instance / Cluster Deployment

### Shared Key Requirement

**Critical**: All instances **must use the same encryption key**

**Why**:
- Credentials encrypted by one instance must be decryptable by others
- Database is shared across instances
- Each instance needs access to all credentials

### Implementation

**Option 1: Shared File System**

```bash
# All instances mount same volume
# encryption.key stored on shared volume
export KODIVIAN_DATA_PATH=/shared/kodivian-data
```

**Option 2: Environment Variable**

```bash
# Set same key for all instances
export ENCRYPTION_KEY="aBc123XyZ456DeF789GhI012JkL345MnO"
```

**Note**: Current implementation doesn't support `ENCRYPTION_KEY` env var - file-based only.

**Option 3: Secrets Manager** (Recommended for production)

```typescript
// Future enhancement: Support AWS Secrets Manager
if (USE_AWS_SECRETS_MANAGER) {
    const key = await secretsManager.getSecret('EncryptionKey')
    return key
}
```

### Cluster-Safe Creation

**Race Condition Handling**:

When multiple instances start simultaneously:

1. **Instance 1**: Tries to create file → Success
2. **Instance 2**: Tries to create file → `EEXIST` error
3. **Instance 2**: Reads file created by Instance 1 → Success
4. **Result**: Both instances use same key

**Code**: `packages/server/src/utils/index.ts` (lines 1639-1653)

---

## 11. Troubleshooting

### Issue: "Encryption key file not found"

**Symptoms**:
- Server fails to start
- Error: `Failed to read encryption key file`

**Causes**:
1. File doesn't exist and cannot be created
2. Permission denied
3. Disk full

**Solutions**:
```bash
# Check if directory exists
ls -la .kodivian/

# Create directory if needed
mkdir -p .kodivian/

# Check permissions
chmod 755 .kodivian/
chmod 600 .kodivian/encryption.key

# Check disk space
df -h
```

### Issue: "Failed to decrypt credential"

**Symptoms**:
- Nodes fail when using credentials
- Error: `"Failed to decrypt credential - encryption key may be incorrect"`

**Causes**:
1. Wrong encryption key file
2. Key file was modified
3. Credentials encrypted with different key

**Solutions**:
```bash
# Verify key file integrity
cat .kodivian/encryption.key

# Check if key matches backup
diff .kodivian/encryption.key /backup/encryption.key.backup

# Restore from backup if different
cp /backup/encryption.key.backup .kodivian/encryption.key
```

### Issue: "Decryption produced empty result"

**Symptoms**:
- Credential decryption returns empty object `{}`
- Nodes cannot access credential data
- Error: `"Decryption produced empty result - encryption key may be incorrect"`

**Causes**:
1. Encryption key is wrong
2. Credential data is corrupted
3. Key file encoding issue
4. Key file has extra whitespace or newlines
5. Credential was encrypted with different key

**Solutions**:
```bash
# Check key file encoding
file .kodivian/encryption.key
# Should be: ASCII text

# Check for hidden characters
cat -A .kodivian/encryption.key

# Verify key length (should be 32 chars, no newline)
wc -c .kodivian/encryption.key
# Should show: 32 (or 33 if newline present)

# Trim whitespace
cat .kodivian/encryption.key | tr -d '\n\r ' > .kodivian/encryption.key.tmp
mv .kodivian/encryption.key.tmp .kodivian/encryption.key

# Verify key format (should be base64)
base64 -d .kodivian/encryption.key > /dev/null 2>&1 && echo "Valid base64" || echo "Invalid base64"
```

### Issue: "Failed to decrypt credential - encryption key may be incorrect"

**Symptoms**:
- Error message: `"Failed to decrypt credential - encryption key may be incorrect or credential was encrypted with different key"`
- Credentials cannot be decrypted
- Nodes fail when using credentials

**Causes**:
1. Wrong encryption key file
2. Credentials encrypted with different key
3. Key file was modified or corrupted
4. Key file encoding changed

**Solutions**:
```bash
# Compare key with backup
diff .kodivian/encryption.key /backup/encryption.key.backup

# Check if key matches across instances (cluster)
# Instance 1
cat .kodivian/encryption.key

# Instance 2
cat .kodivian/encryption.key

# If different, copy from primary instance
scp instance1:/path/to/.kodivian/encryption.key instance2:/path/to/.kodivian/

# Restore from backup
cp /backup/encryption.key.backup .kodivian/encryption.key
```

### Issue: Credential update preserves redacted values incorrectly

**Symptoms**:
- Updating credential with redacted password field doesn't work
- Password field shows `REDACTED_CREDENTIAL_VALUE` in UI

**Cause**: This is **expected behavior** - password fields are redacted for security

**Solution**: 
- To update password: Provide new password value (not redacted value)
- To keep existing password: Send `REDACTED_CREDENTIAL_VALUE` (server preserves old value)
- This is a security feature, not a bug

### Issue: Different keys on different instances

**Symptoms**:
- Credentials work on one instance but not another
- Decryption fails on some instances

**Causes**:
1. Each instance has different key file
2. Key files not synchronized

**Solutions**:
```bash
# Compare keys across instances
# Instance 1
cat .kodivian/encryption.key > /tmp/key1.txt

# Instance 2
cat .kodivian/encryption.key > /tmp/key2.txt

# Compare
diff /tmp/key1.txt /tmp/key2.txt

# If different, copy from primary instance
scp instance1:/path/to/.kodivian/encryption.key instance2:/path/to/.kodivian/
```

---

## 12. Credential Export/Import

### Export

**Note**: Credentials are **NOT exported** in chatflow/agentflow exports for security reasons.

**Why**: 
- Credentials contain sensitive data (API keys, passwords)
- Exporting credentials would expose them in export files
- Users should recreate credentials in new environments

**Export Process**:
- Chatflows/Agentflows: Exported without credentials
- Credentials: Must be created separately in target environment
- Credential references: GUIDs are preserved, but credentials must exist

### Import

**Manual Process**:
1. Export chatflow/agentflow (credentials excluded)
2. Create credentials manually in target environment
3. Import chatflow/agentflow
4. Update credential references if GUIDs changed

**Security Best Practice**: Never export credentials - always recreate them

---

## 13. Security Best Practices

### ✅ Do's

1. **Backup regularly**: Include encryption key in backup strategy
2. **Secure storage**: Store in restricted directory with proper permissions
3. **Monitor access**: Log access to encryption key file
4. **Use secrets manager**: In production, use cloud secrets manager
5. **Separate environments**: Use different keys for dev/staging/prod
6. **Document location**: Document where key is stored for team
7. **Test recovery**: Regularly test key restoration process

### ❌ Don'ts

1. **Don't commit to git**: Never commit encryption key to version control
2. **Don't share keys**: Don't use same key across environments
3. **Don't lose the key**: Losing key = losing all credentials
4. **Don't modify manually**: Never edit key file manually
5. **Don't store in code**: Don't hardcode key in source code
6. **Don't expose in logs**: Don't log encryption key value
7. **Don't use weak keys**: System generates secure keys automatically

---

## 14. Credential Usage Examples

### Example 1: OpenAI API Key Credential

**Create**:
```typescript
POST /api/v1/credentials
{
    "name": "My OpenAI Key",
    "credentialName": "openAIApi",
    "plainDataObj": {
        "openAIApiKey": "sk-1234567890abcdef..."
    }
}
```

**Storage** (encrypted in database):
```sql
encryptedData: "U2FsdGVkX1+abc123xyz456..."  -- AES-encrypted JSON
```

**Usage in Node**:
```typescript
const credentialData = await getCredentialData(credentialId, options)
const apiKey = credentialData.openAIApiKey  // Decrypted automatically
// Use apiKey to make OpenAI API calls
```

### Example 2: AWS Credential (with Password Field)

**Create**:
```typescript
POST /api/v1/credentials
{
    "name": "AWS Production",
    "credentialName": "awsCredential",
    "plainDataObj": {
        "awsAccessKeyId": "AKIAIOSFODNN7EXAMPLE",
        "awsSecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
    }
}
```

**Get** (password field redacted):
```json
{
    "id": 1,
    "guid": "cred-guid-123",
    "name": "AWS Production",
    "credentialName": "awsCredential",
    "plainDataObj": {
        "awsAccessKeyId": "AKIAIOSFODNN7EXAMPLE",
        "awsSecretAccessKey": "_KODIVIAN_BLANK_07167752-1a71-43b1-bf8f-4f32252165db"
    }
}
```

**Update** (preserve password):
```typescript
PUT /api/v1/credentials/cred-guid-123
{
    "name": "AWS Production Updated",
    "plainDataObj": {
        "awsAccessKeyId": "AKIAIOSFODNN7NEWKEY",
        "awsSecretAccessKey": "_KODIVIAN_BLANK_07167752-1a71-43b1-bf8f-4f32252165db"  // Preserves old value
    }
}
```

### Example 3: Custom Credential

**Create**:
```typescript
POST /api/v1/credentials
{
    "name": "Custom API",
    "credentialName": "customCredential",
    "plainDataObj": {
        "apiKey": "custom-key-123",
        "apiSecret": "secret-456",
        "endpoint": "https://api.example.com"
    }
}
```

**Storage** (encrypted):
```sql
encryptedData: "U2FsdGVkX1+encrypted_json_string..."
```

**Decryption** (automatic):
```typescript
// When node needs credential
const credentialData = await getCredentialData(credentialId, options)
// Returns: { apiKey: "custom-key-123", apiSecret: "secret-456", endpoint: "https://api.example.com" }
```

---

## 15. Environment-Specific Configuration

### Development

**Default**: `packages/server/.kodivian/encryption.key`

**Permissions**: `644` (readable by all)

**Backup**: Optional (can regenerate)

### Staging

**Path**: `/data/staging/.kodivian/encryption.key`

**Permissions**: `600` (owner only)

**Backup**: Regular backups

### Production

**Path**: `/secure/secrets/encryption.key` (via `SECRETKEY_PATH`)

**Permissions**: `600` (owner only)

**Backup**: Daily backups + offsite storage

**Secrets Manager**: Recommended (AWS Secrets Manager, etc.)

---

## 16. Code References

### Key Files

1. **Server-side**:
   - `packages/server/src/utils/index.ts` (lines 100-1708)
     - `getKodivianDataPath()` - Get data directory path
     - `getEncryptionKeyPath()` - Get encryption key file path
     - `getEncryptionKey()` - Read/create encryption key
     - `generateEncryptKey()` - Generate new key
     - `encryptCredentialData()` - Encrypt credentials
     - `decryptCredentialData()` - Decrypt credentials

2. **Components-side**:
   - `packages/components/src/utils.ts` (lines 496-630)
     - `getEncryptionKeyFilePath()` - Find encryption key file
     - `getEncryptionKeyPath()` - Get encryption key path
     - `getEncryptionKey()` - Read/create encryption key
     - `decryptCredentialData()` - Decrypt credentials

3. **Server initialization**:
   - `packages/server/src/index.ts` (line 809)
     - Initializes encryption key on startup

### Key Functions

| Function | Purpose | Location |
|----------|---------|----------|
| `getEncryptionKey()` | Read/create encryption key | `server/src/utils/index.ts:1610` |
| `generateEncryptKey()` | Generate random key | `server/src/utils/index.ts:1705` |
| `encryptCredentialData()` | Encrypt credential object | `server/src/utils/index.ts:1665` |
| `decryptCredentialData()` | Decrypt credential string | `server/src/utils/index.ts:1677` |
| `getKodivianDataPath()` | Get data directory | `server/src/utils/index.ts:105` |
| `getEncryptionKeyPath()` | Get key file path | `server/src/utils/index.ts:36` |

---

## 17. Credential Error Handling

### Common Errors

**Error**: `"Encryption key is empty or not found"`
- **Cause**: `encryption.key` file doesn't exist or is empty
- **Solution**: Ensure file exists and contains valid key

**Error**: `"Failed to decrypt credential - encryption key may be incorrect"`
- **Cause**: Wrong encryption key or credential encrypted with different key
- **Solution**: Restore correct encryption key from backup

**Error**: `"Decryption produced empty result - encryption key may be incorrect"`
- **Cause**: Decryption succeeded but produced empty string (wrong key)
- **Solution**: Verify encryption key matches the one used to encrypt credentials

**Error**: `"Credentials could not be decrypted"`
- **Cause**: Decrypted data is not valid JSON
- **Solution**: Check if credential data is corrupted, restore from backup

**Error**: `"Credential not found"`
- **Cause**: Credential GUID doesn't exist in database
- **Solution**: Verify credential ID is correct, check organization database

### Error Recovery

**If Encryption Key is Lost**:
❌ **Cannot recover** - All encrypted credentials are permanently lost

**If Encryption Key is Wrong**:
1. Restore correct key from backup
2. Verify key matches: `diff encryption.key backup/encryption.key.backup`
3. Test decryption with known credential

**If Credential Data is Corrupted**:
1. Check database integrity
2. Restore credential from backup (if available)
3. Recreate credential if backup unavailable

---

## 18. Summary

### Key Points

1. **Purpose**: Master encryption key for credential encryption/decryption
2. **Location**: `{KODIVIAN_DATA_PATH}/.kodivian/encryption.key`
3. **Format**: 32-character base64 string (24 random bytes)
4. **Creation**: Auto-generated on first server startup
5. **Usage**: Encrypt/decrypt credentials stored in database
6. **Critical**: Losing key = losing all credentials
7. **Cluster**: All instances must use same key
8. **Security**: Store securely, backup regularly

### Critical Warnings

⚠️ **DO NOT**:
- Lose the encryption key file
- Modify the encryption key manually
- Use different keys on different instances
- Commit key to version control
- Expose key in logs or error messages

✅ **DO**:
- Backup encryption key regularly
- Store in secure location with proper permissions
- Use secrets manager in production
- Test recovery process
- Document key location for team

---

## 19. Advanced Topics

### Credential Lookup by GUID vs ID

**GUID Lookup** (Preferred):
```typescript
credential = await repository.findOneBy({ guid: credentialId })
```

**Numeric ID Lookup** (Legacy):
```typescript
credential = await repository.findOneBy({ id: parseInt(credentialId) })
```

**Auto-Detection**:
```typescript
const isNumeric = /^\d+$/.test(credentialId)
const isGuid = !isNumeric && credentialId.length === 15 && /^[A-Za-z0-9]+$/.test(credentialId)

if (isGuid) {
    credential = await repository.findOneBy({ guid: credentialId })
} else if (isNumeric) {
    credential = await repository.findOneBy({ id: parseInt(credentialId) })
}
```

### Credential Transformation

**File**: `packages/server/src/utils/index.ts` (line 1714)

**Process**:
```typescript
export const transformToCredentialEntity = async (body: ICredentialReqBody): Promise<Credential> => {
    const credentialBody = {
        name: body.name,
        credentialName: body.credentialName
    }
    
    if (body.plainDataObj) {
        // Encrypt credential data
        const encryptedData = await encryptCredentialData(body.plainDataObj)
        credentialBody.encryptedData = encryptedData
    }
    
    const newCredential = new Credential()
    Object.assign(newCredential, credentialBody)
    return newCredential
}
```

### Credential Redaction Logic

**File**: `packages/server/src/utils/index.ts` (line 1738)

**Process**:
```typescript
export const redactCredentialWithPasswordType = (
    componentCredentialName: string,
    decryptedCredentialObj: ICredentialDataDecrypted,
    componentCredentials: IComponentCredentials
): ICredentialDataDecrypted => {
    const plainDataObj = cloneDeep(decryptedCredentialObj)
    
    // Find credential definition
    const credentialDef = componentCredentials[componentCredentialName]
    
    // Check each field
    for (const cred in plainDataObj) {
        // Find input parameter with type='password' and matching name
        const inputParam = credentialDef.inputs?.find(
            (inp: INodeParams) => inp.type === 'password' && inp.name === cred
        )
        
        if (inputParam) {
            // Redact password field
            plainDataObj[cred] = REDACTED_CREDENTIAL_VALUE
        }
    }
    
    return plainDataObj
}
```

### Credential Update Logic

**File**: `packages/server/src/services/credentials/index.ts` (line 162)

**Process**:
```typescript
// Get existing credential
const credential = await repository.findOneBy({ guid: credentialId })

// Decrypt existing data
const decryptedCredentialData = await decryptCredentialData(credential.encryptedData)

// Handle redacted values
for (const key in requestBody.plainDataObj) {
    if (requestBody.plainDataObj[key] === REDACTED_CREDENTIAL_VALUE) {
        // Preserve old value for redacted fields
        requestBody.plainDataObj[key] = decryptedCredentialData[key]
    }
}

// Merge old and new data
requestBody.plainDataObj = { ...decryptedCredentialData, ...requestBody.plainDataObj }

// Transform and encrypt
const updateCredential = await transformToCredentialEntity(requestBody)
```

---

## 20. Future Enhancements

### Potential Improvements

1. **Environment Variable Support**:
   ```typescript
   if (process.env.ENCRYPTION_KEY) {
       return process.env.ENCRYPTION_KEY
   }
   ```

2. **Secrets Manager Integration**:
   - AWS Secrets Manager
   - Azure Key Vault
   - HashiCorp Vault

3. **Key Rotation**:
   - Support for rotating encryption keys
   - Re-encrypt all credentials with new key

4. **Key Encryption**:
   - Encrypt the encryption key file itself
   - Use master key or hardware security module (HSM)

5. **Key Derivation**:
   - Derive key from password/master key
   - Support for key derivation functions (PBKDF2, Argon2)

---

## 21. Comparison: Credential Encryption vs E2E Encryption

### Key Differences

| Aspect | Credential Encryption | E2E Encryption |
|--------|----------------------|----------------|
| **Purpose** | Encrypt credentials in database | Encrypt API requests/responses |
| **Key File** | `encryption.key` (persistent) | RSA key pair (memory) + session keys (Redis) |
| **Algorithm** | AES (CryptoJS) | RSA (2048-bit) + AES-256-GCM |
| **Key Size** | 192 bits (24 bytes) | RSA: 2048 bits, AES: 256 bits |
| **Status** | Always enabled | Optional (`ENABLE_E2E_ENCRYPTION=true`) |
| **Storage** | File on disk | Memory (RSA) + Redis (session keys) |
| **Scope** | Database credentials | Network traffic |
| **Library** | crypto-js | Node.js crypto (RSA) + crypto-js (AES) |
| **Key Rotation** | Manual (replace file) | Automatic (new session key per session) |
| **Performance** | Fast (symmetric) | Slower (asymmetric + symmetric) |

### When to Use Each

**Credential Encryption** (Always):
- ✅ Storing API keys, passwords, tokens in database
- ✅ Protecting sensitive credential data
- ✅ Required for all credential operations

**E2E Encryption** (Optional):
- ✅ Extra security for API communication
- ✅ Compliance requirements (HIPAA, GDPR)
- ✅ High-security environments
- ⚠️ Adds overhead (RSA encryption/decryption)

### Important Notes

1. **They are separate**: E2E encryption does NOT replace credential encryption
2. **Both can be enabled**: You can use both simultaneously
3. **Credential encryption is mandatory**: Cannot be disabled
4. **E2E encryption is optional**: Can be enabled/disabled via environment variable

---

## 22. Conclusion

The `encryption.key` file is a **critical security component** that must be:
- **Protected**: Stored securely with proper permissions (`chmod 600`)
- **Backed up**: Included in backup strategy (along with database)
- **Shared**: Same key across all instances in cluster
- **Monitored**: Access should be logged and monitored
- **Documented**: Location and backup procedures should be documented

**Remember**: 
- Without this file, all encrypted credentials become unusable
- Losing the key = losing all credentials permanently
- Treat it as a critical asset and protect it accordingly
- Always backup before making changes
- Test recovery procedures regularly

**Security Checklist**:
- ✅ File permissions set to `600` (owner read/write only)
- ✅ Stored in secure directory
- ✅ Backed up regularly
- ✅ Backups stored securely (encrypted, offsite)
- ✅ Documented location and recovery procedures
- ✅ Tested recovery process
- ✅ Same key across all cluster instances
- ✅ Never committed to version control

