# Smart App Builder (SAB) + Flowise Integration Architecture

## Table of Contents
1. Executive Summary
2. System Overview
3. Architecture Diagram
4. Data Flow - Detailed Request Journey
5. Technology Stack
6. Flowise Tools Specification
7. Token Usage Tracking
8. Use Cases Enabled (4 Phases)
9. 10 Detailed ERP Use Cases
10. Implementation Roadmap
11. Expected Business Impact
12. Security Considerations
13. Configuration Checklist
14. API Contract
15. Monitoring & Troubleshooting
16. Conclusion

---

## 1. Executive Summary

Smart App Builder (SAB) is a low-code, AI-assisted autonomous web application development platform. Flowise is integrated as the **AI orchestration and tool execution engine**, enabling SAB users to build dynamic business applications with AI-powered workflows.

**Key Architecture Decision:**
- **Your Server**: Handles user authentication + LLM usage tracking
- **Flowise**: Executes all tools, LLM calls, workflows, job queues
- **Division**: Clean separation enables scalability and security

**Expected Outcomes:**
- 5,000+ hours of manual work eliminated annually
- $1.2M cost savings
- $1.92M revenue increase
- Complete audit trail and compliance ready

---

## 2. System Overview

### 2.1 Core Components

**Smart App Builder (SAB)**
- Low-code platform for building enterprise applications
- Users create custom objects, layouts, and workflows visually
- Metadata-driven architecture (Java backend, Node.js generator, Angular frontend)
- Multi-tenant capable

**Flowise**
- AI-powered tool execution and orchestration engine
- Manages job queues (Redis), chat contexts, and tool chains
- Provides LLM integrations, data connectors, and workflow orchestration
- Returns usage metrics (tokens consumed, execution time, etc.)

**Your Orchestration Server (Node.js Backend)**
- Lightweight authentication and authorization layer
- LLM usage tracking and billing
- Request routing to Flowise
- Audit logging

### 2.2 Data Sources

- **CouchDB**: User business data (custom objects)
- **Milvus**: Vector embeddings for semantic search
- **Redis**: Flowise job queue and caching
- **PostgreSQL**: SAB metadata, usage tracking, audit logs

---

## 3. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    SAB UI (Angular 17)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Entry Form   │  │ View Detail  │  │ List View    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────────────────────────────────────────┐        │
│  │  AI-Powered NLQ Chat Widget (Optional)          │        │
│  └──────────────────────────────────────────────────┘        │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/REST
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         Your Orchestration Server (Node.js)                  │
│  ┌──────────────────────────────────────────────────┐        │
│  │  1. User Authentication & Authorization          │        │
│  │  2. Token Usage Tracking                         │        │
│  │  3. Request Validation & Routing                 │        │
│  │  4. Audit Logging                               │        │
│  └──────────────────────────────────────────────────┘        │
└────────────────────┬────────────────────────────────────────┘
                     │ API Call
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Flowise (Tool Execution Engine)                 │
│  ┌──────────────────────────────────────────────────┐        │
│  │  Queue Management (Redis)                        │        │
│  │  Job Processing & Async Execution               │        │
│  │  Chat Context Storage (Built-in)                │        │
│  └──────────────────────────────────────────────────┘        │
│  ┌──────────────────────────────────────────────────┐        │
│  │              Flowise Tools                        │        │
│  ├──────────────┬──────────────┬───────────────────┤        │
│  │ Data Tools   │ LLM Tools    │ Integration Tools │        │
│  ├──────────────┼──────────────┼───────────────────┤        │
│  │ CouchDB      │ OpenAI       │ Email Sender      │        │
│  │ Milvus       │ Claude       │ Webhook Caller    │        │
│  │ Query        │ Embedding    │ API Connector     │        │
│  │ Aggregation  │ Text Gen     │ Custom Tools      │        │
│  └──────────────┴──────────────┴───────────────────┘        │
└────────────────────┬────────────────────────────────────────┘
                     │ Response: {result, tokens_used, metadata}
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         Your Orchestration Server (Post-Processing)          │
│  ├─ Log Token Usage to PostgreSQL                           │
│  ├─ Calculate Costs & Update Quotas                         │
│  └─ Return Response to UI                                   │
└────────────────────┬────────────────────────────────────────┘
                     │ Response
                     ▼
                  Angular UI
```

---

## 4. Data Flow - Detailed Request Journey

### 4.1 User Creates Custom Object & Workflow

**Step 1: Design Phase (In SAB UI)**
- User creates custom object: "PurchaseOrder"
- Defines fields: vendor_id, amount, status, approval_required
- Creates layout: Entry form for PO creation
- Designs workflow: "Auto-approve POs under $1000, send email for approval"
- SAB stores metadata in PostgreSQL

### 4.2 User Interacts with Generated App

**Step 2: User Action**
- User opens generated PurchaseOrder form in Angular UI
- Enters PO details
- Asks: "Show me all pending POs for Vendor ABC and their total amount"

### 4.3 Request Flow

```
USER INPUT (NLQ Query)
         │
         ▼
┌─────────────────────────────────────────┐
│ Your Server: Authentication             │
│ ├─ Extract JWT token from request       │
│ ├─ Validate token signature             │
│ ├─ Get user_id, org_id, permissions     │
│ └─ Check if user has access to this app │
└────────────────┬────────────────────────┘
                 │ ✓ Authenticated
                 ▼
┌─────────────────────────────────────────┐
│ Your Server: Pre-Processing             │
│ ├─ Check LLM quota (tokens available)   │
│ ├─ Get user's LLM tier/limits           │
│ ├─ Log request start: timestamp, user   │
│ └─ Generate request_id for tracking     │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ Flowise API Call                        │
│ POST /api/chat                          │
│ {                                       │
│   "sessionId": "user_123_session_456",  │
│   "chatInput": "Show pending POs...",   │
│   "userId": "user_123",                 │
│   "appId": "purchase_order_app"         │
│ }                                       │
└────────────────┬────────────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │  Flowise Queue     │
        │  (Redis)           │
        │  ├─ Add job        │
        │  └─ Assign worker  │
        └────────┬───────────┘
                 │
                 ▼
        ┌────────────────────────────────┐
        │ Flowise Worker Processing      │
        │                                │
        │ 1. NLQ Parser Tool             │
        │    ├─ Parse: "pending POs"     │
        │    ├─ Extract: vendor="ABC"    │
        │    └─ Call LLM for intent      │
        │                                │
        │ 2. CouchDB Connector Tool      │
        │    ├─ Query PO objects         │
        │    ├─ Filter: vendor="ABC"     │
        │    ├─ Filter: status="pending" │
        │    └─ Return: [PO1, PO2, PO3]  │
        │                                │
        │ 3. Aggregation Tool            │
        │    ├─ Sum amounts              │
        │    └─ Format results           │
        │                                │
        │ 4. LLM Text Generation Tool    │
        │    ├─ Create human-readable    │
        │    │  response                 │
        │    └─ Return formatted text    │
        │                                │
        │ Total Tokens Used: 1,245       │
        └────────────┬───────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│ Flowise Returns Response                            │
