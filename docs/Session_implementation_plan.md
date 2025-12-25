# Session Architecture Changes - Unified SABID Cookie Implementation

## Goal
Unify session management between **Deployment Server** and **Kodivian Server** by sharing a single `SABID` cookie at root path `/`. Both servers can create sessions and both must store session in DB via Designer call.

## Current Architecture

| Server | Cookie Name | Path | Redis Key Format | Stored in DB |
|--------|-------------|------|------------------|--------------|
| **Deployment Server** | SABID | `/apps` | `{sessionId}$${kodivianSessionId}$${userId}$$Sails{orgId}` | ✅ Yes |
| **Kodivian Server** | AUTOID | `/` | `KODIVIAN_SESSION_{token}` | ❌ No |

## Target Architecture

| Server | Cookie Name | Path | Redis Key Format | Stored in DB |
|--------|-------------|------|------------------|--------------|
| **Deployment Server** | SABID | `/` | `{sessionId}$${kodivianSessionId}$${userId}$$Sails{orgId}` | ✅ Yes |
| **Kodivian Server** | SABID | `/` | Same format as Deployment Server | ✅ Yes |

---

## Decisions Confirmed

> [!NOTE]
> **Cookie Secret**: Both servers use the same secret (`a665d1c89dd7049ecb3e2dddce727281` from [session.js](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/browserapp/config/session.js)).

> [!NOTE]
> **Session Migration**: With 15-minute TTL, sessions expire naturally after deployment. No migration needed.

