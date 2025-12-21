# Assistants

**POST** `/assistants`

Create a new assistant.

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `details` | string | Yes | JSON stringified object containing assistant configuration (name, model, instructions, tools, etc.). |
| `credential` | string | Yes/No | 15-character GUID of the credential to use (Required for OPENAI type). |
| `type` | string | No | Type of assistant (e.g., `OPENAI` or `CUSTOM`). Defaults to `OPENAI`. |
| `iconSrc` | string | No | URL or path to the assistant's icon. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Assistant created successfully |
| **400** | Invalid input or missing required parameters |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "details": "{\"name\":\"My Assistant\",\"model\":\"gpt-4\",\"instructions\":\"You are a helpful assistant.\",\"tools\":[{\"type\":\"code_interpreter\"}]}",
  "credential": "cred-guid-12345",
  "type": "OPENAI"
}
```

### Response (200)

```json
{
  "id": 1,
  "guid": "asst-guid-12345",
  "details": "{\"id\":\"asst_openai_id\",\"name\":\"My Assistant\",...}",
  "credential": "cred-guid-12345",
  "type": "OPENAI",
  "created_on": 1700000000000
}
```

---

**GET** `/assistants`

Get all assistants for the organization.
 

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `type` | string | No | Filter by assistant type (`OPENAI` or `CUSTOM`). |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | List of assistants retrieved successfully |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "id": 1,
    "guid": "asst-guid-12345",
    "details": "{\"name\":\"My Assistant\"...}",
    "type": "OPENAI",
    "created_on": 1700000000000
  }
]
```

---

**GET** `/assistants/:id`

Get a specific assistant by ID.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the assistant. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Assistant retrieved successfully |
| **404** | Assistant not found |
| **500** | Internal server error |

---

**PUT** `/assistants/:id`

Update an existing assistant.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the assistant to update. |

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `details` | string | Yes | JSON stringified object containing updated assistant configuration. |
| `credential` | string | No | 15-character GUID of the credential. |
| `iconSrc` | string | No | URL or path to the assistant's icon. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Assistant updated successfully |
| **400** | Invalid input |
| **404** | Assistant not found |
| **500** | Internal server error |

---

**DELETE** `/assistants/:id`

Delete an assistant.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the assistant to delete. |

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `isDeleteBoth` | boolean | No | If true, also deletes the assistant from OpenAI (for OPENAI type). |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Assistant deleted successfully |
| **404** | Assistant not found |
| **500** | Internal server error |

---

**POST** `/assistants/generate/instruction`

Generate assistant instructions using an LLM.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `task` | string | Yes | The task description for the assistant. |
| `selectedChatModel` | object | Yes | Configuration for the chat model to use for generation. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Instruction generated successfully |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "task": "Create a support agent for a shoe store",
  "selectedChatModel": {
    "name": "gpt-4",
    "temperature": 0.7
  }
}
```

### Response (200)

```json
{
  "content": "You are a helpful support agent for a shoe store. You should help customers find the right shoes..."
}
```

