# Llm Usage

**GET** `/llm-usage/stats`

Get aggregated LLM usage statistics.
 

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `startDate` | string | No | Start date for filtering. |
| `endDate` | string | No | End date for filtering. |
| `chatflowId` | string | No | Filter by chatflow ID. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Stats retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "totalTokens": 1000,
  "totalCost": 0.02,
  "requestCount": 50
}
```

---

**GET** `/llm-usage/query`

Query specific LLM usage records.
 

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `page` | number | No | Page number. |
| `limit` | number | No | Items per page. |
| `startDate` | string | No | Start date for filtering. |
| `endDate` | string | No | End date for filtering. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Records retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "id": "usage-123",
    "tokens": 20,
    "cost": 0.0004,
    "timestamp": "2023-01-01T00:00:00Z"
  }
]
```

---

**GET** `/llm-usage/filters`

Get available filters for LLM usage.
 

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Filters retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "models": ["gpt-4", "gpt-3.5-turbo"],
  "providers": ["openai", "anthropic"]
}
```