│ {                                                   │
│   "message": "Found 3 pending POs for Vendor ABC...",
│   "data": [{po_id, amount, date}, ...],             │
│   "tokens_used": 1245,                              │
│   "model": "gpt-4",                                 │
│   "execution_time_ms": 2345,                        │
│   "cost": 0.0374  # calculated by Flowise          │
│ }                                                   │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ Your Server: Post-Processing            │
│ ├─ Extract tokens_used: 1245            │
│ ├─ Extract cost: $0.0374                │
│ ├─ Get user's rate: $0.002/token        │
│ ├─ Insert into PostgreSQL:              │
│ │  {                                    │
│ │    request_id,                        │
│ │    user_id,                           │
│ │    org_id,                            │
│ │    tokens_used: 1245,                 │
│ │    cost: 0.0374,                      │
│ │    model: "gpt-4",                    │
│ │    timestamp,                         │
│ │    status: "success"                  │
│ │  }                                    │
│ ├─ Update user quota: remaining -= 1245 │
│ ├─ Check if quota exceeded              │
│ └─ Format response for Angular          │
└────────────────┬────────────────────────┘
                 │
                 ▼
         Angular UI displays
         response to user
```

---

## 5. Technology Stack

### 5.1 Your Orchestration Server (Node.js)

**Responsibilities:**
- Express.js for API endpoints
- JWT authentication/authorization
- PostgreSQL for usage tracking
- Axios/Fetch for Flowise API calls

**Key Endpoints:**
```
POST /api/chat              # Send query to Flowise
GET  /api/usage             # Get token usage stats
GET  /api/quota             # Check remaining quota
POST /api/apps              # List user's apps
POST /api/apps/:id/interact # Interact with specific app
```

### 5.2 Flowise Configuration

**Environment Setup (.env):**
```
PORT=3001
MODE=queue
QUEUE_NAME=flowise-queue
QUEUE_REDIS_EVENT_STREAM_MAX_LEN=100000
WORKER_CONCURRENCY=100

REDIS_HOST=localhost
REDIS_PORT=6379

DATABASE_TYPE=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=flowise
DATABASE_USER=flowise_user
DATABASE_PASSWORD=secure_password

STORAGE_TYPE=local
BLOB_STORAGE_PATH=/flowise/storage
```

### 5.3 Data Layer

**PostgreSQL:**
- SAB metadata (objects, layouts, workflows)
- LLM usage tracking
- User quotas and billing
- Audit logs

**CouchDB:**
- User business data (custom objects)
- Flowise chat history (optional backup)

**Milvus:**
- Vector embeddings for semantic search
- NLQ query embeddings

**Redis:**
- Flowise job queue
- Session management
- Cache layer

---

## 6. Flowise Tools Specification

### 6.1 Core Tools Required

#### Tool 1: CouchDB Connector
**Purpose:** Query user's custom objects from CouchDB

**Input:**
```json
{
  "database": "erp_db",
  "docType": "PurchaseOrder",
  "query": {vendor_id: "ABC", status: "pending"},
  "limit": 100
}
```

**Output:**
```json
{
  "documents": [...],
  "count": 3,
  "execution_time_ms": 234
}
```

#### Tool 2: Milvus Embedding & Search
**Purpose:** Semantic search across user data

**Input:**
```json
{
  "collection": "po_embeddings",
  "queryEmbedding": [0.234, 0.456, ...],
  "topK": 10
}
```

**Output:**
```json
{
  "results": [{id, score, text}, ...],
  "execution_time_ms": 145
}
```

#### Tool 3: Data Aggregation
**Purpose:** Sum, group, calculate metrics

**Input:**
```json
{
  "data": [...PO objects...],
  "operation": "sum",
  "field": "amount"
}
```

**Output:**
```json
{
  "result": 45000,
  "details": {...}
}
```

#### Tool 4: LLM (OpenAI/Claude)
**Purpose:** Parse NLQ, generate responses

**Input:**
```json
{
  "model": "gpt-4",
  "prompt": "Summarize this data: ...",
  "temperature": 0.7
}
```

**Output:**
```json
{
  "text": "3 pending POs totaling $45,000...",
  "tokens_used": 245,
  "finish_reason": "stop"
}
```

#### Tool 5: Email Notification
**Purpose:** Send approval requests, notifications

**Input:**
```json
{
  "to": "approver@company.com",
  "subject": "PO Approval Required",
  "template": "po_approval",
  "data": {...}
}
```

**Output:**
```json
{
  "status": "sent",
  "message_id": "msg_123"
}
```

#### Tool 6: Webhook Caller
**Purpose:** Call external systems/APIs

**Input:**
```json
{
  "url": "https://inventory.api/update",
  "method": "POST",
  "headers": {...},
  "body": {...}
}
```

**Output:**
```json
{
  "status": 200,
  "response": {...}
}
```

---

## 7. Token Usage Tracking

### 7.1 Tracking Flow

```
Request arrives at Your Server
    │
    ├─ Record: request_id, user_id, start_time
    │
    ▼
Call Flowise
    │
    ▼
Flowise returns: {result, tokens_used, model, cost}
    │
    ├─ tokens_used: 1245
    ├─ model: "gpt-4"
    ├─ cost: $0.0374
    │
    ▼
Your Server processes response
    │
    ├─ Calculate total_cost = tokens_used * rate_per_token
    ├─ Check if user quota exceeded
    ├─ Update user.remaining_quota -= tokens_used
    ├─ Insert into llm_usage table
    │
    ▼
Return response to Angular UI
```

### 7.2 PostgreSQL Schema for Tracking

```sql
CREATE TABLE llm_usage (
    id UUID PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    org_id VARCHAR(255) NOT NULL,
    request_id VARCHAR(255) UNIQUE,
    tokens_used INTEGER NOT NULL,
    cost DECIMAL(10, 4),
    model VARCHAR(100),
    feature VARCHAR(100),
    app_id VARCHAR(255),
    status VARCHAR(20),
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user_id (user_id),
    INDEX idx_org_id (org_id),
    INDEX idx_created_at (created_at)
);

