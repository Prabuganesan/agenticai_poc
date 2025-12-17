# Apikey

**POST** `/apikey`

Create a new API key.

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `keyName` | string | Yes | The name of the API key to create. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | API key created successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "keyName": "My New API Key"
}
```

### Response (200)

```json
[
  {
    "id": 1,
    "guid": "apikey-guid-12345",
    "keyName": "My New API Key",
    "apiKey": "pk_...",
    "apiSecret": "sk_...",
    "created_on": 1700000000000
  }
]
```

---

**POST** `/apikey/import`

Import API keys from a JSON file.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `jsonFile` | string | Yes | Base64 encoded data URI of the JSON file containing API keys. |
| `importMode` | string | Yes | Import mode: `overwriteIfExist`, `ignoreIfExist`, `errorIfExist`, or `replaceAll`. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | API keys imported successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "jsonFile": "data:application/json;base64,W3sia2V5TmFtZSI6IktleSAxIiwiYXBpS2V5IjoicGtfMSIsImFwaVNlY3JldCI6InNrXzEifV0=",
  "importMode": "errorIfExist"
}
```

### Response (200)

```json
[
  {
    "id": 1,
    "guid": "apikey-guid-12345",
    "keyName": "Key 1",
    "apiKey": "pk_1",
    "apiSecret": "sk_1",
    "created_on": 1700000000000
  }
]
```

---

**GET** `/apikey`

Get all API keys.
 

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `page` | number | No | Page number for pagination. |
| `limit` | number | No | Number of items per page. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | API keys retrieved successfully |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "id": 1,
    "guid": "apikey-guid-12345",
    "keyName": "My API Key",
    "apiKey": "pk_...",
    "apiSecret": "sk_...",
    "created_on": 1700000000000
  }
]
```

---

**PUT** `/apikey/:id`

Update an existing API key.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the API key to update. |

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `keyName` | string | Yes | The new name for the API key. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | API key updated successfully |
| **400** | Invalid input |
| **404** | API key not found |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "keyName": "Updated Key Name"
}
```

### Response (200)

```json
[
  {
    "id": 1,
    "guid": "apikey-guid-12345",
    "keyName": "Updated Key Name",
    "apiKey": "pk_...",
    "apiSecret": "sk_...",
    "created_on": 1700000000000
  }
]
```

---

**DELETE** `/apikey/:id`

Delete an API key.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the API key to delete. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | API key deleted successfully |
| **404** | API key not found |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "raw": [],
  "affected": 1
}
```

