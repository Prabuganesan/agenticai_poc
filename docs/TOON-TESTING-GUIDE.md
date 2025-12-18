# TOON Format Testing Guide

## Overview

TOON (Token-Oriented Object Notation) format is designed to reduce token usage for **structured data (JSON objects/arrays)**, not plain text. This guide lists all places in Autonomous where JSON is used with LLMs, making them ideal for testing TOON format.

---

## ✅ Places Where JSON is Used with LLMs

### 1. **Structured Output Parsers** (Best for Testing)

**Location**: `packages/components/nodes/outputparsers/StructuredOutputParser/`

**What it does**: Forces LLMs to return responses in a specific JSON structure.

**How to test**:
1. Create a chatflow with a Chat Model node
2. Add a **Structured Output Parser** node after the Chat Model
3. Configure JSON structure (e.g., `{answer: string, source: string}`)
4. The LLM will return JSON, which TOON can compress

**Example JSON Structure**:
```json
{
  "property": "answer",
  "type": "string",
  "description": "answer to the user's question"
}
```

**File**: `packages/components/nodes/outputparsers/StructuredOutputParser/StructuredOutputParser.ts`

---

### 2. **Agent Flow - LLM Node with Structured Output**

**Location**: `packages/components/nodes/agentflow/LLM/LLM.ts`

**What it does**: LLM nodes in agent flows can be configured with "JSON Structured Output" to force JSON responses.

**How to test**:
1. Create an Agent Flow
2. Add an **LLM** node
3. Configure **"JSON Structured Output"** field:
   - Add keys (e.g., `result`, `confidence`, `data`)
   - Set types (string, number, boolean, enum, jsonArray)
   - Optionally provide JSON Schema for complex structures
4. The LLM will return structured JSON output

**Configuration Example**:
```json
{
  "key": "result",
  "type": "jsonArray",
  "jsonSchema": "{\"type\": \"object\", \"properties\": {...}}",
  "description": "Array of results"
}
```

**File**: `packages/components/nodes/agentflow/LLM/LLM.ts` (lines 179-305)

---

### 3. **Agent Nodes - Tool Calls with JSON Arguments**

**Location**: `packages/components/nodes/agentflow/Agent/Agent.ts`

**What it does**: When agents call tools, the tool arguments are passed as JSON objects.

**How to test**:
1. Create an Agent Flow with an **Agent** node
2. Connect tools to the agent
3. When the agent calls tools, it passes JSON arguments
4. Tool responses are also JSON objects

**Example Tool Call**:
```json
{
  "tool": "calculator",
  "args": {
    "operation": "multiply",
    "number1": 10,
    "number2": 20
  }
}
```

**File**: `packages/components/nodes/agentflow/Agent/Agent.ts` (lines 594-747)

---

### 4. **OpenAI Assistant - Function/Tool Definitions**

**Location**: `packages/components/nodes/agents/OpenAIAssistant/OpenAIAssistant.ts`

**What it does**: OpenAI Assistant uses JSON schemas for function/tool definitions and receives JSON responses.

**How to test**:
1. Create a chatflow with **OpenAI Assistant** node
2. Add tools/functions with JSON schemas
3. The assistant will receive and return JSON-structured data

**File**: `packages/components/nodes/agents/OpenAIAssistant/OpenAIAssistant.ts` (lines 1150-1199)

---

### 5. **Tool Nodes - JSON Input/Output**

**Location**: `packages/components/nodes/tools/`

**What it does**: Many tools accept JSON input and return JSON output.

**Examples**:
- **JSONPathExtractor**: Extracts data from JSON using JSONPath
- **CustomTool**: Can return JSON objects
- **ChainTool**: ~~Wraps chains that may return JSON~~ **REMOVED** - Use ChatflowTool or AgentAsTool instead

**How to test**:
1. Create a flow with tools that return JSON
2. Pass JSON data between nodes
3. TOON can compress the JSON data

**File**: `packages/components/nodes/tools/JSONPathExtractor/JSONPathExtractor.ts`

---

### 6. **Sequential Agents - Structured Output**

**Location**: `packages/components/nodes/sequentialagents/LLMNode/LLMNode.ts`

**What it does**: Sequential agent LLM nodes support structured output similar to agent flow LLM nodes.

**How to test**:
1. Create a Sequential Agent flow
2. Add LLM nodes with structured output configuration
3. Test with JSON responses

---

