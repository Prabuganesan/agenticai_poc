# Marketplaces

**GET** `/marketplaces/templates`

Get all marketplace templates.
 

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Templates retrieved successfully |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "id": 1,
    "name": "Chat with PDF",
    "description": "A template to chat with PDF files",
    "flowData": "...",
    "type": "Chatflow"
  }
]
```

---

**POST** `/marketplaces/custom`

Save a custom template.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | Yes | Name of the template. |
| `description` | string | No | Description of the template. |
| `chatflowId` | string | No | ID of the chatflow to save as template (if saving chatflow). |
| `tool` | string | No | Tool definition to save as template (if saving tool). |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Template saved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "name": "My Custom Template",
  "chatflowId": "chatflow-guid-12345"
}
```

### Response (200)

```json
{
  "id": 1,
  "guid": "template-guid-12345",
  "name": "My Custom Template",
  "created_on": 1700000000000
}
```

---

**GET** `/marketplaces/custom`

Get all custom templates.
 

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Custom templates retrieved successfully |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "id": 1,
    "guid": "template-guid-12345",
    "name": "My Custom Template",
    "created_on": 1700000000000
  }
]
```

---

**DELETE** `/marketplaces/custom/:id`

Delete a custom template.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the custom template to delete. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Custom template deleted successfully |
| **404** | Template not found |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "raw": [],
  "affected": 1
}
```