CREATE TABLE user_quotas (
    user_id VARCHAR(255) PRIMARY KEY,
    org_id VARCHAR(255),
    monthly_quota INTEGER,
    remaining_quota INTEGER,
    reset_date DATE,
    updated_at TIMESTAMP
);
```

---

## 8. Use Cases Enabled (4 Phases)

### Phase 1: NLQ Chat (Foundation)
**Feature:** Users ask questions about their data in natural language

**Flow:**
1. User types: "Show pending POs for Vendor ABC"
2. Flowise: Parse NLQ → Query CouchDB → Aggregate → Format response
3. Your Server: Track tokens used
4. Result: Natural language response with data

### Phase 2: Dynamic Data Visualization
**Feature:** Generate insights and dashboards automatically

**Example:** "Show sales trend for Q4 by region"
- CouchDB: Query sales records
- Aggregation: Group by region, calculate totals
- Format: Return data suitable for charts
- Display: Angular renders charts

### Phase 3: Autonomous Workflows
**Feature:** AI-powered business process automation

**Examples:**
- Auto-Approval Workflow
- Intelligent Inventory Management
- Invoice Reconciliation
- Supply Chain Coordination

### Phase 4: Custom Business Tools
**Feature:** Users/admins create domain-specific Flowise tools

**Examples:**
- Custom API connectors
- Industry-specific calculations
- Third-party integrations
- Custom validations

---

## 9. 10 Detailed ERP Use Cases

### Use Case 1: Intelligent Purchase Order (PO) Workflow

**Scenario:** Automate PO creation with vendor selection, budget validation, and approval routing

**CouchDB Objects:** PurchaseOrder, Vendor, InventoryItem, BudgetAllocation

**Workflow Steps:**

```
1. NLQ Input: "Create PO for 100 units of Item X from best vendor"
   ↓
2. Parse Intent (LLM)
   ├─ Extract: quantity=100, item=X
   ├─ Intent: "create_po"
   └─ Confidence: 0.95
   ↓
3. Query Tools
   ├─ Get Item X details (price, lead_time)
   ├─ Get all vendors for Item X (ratings, prices)
   ├─ Get current inventory
   └─ Get budget allocation
   ↓
4. Vendor Selection (LLM + Logic)
   ├─ Analyze: rating, price, payment_terms, lead_time
   ├─ Decision: "Vendor2 offers best value"
   ├─ Calculate: Total cost = 100 × $250 = $25,000
   └─ Return: Selected vendor_id
   ↓
5. Validation
   ├─ Check: Budget remaining = $50,000 - $42,000 = $8,000 < $25,000
   ├─ Status: REQUIRES_APPROVAL
   └─ Alert: "Amount exceeds budget"
   ↓
6. Generate PO & Route Approval
   ├─ Create PO in CouchDB
   ├─ Status: "pending_approval"
   ├─ Generate email notification
   └─ Return: PO_ID=PO_2024_001
   ↓
7. Response
   └─ "PO created (ID: PO_2024_001) for Vendor2.
       Amount: $25,000 requires manager approval.
       Estimated delivery: 3 days"
```

**Tokens Used:** 2,340 | **Cost:** $0.0705 | **Time:** 3.45 seconds
**Time Saved:** 30 minutes → 10 seconds
**Benefits:** Cost optimization, faster sourcing, budget control

---

### Use Case 2: Invoice Reconciliation & Automated Dispute Resolution

**Scenario:** Match invoices against POs/receipts, detect discrepancies, auto-resolve simple issues

**CouchDB Objects:** Invoice, PurchaseOrder, GoodsReceipt, DiscrepancyLog, ApprovalQueue

**Workflow Steps:**

```
1. Invoice Upload & OCR (LLM)
   ├─ Extract: vendor, amount, items, date
   └─ Returns: Structured invoice data
   ↓
2. CouchDB Lookup
   ├─ Find matching PO
   ├─ Find goods receipt
   └─ Returns: Candidate matches
   ↓
3. Discrepancy Detection (Logic)
   ├─ Check 1: Amount match (tolerance: ±2%)
   ├─ Check 2: Item quantities
   ├─ Check 3: Dates
   └─ Check 4: Duplicate detection
   ↓
4. LLM Resolution
   ├─ IF all checks pass: AUTO_APPROVED
   ├─ IF minor variance: REVIEW_REQUIRED (2 hours SLA)
   └─ IF major discrepancy: INVESTIGATION_REQUIRED
   ↓
5. Route & Notify
   ├─ Create approval task
   ├─ Send notification email
   ├─ Log in DiscrepancyLog
   └─ Update invoice status
   ↓
6. Response
   └─ "Invoice matched to PO_2024_001.
       Minor discrepancy: Amount $100 over (2%).
       Auto-approved for payment with review flag."
```

**Tokens Used:** 1,850 | **Cost:** $0.0555 | **Time:** 2.1 seconds
**Time Saved:** 1 hour → 10 seconds
**Benefits:** 80% auto-approval, fraud prevention, faster cycles

---

### Use Case 3: Dynamic Inventory Optimization & Auto-Replenishment

**Scenario:** Monitor inventory, predict demand, calculate reorder points, auto-generate POs

**CouchDB Objects:** InventoryItem, SalesHistory, StockMovement, SupplierItem, Forecast

**Workflow Steps:**

```
1. Scheduled Job (Daily at 2 AM)
   ↓
2. Calculate Metrics
   ├─ Last 90 days sales history
   ├─ Average daily usage (ADU)
   ├─ Current stock level
   └─ Supplier lead time
   ↓
3. Demand Forecasting (LLM)
   ├─ Analyze seasonal trends
   ├─ Analyze growth patterns
   ├─ Predict next 30 days
   └─ Confidence: 0.87
   ↓
4. Calculate Reorder Point & Quantity
   ├─ Formula: (ADU × Lead Time) + Safety Stock
   ├─ Economic Order Quantity (EOQ)
   └─ Reorder Point: 16, Order Qty: 100
   ↓
5. Stock Level Check
   ├─ Current: 45 units, Reorder Point: 16
   ├─ Check: 45 > 16? YES
   └─ Schedule: Order on day 20
   ↓
6. Auto-Generate POs (If needed)
   ├─ Query: Find best supplier
   ├─ Create PO: 100 units
   └─ Notify: Warehouse + Procurement
   ↓