### 7. **Marketplace Agent Flows with Structured Output**

**Location**: `packages/server/marketplaces/agentflowsv2/`

**Pre-built flows that use structured output**:
- **SQL Agent.json**: Uses structured output for SQL queries
- **Human In The Loop.json**: Uses structured output for decision-making
- **Structured Output.json**: Dedicated flow for structured outputs

**How to test**:
1. Import one of these agent flows from the marketplace
2. They already have structured output configured
3. Test with TOON enabled

---

## 🧪 Recommended Test Scenarios

### Test 1: Structured Output Parser (Easiest)

**Setup**:
1. Chatflow: Chat Model → Structured Output Parser
2. Configure Structured Output Parser with:
   ```json
   [
     {"property": "answer", "type": "string"},
     {"property": "confidence", "type": "number"},
     {"property": "sources", "type": "string"}
   ]
   ```
3. Ask: "What is AI?"
4. **Expected**: LLM returns JSON like `{"answer": "...", "confidence": 0.95, "sources": "..."}`
5. **TOON should compress this JSON**

---

### Test 2: Agent Flow LLM with JSON Array

**Setup**:
1. Agent Flow with LLM node
2. Configure "JSON Structured Output":
   - Key: `items`
   - Type: `jsonArray`
   - JSON Schema: `{"type": "object", "properties": {"name": {"type": "string"}, "value": {"type": "number"}}}`
3. Ask: "List 5 programming languages with their popularity scores"
4. **Expected**: LLM returns JSON array
5. **TOON should compress this array**

---

### Test 3: Tool Calls with Complex JSON

**Setup**:
1. Agent Flow with Agent node
2. Add tools that accept complex JSON arguments
3. Agent calls tools with nested JSON objects
4. **Expected**: Tool arguments and responses are JSON
5. **TOON should compress tool call data**

---

### Test 4: Invoice Parser with Structured Output

**Setup**:
1. Create an invoice parser flow
2. Add Structured Output Parser with invoice schema:
   ```json
   [
     {"property": "invoiceNumber", "type": "string"},
     {"property": "date", "type": "string"},
     {"property": "total", "type": "number"},
     {"property": "items", "type": "string"}  // Array as string, or use jsonArray
   ]
   ```
3. Upload PDF invoice
4. **Expected**: LLM returns structured JSON invoice data
5. **TOON should compress this JSON**

---

## 📊 How to Verify TOON is Working

### Check Logs

Look for these log messages:

**When TOON is applied**:
```
[TOON] ✅ JSON string detected - Original: 500 chars (125 tokens) → TOON: 400 chars (100 tokens) - Saved: 100 chars (25 tokens, 20.00%)
[TOON] ✅ Using TOON encoding - Estimated token savings: 25 tokens (20.00%)
```

**When TOON is skipped (plain text)**:
```
[TOON] ❌ Plain text detected (11 chars, ~3 tokens) - TOON not effective for plain text, skipping encoding
```

### Compare Token Usage

1. Run the same flow with `ENABLE_TOON_FORMAT=false`
2. Note the token usage
3. Run again with `ENABLE_TOON_FORMAT=true`
4. Compare token counts in the database (`auto_sab_llm_usage` table)

---

## ⚠️ Important Notes

1. **TOON only helps with structured JSON data**, not plain text
2. **For best results**, use flows that return JSON objects/arrays
3. **Structured Output Parsers** are the easiest way to test
4. **Tool calls** with complex arguments are good candidates
5. **Agent flows with structured output** are ideal for testing

---

## 🔍 Files to Check

- `packages/components/nodes/outputparsers/StructuredOutputParser/StructuredOutputParser.ts`
- `packages/components/nodes/agentflow/LLM/LLM.ts` (lines 179-305)
- `packages/components/nodes/agentflow/Agent/Agent.ts` (lines 594-747)
- `packages/components/nodes/agents/OpenAIAssistant/OpenAIAssistant.ts`
- `packages/server/marketplaces/agentflowsv2/Structured Output.json`

---

## 📝 Summary

**Best places to test TOON**:
1. ✅ **Structured Output Parser** - Forces JSON output
2. ✅ **Agent Flow LLM with Structured Output** - Returns JSON
3. ✅ **Tool calls** - JSON arguments and responses
4. ✅ **Invoice parser with structured output** - Returns JSON invoice data

**Won't help**:
- ❌ Plain text questions
- ❌ PDF content as plain text
- ❌ Simple string responses

