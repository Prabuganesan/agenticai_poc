**📄 ChainSys Platform – Session Architecture & Kodivian Integration**

## **1\. ChainSys Platform – High-Level Overview**

**ChainSys Platform consists of multiple enterprise products.**  
**Most products are built using Java, except SmartAppBuilder (SAB) which uses Node.js.**

**A central Java-based platform manages:**

* **User authentication**  
* **Organization access**  
* **Primary session lifecycle**

**All products rely on this platform session for trust and access control.**

---

## **2\. Existing Platform Session Architecture**

### **2.1 Platform Login (Java)**

* **User logs in via ChainSys Platform (Java).**  
* **A Tomcat session is created.**  
* **Session ID is stored in:**  
  * **PostgreSQL `login_session` table**  
* **Session validity:**  
  * **15 minutes**  
  * **Extendable on activity**

**This Java session is the root identity session across the platform.**

---

## **3\. SmartAppBuilder (SAB) Architecture**

**SmartAppBuilder consists of two Node.js servers:**

### **3.1 AppBuilder Server**

* **Node.js \+ Angular**  
* **Used for:**  
  * **App design**  
  * **Object & layout configuration**  
  * **Monitoring dashboards**  
  * **Deployment configuration**  
* **Has its own frontend**

  ### **3.2 Deployment Server**

* **Node.js runtime server**  
* **Hosts generated Angular applications**  
* **Each app is accessed via URL like:**  
  **https://dev.kodivian.com/apps/pfm\_apps/{orgId}/{appId}/index.html**  
* 

**Deployment servers can be:**

* **Single shared server**  
* **Multiple org-wise servers (optional)**  
  * **Example:**  
    * **`/apps` for Org A**  
    * **`/test` for Org B**

  ---

  ## **4\. Session Flow – AppBuilder Access**

  ### **Flow:**

1. **User is logged in to ChainSys Platform (Java).**  
2. **User clicks SmartAppBuilder.**  
3. **Platform passes:**  
   * **`javaSessionId`**  
   * **`orgId`**  
4. **AppBuilder:**  
   * **Validates `javaSessionId` against `login_session` table**  
   * **Creates a temporary Sails session cookie**  
   * **Allows access to AppBuilder UI**

   ### **Notes:**

* **AppBuilder session is derived from Java session**  
* **Java session remains the source of truth**  
  ---

  ## **5\. Session Flow – Deployment Server Access**

  ### **Flow:**

1. **User clicks a generated app from Platform or AppBuilder.**  
2. **Platform sends:**  
   * **`javaSessionId`**  
   * **`orgId`**  
   * **`appId`**  
3. **Deployment Server:**  
   * **Validates Java session**  
   * **Creates a Redis-based session**  
* **Sets cookie scoped to the app’s context path**  
  **/apps/pfm\_apps/{orgId}/{appId}**  
  *   
  * **Updates `login_session` table (secondary column)**

  ### **Runtime Behavior:**

* **All page navigations:**  
  * **Validate Redis session**  
  * **Extend Redis TTL**  
* **Default TTL: 15 minutes**  
  ---

  ## **6\. Session Synchronization Logic (Current)**

**There are three session layers:**

| Layer | Storage | Purpose |
| ----- | ----- | ----- |
| **Java Platform Session** | **PostgreSQL** | **Primary identity** |
| **AppBuilder Session** | **Sails cookie** | **Admin & builder UI** |
| **Deployment App Session** | **Redis** | **Runtime app usage** |

### **Sync Rule:**

* **If Deployment session is active, Java session is auto-extended**  
* **If Java session expires, deployment session will eventually expire**  
* **This keeps user logged in seamlessly across products**  
  ---

  ## **7\. Kodivian Server Introduction**

  ### **7.1 Kodivian Server Characteristics**

* **Node.js based**  
* **Deployed once per environment**  
* **Shared across all organizations**  
* **Accessed via:**  
  **/kodivian**  
*   
  ---

  ## **8\. Kodivian Session Handling (Current)**

  ### **Access Flow:**

1. **User logs in to ChainSys Platform**  
2. **User enters AppBuilder**  
3. **User clicks Kodivian**  
4. **AppBuilder redirects to Kodivian with:**  
   * **`javaSessionId`**  
   * **`orgId`**  