7. Response
   └─ "Optimization completed. 35 items checked.
       2 POs generated. Stockouts prevented: 3.
       Carrying cost reduction: 12%"
```

**Tokens Used:** 3,200 | **Cost:** $0.0960 | **Time:** 4.5 seconds
**Time Saved:** 4 hours → 3 minutes
**Benefits:** Stockout prevention, cost reduction, automation

---

### Use Case 4: Employee Expense Report Audit & Auto-Approval

**Scenario:** Process expense reports with AI validation, auto-approve compliant submissions, flag anomalies

**CouchDB Objects:** ExpenseReport, ExpenseItem, ExpensePolicy, EmployeeProfile, ApprovalHistory

**Workflow Steps:**

```
1. Expense Report Submission
   ↓
2. Receipt OCR & Extraction (LLM + Vision)
   ├─ Extract: Vendor, Amount, Date, Items
   ├─ Categorize: "Restaurant = Meal Allowance"
   └─ Returns: Structured data
   ↓
3. Policy Validation (Logic)
   ├─ Check 1: Category allowed?
   ├─ Check 2: Amount within limit?
   ├─ Check 3: Receipt required?
   ├─ Check 4: Multiple same category per day?
   ├─ Check 5: Frequency check
   └─ Check 6: Round number test (fraud detection)
   ↓
4. Anomaly Detection (ML + LLM)
   ├─ Check vs employee history
   ├─ Fraud pattern analysis
   └─ Risk score: 0.05 (Very low)
   ↓
5. Approval Decision (LLM + Rules)
   ├─ IF policies OK & anomaly < 0.1: AUTO_APPROVE
   ├─ ELSE IF minor variance: REVIEW_REQUIRED
   └─ ELSE: INVESTIGATION_REQUIRED
   ↓
6. Response
   └─ "Expense approved (ID: EXP_2024_5421).
       Amount: $510, Items: 8, Compliance: 100%.
       Reimbursement scheduled for 2 days."
```

**Tokens Used:** 1,560 | **Cost:** $0.0468 | **Time:** 1.8 seconds
**Time Saved:** 45 minutes → 8 seconds
**Benefits:** 85% auto-approval, fraud detection, reduced cycles

---

### Use Case 5: Intelligent Customer Credit Analysis & Dynamic Pricing

**Scenario:** Analyze creditworthiness, adjust limits, apply dynamic pricing based on payment history

**CouchDB Objects:** Customer, SalesOrder, PaymentHistory, PriceList, RiskProfile

**Workflow Steps:**

```
1. Customer Places Order
   ↓
2. Credit Analysis (LLM + Scoring)
   ├─ Calculate metrics:
   │  ├─ Order history: 150 orders
   │  ├─ Total spent: $500,000
   │  ├─ Payment delay: 2 days avg
   │  ├─ On-time rate: 98%
   │  ├─ Credit used: $45,000
   │  ├─ Credit limit: $50,000
   │  └─ Utilization: 90%
   │
   ├─ Risk Assessment (LLM)
   │  ├─ Payment history: 9/10 (Excellent)
   │  ├─ Utilization: 7/10 (High but OK)
   │  ├─ Order frequency: 9/10 (Regular)
   │  ├─ Industry health: 8/10 (Stable)
   │  └─ LLM: "Recommend limit increase to $75K"
   │
   └─ Credit Score: 8.6/10 (Excellent)
   ↓
3. Order Validation
   ├─ Order Amount: $15,000
   ├─ Available Credit: $5,000
   ├─ Check: Exceeds available
   └─ Decision: AUTO_APPROVE + INCREASE LIMIT
   ↓
4. Dynamic Pricing (LLM + Data)
   ├─ Base price: $1,000/unit
   ├─ Tier discount (volume): -5% = $950
   ├─ Loyalty discount: -2% = $931
   ├─ Order size bonus: $100 = $831/unit
   └─ Final: $831/unit (16.9% discount)
   ↓
5. Response
   └─ "Order approved (ID: SO_2024_6789).
       Amount: $15,000, Price: $831/unit (16.9% discount).
       Credit limit increased: $50K → $75K."
```

**Tokens Used:** 2,100 | **Cost:** $0.0630 | **Time:** 2.8 seconds
**Time Saved:** 1 hour → 15 seconds
**Benefits:** Automated credit, better pricing, revenue increase

---

### Use Case 6: Multi-Step Production Planning & Supply Chain Coordination

**Scenario:** Forecast sales, break down manufacturing, coordinate materials, schedule production

**CouchDB Objects:** SalesForecast, Product, BillOfMaterials, Component, WorkOrder, ProductionSchedule

**Workflow Steps:**

```
1. Monthly Forecast Planning
   ├─ Get forecast: 500 units needed in December
   └─ Lead time to delivery: 25 days
   ↓
2. Sales Forecast Analysis (LLM)
   ├─ Confidence: 0.92 (High)
   └─ Decision: Proceed with full planning
   ↓
3. Bill of Materials Explosion (Logic)
   ├─ Product needs for 500 units:
   │  ├─ Component A: 1,000 needed, Stock: 150, Short: 850
   │  ├─ Component B: 1,500 needed, Stock: 0, Short: 1,500
   │  └─ Component C: 500 needed, Stock: 600, Short: 0
   │
   └─ Procurement needs: A=900, B=1,600, C=0
   ↓
4. Supplier Lead Time Analysis
   ├─ Component A: 7 days lead time
   ├─ Component B: 10 days lead time
   ├─ Critical path: 13 days + 3 day buffer = 16 days
   ├─ Production: 12 days
   ├─ Assembly: 5 days
   ├─ Total: 30 days (vs 25 day target - CRITICAL)
   └─ Action: Expedite Component B
   ↓
5. Generate Procurement Orders
   ├─ PO_PROD_001: 900 units Component A ($5,400)
   ├─ PO_PROD_002: 1,600 units Component B - expedited ($10,200)
   └─ Total: $15,200
   ↓
6. Production Schedule
   ├─ Start: Day 13 (Nov 20)
   ├─ Duration: 12 days production
   ├─ QA: 5 days
   ├─ End: Day 30 (Dec 1)
   ├─ Capacity check: OK (41.7/50 units per day)
   └─ WorkOrder: WO_PROD_001 created
   ↓
7. Warehouse Coordination
   ├─ Notify warehouse: "Prepare for 500 units by Dec 1"
   ├─ Allocate storage space
   └─ Update inventory forecast
   ↓
