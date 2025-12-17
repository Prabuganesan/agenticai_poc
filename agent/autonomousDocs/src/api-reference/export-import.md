# Export Import

**POST** `/export-import/export`

Export chatflows and related data.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `ChatFlow` | array | No | List of chatflows to export. |
| `Variable` | array | No | List of variables to export. |
| `tool` | array | No | List of tools to export. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Data exported successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "ChatFlow": [
    {
      "id": "chatflow-123"
    }
  ]
}
```

### Response (200)

```json
{
  "ChatFlow": [
    {
      "id": "chatflow-123",
      "name": "My Chatflow",
      "flowData": "{...}"
    }
  ]
}
```

---

**POST** `/export-import/import`

Import chatflows and related data.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `ChatFlow` | array | No | List of chatflows to import. |
| `Variable` | array | No | List of variables to import. |
| `tool` | array | No | List of tools to import. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Data imported successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "ChatFlow": [
    {
      "name": "Imported Chatflow",
      "flowData": "{...}"
    }
  ]
}
```

### Response (200)

```json
{
  "message": "success"
}
```