5. **Kodivian Server:**  
   * **Validates Java session**  
   * **Creates Redis-based Kodivian session**  
* **Sets cookie at root path:**  
  **/**  
  *   
  * **Opens Kodivian frontend**

  ### **Session Properties:**

* **TTL: 15 minutes**  
* **Auto-extended on activity**  
* **Stored in Redis**  
* **❌ Not stored in `login_session` table**  
  ---

  ## **9\. Kodivian API Access Model**

**Kodivian supports API-based usage in addition to UI.**

### **API Key Support**

* **Users can generate Kodivian API Keys**  
* **API keys are:**  
  * **Org-scoped**  
  * **Used for non-browser access**

  ---

  ## **10\. Planned Kodivian Access Scenarios**

  ### **10.1 API Access**

| Source | Available Identity |
| ----- | ----- |
| **Other ChainSys Products** | **userId, orgId, javaSessionId, API key** |
| **Dynamic Angular Apps (Deployment Server)** | **userId, orgId, Redis session, API key** |
| **Third-party tools (n8n)** | **API key, UPN** |

  ---

  ### **10.2 Embedded Chat Access (Planned)**

**From generated Angular apps:**

* **Embed:**  
  * **Agent**  
  * **Multi-agent**  
  * **Assistant**

**Auth to be finalized**

**11.Source location**

**Builder server** \- /app\_v17\_builder  
**Deployment server** \- /app\_v17\_builder/inputs/browserapp/  
**Kodivian server** \- /app\_v17\_builder/inputs/kodivian/

**Session change plan**  
---

## **✅ Goal** 

* **One Java session** → `KodivianSessionid`  
* **One Redis session** → `SABID`  
* `SABID` shared by:  
  * Deployment Server (`/apps/...`)  
  * Kodivian Server (`/kodivian`)  
* Builder server remains unchanged  
* `SABID` **stored in DB**  
* Cookie accessible across context paths

---

## **🔑 Key Constraint**

Cookies set with path `/apps` ❌ **are NOT accessible** to `/kodivian`

So we **must move `SABID` cookie to root path `/`**

---

## **✅ Required Changes (Action Points Only)**

### **1️⃣ Change SABID Cookie Path**

**Current**

Set-Cookie: SABID=xyz; Path=/apps;

**Change to**

Set-Cookie: SABID=xyz; Path=/;

✅ This makes the cookie available to:

* `/apps/*`  
* `/kodivian/*`

---

### **2️⃣ Deployment Server Changes**

* When creating `SABID`:  
  * Set cookie with `Path=/`  
  * Keep cookie name as `SABID` (no rename)  
* Continue:  
  * Storing `SABID` in Redis  
  * Storing `SABID` in **login session table**  
* No change to:  
  * App routing  
  * Redis TTL handling

---

### **3️⃣ Kodivian Server Changes**

* Stop creating a **separate kodivian-only cookie**  
* Read existing `SABID` cookie from request  
* Validate `SABID` in Redis  
* Extend Redis TTL on every request  
* Do **NOT** store session again in DB  
* Map session data using:  
  * `orgId`  
  * `userId`  
  * `KodivianSessionid` (if needed)

---

### **4️⃣ Java Platform Changes** 

* **No change to session creation**

---

### **5️⃣ Builder Server**

✅ **No changes**

* Continues using temporary Sails cookie  
* Not stored in DB (as-is)

---

### **6️⃣ Session Sync Logic (Important)**

* Redis TTL \= 15 mins  
* Java session TTL \= 15 mins

**Keep existing behavior:**

* If Redis session active → extend Java session  
* If Java session active → allow Redis renewal

No new logic required.

---

### **7️⃣ Multi-Deployment Server Support**

Because cookie path is `/`:

* Works even if deployment servers use:  
  * `/apps`  
  * `/test`  
  * `/apps2`  
* Kodivian always uses `/kodivian`  
* **Single SABID works everywhere**

---

## **🧠 Final Architecture (Simple View)**

Java Platform  
  └── KodivianSessionid (Tomcat \+ DB)

Deployment Server  
  └── SABID (Redis \+ DB, Path=/)

Kodivian Server  
  └── Uses same SABID (Redis only)

Builder Server  
  └── Temporary cookie (unchanged)