8. Cost Summary & Risk Assessment
   ├─ Total cost: $15,900
   ├─ Risk score: 2.1/10 (LOW)
   └─ Recommendation: Proceed with confidence
   ↓
9. Response
   └─ "Production plan created. 500 units scheduled.
       2 POs generated ($15,200).
       Production: Nov 20 - Dec 1.
       Delivery: Dec 1 (On schedule).
       Risk: LOW."
```

**Tokens Used:** 2,650 | **Cost:** $0.0795 | **Time:** 3.2 seconds
**Time Saved:** 3 days → 5 minutes
**Benefits:** Forecast to production automation, capacity planning, on-time delivery

---

### Use Case 7: Automated Financial Close & Consolidation

**Scenario:** Month-end automation - collect GL balances, reconcile accounts, validate entries, generate reports

**CouchDB Objects:** GeneralLedger, JournalEntry, InterCompanyTransaction, BankReconciliation, ClosingChecklist

**Workflow Steps:**

```
1. Month-End Close Triggered (Last day of month)
   ↓
2. Pre-Close Validation (LLM + Logic)
   ├─ All GL entries reconciled?
   ├─ All inter-company transactions recorded?
   ├─ Bank reconciliation complete?
   ├─ Accruals recorded?
   └─ All approvals obtained?
   ↓
3. Collect GL Balances
   ├─ Query all GL accounts:
   │  ├─ Assets: $5,000,000
   │  ├─ Liabilities: $2,000,000
   │  ├─ Equity: $2,500,000
   │  ├─ Revenue: $1,500,000
   │  ├─ Expenses: $800,000
   │  └─ Transactions: 12,450 entries
   │
   ├─ Filter by status:
   │  ├─ Posted: 12,300 ✓
   │  ├─ Pending: 150 (Need to post)
   │  └─ Hold: 0
   │
   └─ Consolidated GL ready
   ↓
4. Inter-Company Reconciliation (LLM + Matching)
   ├─ Company A → B: $100,000 recorded in A, $100,000 in B ✓
   ├─ Company B → A: $50,000 in B, NOT in A ✗ (Post missing entry)
   ├─ Company A → C: $200,000 in A, $195,000 in C ✗ ($5K variance)
   │  └─ Analyze: Timing OK, likely fee → Create accrual
   │
   └─ All inter-company reconciled
   ↓
5. Bank Reconciliation (Logic)
   ├─ Bank statement: Closing $797,500
   ├─ GL Cash: Closing $800,000
   ├─ Variance: $2,500 (Bank fees not posted)
   ├─ Auto-post: DR Bank Fees / CR Cash
   ├─ Outstanding items identified and recorded
   └─ Status: RECONCILED
   ↓
6. Trial Balance Validation
   ├─ Total debits: $8,500,000
   ├─ Total credits: $8,500,000
   ├─ Check: BALANCED ✓
   ├─ Audit checks: All pass ✓
   └─ Trial balance: VALID
   ↓
7. Accrual Adjustments (LLM + Rules)
   ├─ Utilities accrual: $15,000
   ├─ Employee bonuses: $50,000
   ├─ Revenue recognition: $75,000
   ├─ Depreciation: $25,000
   ├─ Total accruals: $165,000
   └─ All posted to GL
   ↓
8. Debt/Equity Reconciliation
   ├─ Verify borrowings recorded: All OK ✓
   ├─ Equity reconciliation: Opening + NI - Dividends = Closing ✓
   └─ All verified
   ↓
9. Generate Reports
   ├─ Income Statement: Net Income $535,000
   ├─ Balance Sheet: Total $5,000,000 (balanced)
   ├─ Cash Flow Summary: Net change $350,000
   └─ Close Reconciliation Log: All systems green ✓
   ↓
10. Send for Approval
    ├─ Generate close package
    ├─ Send to CFO
    └─ Lock GL from further posting
    ↓
11. Response
    └─ "Financial close for November completed.
        12,450 GL entries processed.
        Inter-company reconciled.
        Bank reconciliation complete.
        Accruals posted: $165,000.
        Trial balance: BALANCED.
        Net Income: $535,000.
        Awaiting CFO approval."
```

**Tokens Used:** 3,450 | **Cost:** $0.1035 | **Time:** 4.2 seconds
**Time Saved:** 10 days → 4 minutes
**Benefits:** 100% accuracy, early reporting, zero manual errors

---

### Use Case 8: Supplier Performance Scoring & Risk Management

**Scenario:** Monitor suppliers, calculate risk scores, identify underperformers, recommend actions

**CouchDB Objects:** Supplier, PurchaseOrder, DeliveryPerformance, SupplierMetrics, RiskAlert

**Workflow Steps:**

```
1. Weekly Supplier Performance Review (Every Monday 8 AM)
   ↓
2. Data Collection
   ├─ For each of 45 active suppliers:
   │  ├─ Last 12 months of POs
   │  ├─ Delivery performance
   │  ├─ Quality scores
   │  ├─ Price comparisons
   │  ├─ Payment history
   │  └─ Financial news/ratings
   │
   └─ Data points: 150+ per supplier
   ↓
3. Performance Metrics Calculation (Logic)
   ├─ For Supplier A (ABC Components):
   │  ├─ On-Time Delivery: 94% (47/50 POs)
   │  ├─ Quality Score: 8.6/10
   │  ├─ Price Competitiveness: 8.2/10
   │  ├─ Payment Compliance: 10/10
   │  ├─ Financial Health: 9/10
   │  └─ Weighted Score: 89.4/100 (EXCELLENT)
   │
   └─ Repeat for all 45 suppliers
   ↓
4. Risk Assessment (LLM + Trend)
   ├─ For Supplier B (XYZ Manufacturing):
   │  ├─ Current score: 52/100 (POOR)
   │  ├─ Red Flags:
   │  │  ├─ Delivery declining: 95% → 78% (↓)
   │  │  ├─ Quality issues: 2.1% → 5.8% defect rate
   │  │  ├─ Financial: Credit rating downgrade
   │  │  └─ News: Restructuring rumors
   │  │
   │  └─ Risk Score: 7.5/10 (HIGH RISK)
   │      Recommendation: Reduce orders immediately
   │
   ├─ For Supplier C (DEF Logistics):
   │  ├─ Current: 78/100 (GOOD)
   │  ├─ Trend: IMPROVING (+8 points)
   │  └─ Risk: 2.1/10 (LOW RISK)
   │
   └─ Rank all: EXCELLENT (10), GOOD (15), ACCEPTABLE (12), POOR (5), AT RISK (3)
   ↓