> [!NOTE]
> **Bidirectional Session Creation**: Both servers can create SABID sessions. Both must store session in DB via Designer call ([updateCoreLoginDetails](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/browserapp/api/services/appStartupService.js#233-268)).

---

## Proposed Changes

### Deployment Server ([/app_v17_builder/inputs/browserapp/](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/browserapp))

---

#### [MODIFY] [AuthController.js](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/browserapp/api/controllers/AuthController.js)

**Change SABID cookie path from `/apps` to `/` in 5 locations:**

```javascript
// === LOGIN FUNCTION (lines 364-369) ===
res.cookie('SABID', redisKey, {
    signed: true,
    httpOnly: true,
    path: '/',  // Changed from '/apps'
    maxAge: exTime
});

// === SWITCHER FUNCTION - Existing Session (lines 553-558) ===
res.cookie('SABID', redisKey, {
    signed: true,
    httpOnly: true,
    path: '/',  // Changed from '/apps'
    maxAge: exTime
});

// === SWITCHER FUNCTION - New Session (lines 762-767) ===
res.cookie('SABID', redisKey, {
    signed: true,
    httpOnly: true,
    path: '/',  // Changed from '/apps'
    maxAge: exTime
});

// === LOGOUT FUNCTION (lines 241-242) ===
res.clearCookie('sails.sid', { path: '/' });  // Changed from '/apps'
res.clearCookie('SABID', { path: '/' });      // Changed from '/apps'

// === LOGOUT FUNCTION - Error handler (lines 268-269) ===
res.clearCookie('sails.sid', { path: '/' });  // Changed from '/apps'
res.clearCookie('SABID', { path: '/' });      // Changed from '/apps'
```

---

#### [MODIFY] [AuthCheck.js](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/browserapp/api/policies/AuthCheck.js)

**Change cookie refresh path (lines 21-26):**

```javascript
res.cookie('SABID', sab_id, {
    signed: true,
    httpOnly: true,
    path: '/',  // Changed from '/apps'
    maxAge: exTime
});
```

---

#### [MODIFY] [session.js](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/browserapp/config/session.js)

**Change default session cookie path (lines 25-28):**

```javascript
cookie: {    
    maxAge: 900000,
    path: '/'  // Changed from '/apps'
},
```

---

### Kodivian Server (`/app_v17_builder/inputs/kodivian/packages/server/src/`)

---

#### [MODIFY] [cookie.ts](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/kodivian/packages/server/src/utils/cookie.ts)

**Add cookie secret constant:**

```typescript
/**
 * Cookie configuration utility
 * Centralizes cookie option creation from environment variables
 */

// Cookie secret - must match Deployment Server (session.js)
export const COOKIE_SECRET = process.env.SESSION_SECRET || 'a665d1c89dd7049ecb3e2dddce727281'

export function getCookieOptions(maxAge?: number): any {
    const ttl = maxAge || parseInt(process.env.SESSION_COOKIE_MAX_AGE || '900')
    const cookieDomain = process.env.SESSION_COOKIE_DOMAIN || undefined
    let cleanCookieDomain = cookieDomain?.startsWith('.') ? cookieDomain.substring(1) : cookieDomain

    if (!cleanCookieDomain || cleanCookieDomain === 'localhost' || cleanCookieDomain.includes('localhost')) {
        cleanCookieDomain = undefined
    }

    const cookieOptions: any = {
        path: '/',  // Root path for cross-server access
        httpOnly: true,
        signed: true,  // Must be signed like Deployment Server
        maxAge: ttl * 1000,
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production'
    }

    if (cleanCookieDomain) {
        cookieOptions.domain = cleanCookieDomain
    }

    return cookieOptions
}

// Get SABID cookie options matching Deployment Server exactly
export function getSABIDCookieOptions(maxAge: number = 900000): any {
    return {
        signed: true,
        httpOnly: true,
        path: '/',
        maxAge: maxAge
    }
}
```

---

#### [MODIFY] [index.ts](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/kodivian/packages/server/src/index.ts)

**Configure cookie-parser with signing secret:**

```typescript
// Find the existing cookieParser import and usage, update to:
import cookieParser from 'cookie-parser'
import { COOKIE_SECRET } from './utils/cookie'

// In the express app setup:
app.use(cookieParser(COOKIE_SECRET))  // Add secret for signed cookies
```

---

#### [MODIFY] [kodivian-session.service.ts](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/kodivian/packages/server/src/services/kodivian-session.service.ts)

**Add new methods for SABID session management (matching Deployment Server pattern):**

```typescript
import { v4 as uuidv4 } from 'uuid'

// Add these new methods to KodivianSessionService class:

/**
 * Create SABID session - EXACT same format as Deployment Server
 * Token format: {sessionId}$${kodivianSessionId}$${userId}$$Sails{orgId}
 * 
 * This matches Deployment Server's AuthController.js login function
 */
async createSABIDSession(
    kodivianSessionId: string, 
    userId: string, 
    orgId: string, 
    userData: any
): Promise<string> {
    const sessionId = uuidv4()
    // EXACT format from Deployment Server (AuthController.js line 325-326):
    // const SABID = `${KodivianSessionid}$$${userId}$$Sails${orgId}`
    // const redisKey = `${req.sessionID}$$${SABID}`
    const SABID = `${kodivianSessionId}$$${userId}$$Sails${orgId}`
    const sabidToken = `${sessionId}$$${SABID}`
    
    // Store session data in Redis (same structure as Deployment Server)
    const sessionData = {
        UserInfoDetails: userData.UserInfoDetails,
        KodivianSessionid: kodivianSessionId,
        isPublicUser: userData.isPublicUser || false,
        // Include all fields that Deployment Server stores
    }
    
    const ttl = this.SESSION_TTL
    const redisClient = await this.ensureRedisReady(parseInt(orgId))
    await redisClient.setex(sabidToken, ttl, JSON.stringify(sessionData))
    
    logInfo(`SABID session created (orgId: ${orgId}, userId: ${userId}, token: ${sabidToken.substring(0, 30)}...)`).catch(() => {})
    
    return sabidToken
}

/**
 * Validate SABID session from Redis
 * Key format: {sessionId}$${kodivianSessionId}$${userId}$$Sails{orgId}
 */
async validateSABIDSession(sabidToken: string, orgId: string): Promise<any> {
    try {
        const redisClient = await this.ensureRedisReady(parseInt(orgId))
        const sessionData = await redisClient.get(sabidToken)
        
        if (!sessionData) {
            logDebug(`SABID session not found (orgId: ${orgId}, token: ${sabidToken.substring(0, 30)}...)`).catch(() => {})
            return null
        }
        
        return JSON.parse(sessionData)
    } catch (error) {
        logError(`SABID session validation error: ${error instanceof Error ? error.message : String(error)}`, error).catch(() => {})
        return null
    }
}

/**
 * Extend SABID session TTL
 */
async extendSABIDSession(sabidToken: string, orgId: string): Promise<boolean> {
    try {
        const ttl = this.SESSION_TTL
        const redisClient = await this.ensureRedisReady(parseInt(orgId))
        const result = await redisClient.expire(sabidToken, ttl)
        
        if (result === 1) {
            logDebug(`SABID session TTL extended (orgId: ${orgId}, ttl: ${ttl})`).catch(() => {})
            return true
        }
        return false
    } catch (error) {
        logError(`SABID session extend error: ${error instanceof Error ? error.message : String(error)}`, error).catch(() => {})
        return false
    }
}

/**
 * Parse SABID token to extract orgId
 * Token format: {sessionId}$${kodivianSessionId}$${userId}$$Sails{orgId}
 */
static parseOrgIdFromSABID(sabidToken: string): string | null {
    const parts = sabidToken.split('$$')
    if (parts.length < 4) return null
    
    const sailsOrgPart = parts[3]  // "Sails{orgId}"
    if (!sailsOrgPart || !sailsOrgPart.startsWith('Sails')) return null
    
    return sailsOrgPart.substring(5)  // Remove "Sails" prefix
}

/**
 * Parse SABID token to extract all components
 */
static parseSABIDToken(sabidToken: string): { sessionId: string, kodivianSessionId: string, userId: string, orgId: string } | null {
    const parts = sabidToken.split('$$')
    if (parts.length < 4) return null
    
    const sailsOrgPart = parts[3]
    if (!sailsOrgPart || !sailsOrgPart.startsWith('Sails')) return null
    
    return {
        sessionId: parts[0],
        kodivianSessionId: parts[1],
        userId: parts[2],
        orgId: sailsOrgPart.substring(5)
    }
}
```

---

#### [NEW] [session-db.service.ts](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/kodivian/packages/server/src/services/session-db.service.ts)

**Create new service to store session in DB (matching Deployment Server's [updateSailsSessionIdInDB](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/browserapp/api/controllers/AdditionalInfoController.js#23-62)):**

```typescript
import { logInfo, logError } from '../utils/logger/system-helper'

interface SessionDBParams {
    sessionId: string
    sessionType: string  // 'NODEJS'
    logOutMode: string
    sessionGuid: string  // kodivianSessionId
    sessionStatus: string  // 'ACTIVE' or 'INACTIVE'
    userId: string
    loginMode: string  // 'BROWSER'
    org_id: string
}

/**
 * Update session in cor_login_details table via Designer
 * Matches Deployment Server's updateSailsSessionIdInDB + updateCoreLoginDetails
 */
export async function updateSessionInDB(
    kodivianSessionId: string,
    sailsSessionId: string, 
    userId: string,
    orgId: string,
    status: string = 'ACTIVE',
    logoutMode: string = ''
): Promise<{ status: boolean, errorMsg?: string }> {
    try {
        const params: SessionDBParams = {
            sessionId: sailsSessionId,
            sessionType: 'NODEJS',
            logOutMode: logoutMode,
            sessionGuid: kodivianSessionId,
            sessionStatus: status,
            userId: userId,
            loginMode: 'BROWSER',
            org_id: orgId
        }
        
        // Call Designer server to update cor_login_details table
        // This matches Deployment Server's bridgeController.callDesigner('updatecorelogindetails', ...)
        const designerUrl = process.env.DESIGNER_URL || ''
        if (!designerUrl) {
            logError('DESIGNER_URL not configured for session DB update').catch(() => {})
            return { status: false, errorMsg: 'Designer URL not configured' }
        }
        
        const response = await fetch(`${designerUrl}/api/updatecorelogindetails`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        })
        
        const result = await response.json()
        
        if (result.status === 'SUCCESS' || result.Status === 'Success') {
            logInfo(`Session stored in DB (orgId: ${orgId}, userId: ${userId})`).catch(() => {})
            return { status: true }
        } else {
            return { status: false, errorMsg: result.errorMsg || result.Message }
        }
    } catch (error) {
        logError(`Failed to store session in DB: ${error instanceof Error ? error.message : String(error)}`, error).catch(() => {})
        return { status: false, errorMsg: error instanceof Error ? error.message : String(error) }
    }
}
```

---

#### [MODIFY] [session-handler.controller.ts](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/kodivian/packages/server/src/controllers/session-handler.controller.ts)

**Complete rewrite of createSession method to use SABID and store in DB:**

```typescript
import { Request, Response } from 'express'
import { OrganizationConfigService } from '../services/org-config.service'
import { SessionService } from '../services/session.service'
import { KodivianSessionService } from '../services/kodivian-session.service'
import { updateSessionInDB } from '../services/session-db.service'
import { getSABIDCookieOptions } from '../utils/cookie'
import { logInfo, logWarn, logError, logDebug } from '../utils/logger/system-helper'
const SimpleCrypto = require('simple-crypto-js').default

export class SessionHandlerController {
    private simpleCrypto: any

    constructor(
        private orgConfigService: OrganizationConfigService,
        private sessionService: SessionService,
        private kodivianSessionService: KodivianSessionService
    ) {
        this.simpleCrypto = new SimpleCrypto(process.env.SIMPLE_CRYPTO_KEY || '$mrT@pP-6!dr')
    }

    /**
     * Create session from main server
     * GET /api/v1/sessionhandler?params={base64({orgId, kodivianSessionId})}
     */
    async createSession(req: Request, res: Response) {
        try {
            logInfo(`Session handler createSession called`).catch(() => {})

            // Parse params
            let params = req.query.params as string
            if (!params) {
                return res.status(400).json({ error: 'params parameter is required' })
            }

            if (params.startsWith('"') && params.endsWith('"')) {
                params = params.slice(1, -1)
            }

            let decodedParams: { orgId: string; kodivianSessionId: string }
            try {
                const decodedString = Buffer.from(params, 'base64').toString('utf-8')
                decodedParams = JSON.parse(decodedString)
            } catch (error) {
                return res.status(400).json({ error: 'Invalid base64 encoding' })
            }

            const orgId = decodedParams.orgId
            const kodivianSessionId = decodedParams.kodivianSessionId

            // Validate org
            if (!this.orgConfigService.hasOrg(parseInt(orgId))) {
                return res.status(400).json({ error: `Organization ${orgId} is not configured` })
            }

            // Check for existing SABID cookie (instead of AUTOID)
            const existingSABID = req.signedCookies?.SABID
            if (existingSABID) {
                // Parse orgId from SABID token
                const parsedOrgId = KodivianSessionService.parseOrgIdFromSABID(existingSABID)
                if (parsedOrgId === orgId) {
                    const existingSession = await this.kodivianSessionService.validateSABIDSession(existingSABID, orgId)
                    if (existingSession) {
                        // Extend TTL and redirect
                        await this.kodivianSessionService.extendSABIDSession(existingSABID, orgId)
                        
                        const proxyUrl = process.env.PROXY_URL || ''
                        const contextPath = this.orgConfigService.getContextPath(parseInt(orgId)) || '/kodivian'
                        const cleanContextPath = contextPath.startsWith('/') ? contextPath.substring(1) : contextPath
                        const homePageUrl = `${proxyUrl}/${cleanContextPath}`
                        
                        return res.redirect(homePageUrl)
                    }
                }
                // Clear invalid SABID cookie
                res.clearCookie('SABID', { path: '/' })
            }

            // Validate kodivianSessionId and fetch user data
            let userData: any
            try {
                userData = await this.sessionService.validateKodivianSession(orgId, kodivianSessionId)
            } catch (sessionError) {
                return res.status(500).json({ error: `Failed to validate session` })
            }

            const formattedUserData = this.sessionService.getUserDataForLocalStorage(userData)

            // CREATE SABID session (same format as Deployment Server)
            let sabidToken: string
            try {
                sabidToken = await this.kodivianSessionService.createSABIDSession(
                    kodivianSessionId,
                    formattedUserData.userId,
                    orgId,
                    userData
                )
            } catch (error) {
                return res.status(500).json({ error: `Failed to create session` })
            }

            // STORE SESSION IN DB (matching Deployment Server)
            const dbResult = await updateSessionInDB(
                kodivianSessionId,
                sabidToken,
                formattedUserData.userId,
                orgId,
                'ACTIVE'
            )
            
            if (!dbResult.status) {
                logWarn(`Failed to store session in DB: ${dbResult.errorMsg}`).catch(() => {})
                // Don't fail the request - session is still valid in Redis
            }

            // Prepare localStorage data
            const proxyUrl = process.env.PROXY_URL || ''
            const contextPath = this.orgConfigService.getContextPath(parseInt(orgId)) || '/kodivian'
            const cleanContextPath = contextPath.startsWith('/') ? contextPath.substring(1) : contextPath
            const baseUrl = `${proxyUrl}/${cleanContextPath}/api/v1`

            const kodivianStore = {
                sessionId: sabidToken,
                baseUrl: baseUrl,
                orgId: orgId,
                userId: formattedUserData.userId,
                userName: formattedUserData.userName,
                email: formattedUserData.email
            }

            const encryptionResult = {
                kodivianStore: JSON.stringify(this.simpleCrypto.encryptObject(kodivianStore))
            }

            // SET SABID COOKIE (same format as Deployment Server)
            const exTime = parseInt(process.env.SESSION_COOKIE_MAX_AGE || '900') * 1000
            res.cookie('SABID', sabidToken, getSABIDCookieOptions(exTime))

            // Generate redirect HTML
            const homePageUrl = `${proxyUrl}/${cleanContextPath}`
            const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8' />
    <title>Setting up your session...</title>
</head>
<body>
    <div style="text-align:center;padding:50px;">
        <p>Setting up your session...</p>
    </div>
    <script>
        try {
            localStorage.setItem('kodivianStore', '${encryptionResult.kodivianStore.replace(/'/g, "\\'")}');
            window.location.href = '${homePageUrl}';
        } catch (error) {
            console.error('Error setting up localStorage:', error);
        }
    </script>
</body>
</html>`

            return res.type('text/html').send(htmlContent)
        } catch (error) {
            logError(`Session creation failed: ${error instanceof Error ? error.message : String(error)}`, error).catch(() => {})
            return res.status(500).json({ error: 'Failed to create session' })
        }
    }

    /**
     * Check session validity
     */
    async checkSession(req: Request, res: Response) {
        try {
            const sabidToken = req.signedCookies?.SABID

            if (!sabidToken) {
                return res.json({ valid: false, message: 'No session cookie found' })
            }

            const orgId = KodivianSessionService.parseOrgIdFromSABID(sabidToken)
            if (!orgId) {
                return res.json({ valid: false, message: 'Invalid token format' })
            }

            const sessionData = await this.kodivianSessionService.validateSABIDSession(sabidToken, orgId)

            if (sessionData) {
                await this.kodivianSessionService.extendSABIDSession(sabidToken, orgId)
                return res.json({ valid: true, message: 'Session is valid', orgId })
            } else {
                return res.json({ valid: false, message: 'Session expired' })
            }
        } catch (error) {
            return res.json({ valid: false, message: 'Session validation error' })
        }
    }
}
```

---

#### [MODIFY] [session-validation.middleware.ts](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/kodivian/packages/server/src/middlewares/session-validation.middleware.ts)

**Update to use SABID cookie instead of AUTOID:**

```typescript
import { Request, Response, NextFunction } from 'express'
import { KodivianSessionService } from '../services/kodivian-session.service'
import { OrganizationConfigService } from '../services/org-config.service'
import { getSABIDCookieOptions } from '../utils/cookie'
import { logError, logWarn } from '../utils/logger/system-helper'

