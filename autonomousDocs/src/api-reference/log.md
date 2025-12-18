# Log

**GET** `/log`

Get logs (legacy).
 

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `startDate` | string | No | Filter by start date. |
| `endDate` | string | No | Filter by end date. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Logs retrieved successfully |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "timestamp": "2023-01-01T00:00:00.000Z",
    "level": "info",
    "message": "Log message"
  }
]
```

---

**POST** `/log/flags`

Get flag status.
 

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Flags retrieved successfully |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "success": true,
  "flags": {
    "featureX": true
  }
}
```

---

**POST** `/log/flags/refresh`

Refresh flag status.
 

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Flags refreshed successfully |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "success": true,
  "message": "Flags refreshed successfully",
  "flags": {
    "featureX": true
  }
}
```

---

**POST** `/log/query`

Query logs with filters.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `startDate` | string | No | Start date filter. |
| `endDate` | string | No | End date filter. |
| `level` | string | No | Log level filter. |
| `service` | string | No | Service filter. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Logs retrieved successfully |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "level": "error",
  "service": "api"
}
```

### Response (200)

```json
{
  "logs": [],
  "total": 0
}
```

---

**POST** `/log/stats`

Get log statistics.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `orgId` | string | No | Organization ID. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Stats retrieved successfully |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "success": true,
  "stats": {
    "totalLogs": 100,
    "errorCount": 5
  }
}
```

---

**POST** `/log/filters`

Get all filter options.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `orgId` | string | No | Organization ID. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Filters retrieved successfully |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "levels": ["info", "error"],
  "services": ["api", "worker"]
}
```

---

**POST** `/log/groups`

Get log groups structure.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `orgId` | string | No | Organization ID. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Groups retrieved successfully |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "groups": []
}
```

---

**POST** `/log/levels`

Get log levels.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `orgId` | string | No | Organization ID. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Levels retrieved successfully |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "levels": ["info", "warn", "error"]
}
```

---

**POST** `/log/services`

Get services.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `orgId` | string | No | Organization ID. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Services retrieved successfully |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "services": ["api", "worker"]
}
```

---

**POST** `/log/modules`

Get modules.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `orgId` | string | No | Organization ID. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Modules retrieved successfully |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "modules": ["auth", "users"]
}
```