5. Action Recommendations (LLM)
   ├─ EXCELLENT: Increase volume 15%, negotiate discounts
   ├─ GOOD: Maintain relationship, annual review
   ├─ POOR: Improvement meeting, 90-day plan
   └─ AT RISK: Diversify immediately, daily monitoring
   ↓
6. Create Risk Alerts & Notifications
   ├─ RiskAlert for XYZ Mfg: CRITICAL severity
   ├─ Email to Procurement, Supply Chain, Finance, CEO
   ├─ Full report with recommendations
   └─ Create follow-up tasks
   ↓
7. Update Supplier Master Data
   ├─ Store performance scores
   ├─ Store risk assessments
   ├─ Update PO rules (disable/enable suppliers)
   └─ Store last review date
   ↓
8. Generate Executive Dashboard
   ├─ Supplier Health: Excellent 10, Good 15, Acceptable 12, Poor 5, At Risk 3
   ├─ Trend: Overall score 76.2/100 (↑2.3%)
   ├─ Risk Exposure: 3 high-risk suppliers
   ├─ Opportunities: Increase orders from top 8 suppliers (+20%)
   └─ Projected savings: $200K/year
   ↓
9. Response
   └─ "45 suppliers analyzed.
       3 AT-RISK suppliers flagged.
       Actions: Diversify sourcing, reduce XYZ orders.
       Opportunities: Increase orders from top 8 suppliers.
       Projected savings: $200K/year."
```

**Tokens Used:** 2,890 | **Cost:** $0.0867 | **Time:** 3.6 seconds
**Time Saved:** 8 hours → 4 minutes
**Benefits:** Risk identification, vendor optimization, cost savings

---

### Use Case 9: Dynamic Employee Onboarding & Role-Based Access Provisioning

**Scenario:** New hire joins - auto-create accounts, provision access, assign tasks, setup benefits

**CouchDB Objects:** Employee, Role, GLCostCenter, AccessControl, OnboardingChecklist, BenefitsEnrollment, SystemAccount

**Workflow Steps:**

```
1. New Hire Notification (HR Enters Data)
   ├─ Name: John Doe
   ├─ Department: Engineering
   ├─ Designation: Senior Software Engineer
   ├─ Joining: Nov 15, 2024
   └─ Manager: John Smith
   ↓
2. Role & Permission Mapping (LLM + Logic)
   ├─ Query: Role lookup by designation + department
   │  └─ Maps to: R_ENG_SSE (Senior Software Engineer)
   │
   ├─ Get permissions:
   │  ├─ Systems: GitHub, Jira, Confluence, AWS, DataDog
   │  ├─ Access levels: Admin for GitHub, Developer for AWS
   │  ├─ Cost center: ENG-001
   │  ├─ Approval authority: Up to $5K
   │  └─ Manager: John Smith
   │
   └─ Create AccessControl entry
   ↓
3. System Account Creation (Auto-Provisioning)
   ├─ GitHub: username john.doe.eng@company
   ├─ Jira: username john.doe (groups: Engineering, Backend)
   ├─ Confluence: username john.doe (read access)
   ├─ AWS: IAM role EngineerDeveloper (dev/staging only)
   ├─ Email: john.doe@company.com (groups, calendar)
   └─ Create all accounts, send credentials
   ↓
4. Benefits & Payroll Setup
   ├─ Extract employee info:
   │  ├─ Name: John Doe
   │  ├─ Salary: $150,000
   │  ├─ Joining: Nov 15, 2024
   │  └─ Employment: Full-time, Permanent
   │
   ├─ Enroll in benefits:
   │  ├─ Health Insurance: Gold Plan, Effective Nov 15
   │  ├─ Dental: Standard plan
   │  ├─ Vision: Standard plan
   │  ├─ 401(k): 3% contribution + 3% match
   │  └─ Life Insurance: 2x salary ($300K)
   │
   ├─ Set up payroll:
   │  ├─ Salary: $5,769 bi-weekly
   │  ├─ Tax withholdings: Calculated
   │  ├─ Direct deposit: Set up
   │  └─ First paycheck: Dec 1, 2024
   │
   └─ Create BenefitsEnrollment entries
   ↓
5. Create Onboarding Checklist (25 Tasks)
   ├─ HR Tasks:
   │  ├─ Background check ☐
   │  ├─ Tax forms ☐
   │  └─ Emergency contacts ☐
   │
   ├─ IT Tasks:
   │  ├─ Order laptop ✓
   │  ├─ Setup email ✓
   │  ├─ GitHub account ✓
   │  ├─ AWS IAM setup ✓
   │  └─ Hardware setup (pending)
   │
   ├─ Facilities Tasks:
   │  ├─ Prepare desk ☐
   │  ├─ Setup phone ☐
   │  └─ Parking pass ☐
   │
   ├─ Manager Tasks:
   │  ├─ 1-on-1 meeting ☐
   │  ├─ Assign mentor ✓
   │  ├─ Team intro ☐
   │  └─ Project assignment ☐
   │
   └─ Training Tasks:
      ├─ Company culture ☐
      ├─ Security training ☐
      ├─ Engineering tour ☐
      ├─ Codebase walkthrough ☐
      ├─ Architecture deep dive ☐
      └─ Dev environment setup ☐
   ↓
6. GL Cost Center Allocation
   ├─ Get cost center: ENG-001 (Engineering)
   ├─ Annual budget: $5,000,000
   ├─ Current allocation: $4,800,000
   ├─ Available: $200,000 (Sufficient ✓)
   ├─ Allocate: $150K salary + $25K benefits = $175K
   └─ Budget remaining: $25,000
   ↓
7. Manager & Team Notifications
   ├─ Email to Manager: "New team member joining"
   ├─ Email to Mentor: "You are assigned as mentor"
   ├─ Email to Team: "New team member joins, intro meeting"
   └─ Create calendar events
   ↓
8. Org Chart Update
   ├─ Add John Doe to org structure
   ├─ Update reporting relationships
   └─ Sync company directory
   ↓
9. Response
   └─ "Onboarding completed for John Doe.
       5 system accounts created.
       4 benefits plans enrolled.
       GL allocation: $175K to ENG-001.
       25 onboarding tasks created.
       Manager & team notified.
       First-day ready!"