export interface AuthenticatedRequest extends Omit<Request, 'user'> {
    user?: {
        userId: string
        userName: string
        email: string
        orgId: string
    }
    orgId?: string
    userId?: string
    sessionType?: string
}

export function createSessionValidationMiddleware(
    kodivianSessionService: KodivianSessionService,
    orgConfigService: OrganizationConfigService
) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            // Read SABID cookie (instead of AUTOID)
            const sabidToken = req.signedCookies?.SABID

            if (!sabidToken) {
                return res.status(401).json({ error: 'Session Expired' })
            }

            // Parse orgId from SABID token
            // Format: {sessionId}$${kodivianSessionId}$${userId}$$Sails{orgId}
            const orgId = KodivianSessionService.parseOrgIdFromSABID(sabidToken)
            
            if (!orgId) {
                return res.status(401).json({ error: 'Invalid token format' })
            }

            // Validate session
            const session = await kodivianSessionService.validateSABIDSession(sabidToken, orgId)

            if (!session) {
                logWarn(`SABID session not found or expired`).catch(() => {})
                return res.status(401).json({ error: 'Session expired' })
            }

            // Extend session TTL and refresh cookie
            try {
                const extended = await kodivianSessionService.extendSABIDSession(sabidToken, orgId)
                if (extended) {
                    const exTime = parseInt(process.env.SESSION_COOKIE_MAX_AGE || '900') * 1000
                    res.cookie('SABID', sabidToken, getSABIDCookieOptions(exTime))
                }
            } catch (extensionError) {
                // Don't fail request - session is still valid
            }

            // Attach user info to request
            const parsedToken = KodivianSessionService.parseSABIDToken(sabidToken)
            req.user = {
                userId: parsedToken?.userId || session.userId || '',
                userName: session.UserInfoDetails?.UserInfo?.personalInfo?.userName || '',
                email: session.UserInfoDetails?.UserInfo?.personalInfo?.email || '',
                orgId: orgId
            }
            req.orgId = orgId
            req.userId = parsedToken?.userId || session.userId
            req.sessionType = 'SABID'

            // Validate orgId in request body
            if (req.body && req.body.orgId && req.body.orgId !== orgId) {
                return res.status(403).json({ error: 'Organization ID mismatch' })
            }

            // Ensure orgId is set
            if (req.body && typeof req.body === 'object') {
                req.body.orgId = orgId
            }
            if (req.method === 'GET' && req.query) {
                req.query.orgId = orgId
            }

            next()
        } catch (error) {
            logError(`Session authentication error: ${error instanceof Error ? error.message : String(error)}`, error).catch(() => {})
            return res.status(401).json({ error: 'Session Expired' })
        }
    }
}
```

---

### No Changes Required

| Component | Reason |
|-----------|--------|
| **Builder Server** | Uses temporary Sails cookie, not shared |
| **Java Platform** | Session creation unchanged |
| **Redis key format** | Follows Deployment Server format |

---

## Verification Plan

### Manual Verification

**Test 1: Deployment Server Cookie Path**
1. Clear cookies → Login via Deployment Server
2. **Verify**: SABID cookie has `Path: /`

**Test 2: Deployment First → Kodivian**
1. Login via Deployment Server
2. Navigate to Kodivian Server
3. **Verify**: Same SABID cookie used, no new cookie created

**Test 3: Kodivian First → Deployment**
1. Clear cookies → Navigate to Kodivian Server
2. **Verify**: SABID cookie created with `Path: /`
3. Navigate to Deployment Server app
4. **Verify**: Same SABID cookie works

**Test 4: Session in DB**
1. Create session via Kodivian Server
2. Check `cor_login_details` table
3. **Verify**: Session record exists with `sessionType: NODEJS`

**Test 5: Session Sync**
1. Login → Wait 10 min active in Kodivian
2. **Verify**: Session not expired in either server

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| [AuthController.js](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/browserapp/api/controllers/AuthController.js) | MODIFY | Change path from `/apps` to `/` (5 locations) |
| [AuthCheck.js](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/browserapp/api/policies/AuthCheck.js) | MODIFY | Change path from `/apps` to `/` |
| [session.js](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/browserapp/config/session.js) | MODIFY | Change path from `/apps` to `/` |
| [cookie.ts](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/kodivian/packages/server/src/utils/cookie.ts) | MODIFY | Add COOKIE_SECRET and getSABIDCookieOptions |
| [index.ts](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/kodivian/packages/server/src/index.ts) | MODIFY | Configure cookie-parser with secret |
| [kodivian-session.service.ts](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/kodivian/packages/server/src/services/kodivian-session.service.ts) | MODIFY | Add SABID methods (create, validate, extend, parse) |
| `session-db.service.ts` | NEW | Store session in DB via Designer |
| [session-handler.controller.ts](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/kodivian/packages/server/src/controllers/session-handler.controller.ts) | MODIFY | Use SABID instead of AUTOID, store in DB |
| [session-validation.middleware.ts](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/kodivian/packages/server/src/middlewares/session-validation.middleware.ts) | MODIFY | Use SABID instead of AUTOID |