```

**Tokens Used:** 2,340 | **Cost:** $0.0702 | **Time:** 2.9 seconds
**Time Saved:** 3 days → 5 minutes
**Benefits:** Complete automation, zero errors, compliance ready

---

### Use Case 10: Dynamic Sales Territory & Commission Calculation Engine

**Scenario:** Analyze sales data, optimize territories, recalculate commissions, identify top performers

**CouchDB Objects:** SalesRep, SalesOrder, Territory, CommissionStructure, SalesPerformance, TerritorySalesAnalysis

**Workflow Steps:**

```
1. Monthly Commission & Territory Optimization
   ↓
2. Data Collection (Query All Sales Data)
   ├─ Period: November 2024
   ├─ Sales reps: 24 active
   ├─ Total orders: 1,245
   ├─ Total revenue: $4,500,000
   └─ For each rep: sales, products, customers, velocity
   ↓
3. Sales Performance Analysis (LLM + Scoring)
   ├─ Rep A (Sarah Chen):
   │  ├─ November: $250,000 (125% quota - EXCEEDS)
   │  ├─ YTD: $2,200,000 (110% quota - STRONG)
   │  ├─ Rank: #2 out of 24
   │  ├─ Metrics: Close rate 35%, Deal size $45K, Retention 92%
   │  └─ Score: 9.2/10 (EXCELLENT)
   │
   ├─ Rep B (Michael Johnson):
   │  ├─ November: $120,000 (60% quota - BELOW)
   │  ├─ Trend: ↓ Declining (-8% month-over-month)
   │  ├─ Activity: Low (2 calls/day vs 5 expected)
   │  ├─ YTD: 78% quota attainment (Consistent underperformer)
   │  └─ Score: 4.1/10 (NEEDS IMPROVEMENT)
   │
   ├─ Rep C (Lisa Rodriguez):
   │  ├─ November: $185,000 (92.5% quota - SOLID)
   │  ├─ Trend: ↑ Improving (was 82% last month)
   │  ├─ Opportunity: Territory has more potential
   │  └─ Score: 7.8/10 (GOOD with upside)
   │
   └─ Rank all 24: Top (5), Strong (10), Solid (6), Needs support (3)
   ↓
4. Commission Calculation (Logic)
   ├─ Structure:
   │  ├─ $0-100K: 5% commission
   │  ├─ $100-200K: 8% commission
   │  ├─ $200-300K: 10% commission
   │  ├─ $300K+: 12% commission
   │  ├─ Bonus >120% quota: +2% extra
   │  └─ Bonus >150% quota: +5% extra
   │
   ├─ Sarah Chen:
   │  ├─ Revenue: $250,000
   │  ├─ Base commission: 10% = $25,000
   │  ├─ Bonus (125% quota): +2% = $5,000
   │  ├─ Total: $30,000
   │  └─ YTD commission: $254,000
   │
   ├─ Michael Johnson:
   │  ├─ Revenue: $120,000
   │  ├─ Base commission: 8% = $9,600
   │  ├─ Bonus: None (60% quota)
   │  ├─ Total: $9,600
   │  └─ Pending manager review (Performance issue)
   │
   └─ All 24 reps: Total commissions $487,200
   ↓
5. Territory Optimization Analysis (ML + Geography)
   ├─ Current territories:
   │  ├─ West: $250K (83% penetration - SATURATED)
   │  ├─ South: $120K (30% penetration - OPPORTUNITY)
   │  ├─ Northeast: $185K (75% penetration - SOLID)
   │  └─ Midwest: $600K (75% penetration - FRAGMENTED)
   │
   ├─ Untapped potential:
   │  ├─ South: $280K gap (potential $400K)
   │  ├─ Midwest: Consolidation opportunity
   │  ├─ Healthcare vertical: $500K untapped
   │  └─ Total opportunity: $420K/year
   │
   └─ Recommendations:
      ├─ Move David Lee to South (+Michael)
      ├─ Consolidate Midwest to 3 reps
      ├─ Create Healthcare vertical
      └─ Projected impact: +$420K revenue
   ↓
6. Top Performer Recognition (LLM)
   ├─ Top 5 Performers:
   │  ├─ Sarah Chen: 125% quota + $250K monthly
   │  ├─ David Lee: 115% quota + $215K monthly
   │  ├─ Lisa Rodriguez: 92.5% quota + improving
   │  ├─ James Wilson: 108% quota + deal quality
   │  └─ Emma Singh: 105% quota + new customers
   │
   └─ Incentive recommendations:
      ├─ Sarah: Retain with +$5K bonus + leadership opportunity
      ├─ Lisa: Accelerate to 10% commission tier if 110% next month
      ├─ All top 5: Leadership development program
      └─ Budget: +$250K = $420K revenue gain (ROI: 1.68x)
   ↓
7. Underperformer Support Plan (LLM)
   ├─ Michael Johnson: 60% quota, declining trend
   ├─ 90-Day Improvement Plan:
   │  ├─ Week 1: 1-on-1 to understand issues
   │  ├─ Week 2-3: Skills assessment + training
   │  ├─ Month 2: Weekly coaching + ride-alongs
   │  ├─ Month 3: Reassess / Territory change
   │  └─ Target: 90%+ quota by Q1
   │
   └─ Resources: Sales coach, product training, CRM optimization
   ↓
8. Generate Executive Dashboard
   ├─ Total November revenue: $4,500,000
   ├─ Total commissions: $487,200
   ├─ YTD performance: 104% (ON TRACK)
   ├─ Top 20% reps: 55% of revenue
   ├─ Territory analysis: Saturated (West) vs Opportunity (South)
   ├─ Headcount optimization: Recommend +2 reps
   └─ Net new capacity: $450K revenue / $500K investment
   ↓
9. Response
   └─ "Sales analysis completed for November.
       Revenue: $4.5M | Commissions: $487K | YTD: 104%.
       Top performer: Sarah Chen (125% quota).
       Needs support: Michael Johnson (60% quota).
       Territory opportunity: $420K untapped potential.
       Recommended: Reassign South territory, add 2 new reps.
       Dashboard updated."
```

**Tokens Used:** 3,120 | **Cost:** $0.0936 | **Time:** 3.9 seconds
**Time Saved:** 2 days → 6 minutes
**Benefits:** Revenue optimization, talent retention, data-driven decisions

---

## 10. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

**Use Case 4: Expense Report Audit** (Week 1)
- Simplest to implement
- Tokens: 1,560 (lowest)
- ROI: Quick wins build confidence

**Use Case 1: Intelligent PO Workflow** (Week 2)
- Core ERP process
- Annual savings: $500K+
- Immediate business impact

**Use Case 9: Employee Onboarding** (Weeks 3-4)
- Repeatable process
- HR efficiency gains
- High user satisfaction

**Outcome:** 3 working use cases, team trained, patterns established

---

### Phase 2: Core Operations (Weeks 5-10)

**Use Case 2: Invoice Reconciliation** (Weeks 5-6)
- Critical for AP efficiency
- 80% auto-approval rate
- 2-3 days faster cycles

**Use Case 3: Inventory Optimization** (Weeks 7-8)
- Daily execution
- 12% cost reduction
- Stockout prevention

**Use Case 5: Credit Analysis & Pricing** (Weeks 9-10)
- Direct revenue impact
- 5-10% revenue increase
- Risk management

**Outcome:** 6 working use cases, $800K annual benefit identified

---

### Phase 3: Strategic Operations (Weeks 11-16)

**Use Case 6: Production Planning** (Weeks 11-12)
- Depends on PO workflow
- 25% on-time delivery improvement
- Supply chain optimization

**Use Case 8: Supplier Scoring** (Weeks 13-16)
- Weekly automation
- $300K annual savings
- Risk mitigation

**Outcome:** 8 working use cases, $1.1M annual benefit

---

### Phase 4: Financial & Sales Excellence (Weeks 17-24)

**Use Case 7: Financial Close** (Weeks 17-19)
- Highest complexity
- 10 days → 4 minutes
- 100% accuracy

**Use Case 10: Sales Territory & Commission** (Weeks 20-24)
- Strategic revenue impact
- 8-12% revenue increase
- Talent optimization

**Outcome:** All 10 use cases live, $3.3M+ annual impact

---

## 11. Expected Business Impact

### Year 1 Projections (After Full Implementation)

**Time Savings:**
- Manual work eliminated: 5,000+ hours annually
- Monthly financial close: 10 days → 4 minutes
- PO creation: 30 minutes → 10 seconds
- Invoice processing: 80% automation
- Employee productivity increase: 25%

**Cost Savings:**
- Inventory carrying costs: -12% = $400K/year
- Procurement optimization: $500K/year
- Supplier optimization: $300K/year
- AP processing: 70% reduction in manual hours
- **Total cost savings: $1,200,000/year**

**Revenue Impact:**
- Credit-based sales improvement: +5-8% = $1,500,000+
- Faster order processing: +3% customer experience
- Territory optimization: $420K identified
- **Total revenue increase: $1,920,000/year**

**Risk Mitigation:**
- Fraud prevention: $200K/year
- Supply chain protection: Stockout prevention
- Financial accuracy: 100% vs 95% manual
- Compliance: Automatic audit trails

**Total Year 1 Impact: $3,320,000**
- Direct savings: $1,200,000
- Revenue increase: $1,920,000
- Risk mitigation: $200,000

---

## 12. Security Considerations

### 12.1 Authentication & Authorization

**Your Server:**
- Validate JWT tokens for every request
- Check user permissions for specific apps/data
- Implement row-level security (users access only their data)

**Flowise:**
- Authenticate requests from your server (API key or mTLS)
- Validate user_id in request payload
- Log all tool executions

### 12.2 Data Privacy

- CouchDB: Use view-based filters to restrict access
- Flowise: Don't log sensitive data
- Your Server: Encrypt sensitive fields in PostgreSQL

### 12.3 API Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    keyGenerator: (req) => req.user.id
});

app.use('/api/', limiter);
```

---

## 13. Configuration Checklist

### Your Server (.env)
```
NODE_ENV=production
PORT=3000
JWT_SECRET=your_secret_key
FLOWISE_API_URL=http://localhost:3001
FLOWISE_API_KEY=flowise_secret_key
DATABASE_URL=postgresql://user:pass@localhost/sab_db
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
```

### Flowise (.env)
```
PORT=3001
MODE=queue
QUEUE_NAME=flowise-queue
WORKER_CONCURRENCY=100
REDIS_HOST=localhost
DATABASE_TYPE=postgres
DATABASE_HOST=localhost
DATABASE_NAME=flowise
DATABASE_USER=flowise_user
```

---

## 14. API Contract

### Your Server API

**POST /api/chat**
```json
REQUEST: {
  "query": "Show pending POs for Vendor ABC",
  "appId": "purchase_order_app"
}

RESPONSE: {
  "success": true,
  "data": {
    "message": "Found 3 pending POs...",
    "results": [...]
  },
  "metadata": {
    "tokens_used": 1245,
    "cost": 0.0374,
    "execution_time_ms": 2345
  }
}
```

### Flowise API

**POST /api/v1/prediction/{flowId}**
```json
REQUEST: {
  "sessionId": "user_123_session_456",
  "chatInput": "Show pending POs",
  "userId": "user_123"
}

RESPONSE: {
  "text": "Found 3 pending POs...",
  "tokens_used": 1245,
  "model": "gpt-4",
  "execution_time_ms": 2345,
  "cost": 0.0374
}
```

---

## 15. Monitoring & Troubleshooting

### Key Metrics

- Average NLQ query response time
- Tokens consumed per user/org
- Redis queue depth
- Flowise worker utilization
- CouchDB query performance
- Milvus search latency

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| High token usage | Inefficient prompts | Optimize prompts, use GPT-3.5 for simple queries |
| Slow queries | Large CouchDB datasets | Add indexes, use pagination |
| Queue backlog | Insufficient workers | Increase WORKER_CONCURRENCY |
| Out of memory | Heap size | `NODE_OPTIONS="--max-old-space-size=4096"` |
| Connection timeouts | Network issues | Check Redis/PostgreSQL/Flowise connectivity |

---

## 16. Conclusion

Your SAB + Flowise architecture creates an ecosystem where:

✅ **Users build custom ERP workflows** without coding
✅ **AI-powered execution** via Flowise tools
✅ **Enterprise-grade security** and audit trails
✅ **Scalable architecture** handles any volume
✅ **Complete visibility** into token usage and costs

The **10 use cases demonstrate the breadth of possibilities**—from simple validation to complex multi-step orchestration. Each builds on your server's authentication layer and Flowise's execution capabilities.

**Competitive Advantage:** Users can create **their own use cases** beyond these 10, adapting workflows to unique business needs.

---

## Quick Start Commands

```bash
# Start Redis
redis-server

# Start Flowise
npm install -g flowise
flowise start

# Start your server
cd your-server && npm start

# Test NLQ query
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{"query": "Show pending POs", "appId": "po_app"}'
```

---

**Document Version:** 2.0 (Complete & Properly Organized)
**Status:** Production Ready
**Last Updated:** November 2025