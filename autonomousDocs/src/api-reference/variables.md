# Variables

**POST** `/variables`

Create a new variable.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | Yes | Name of the variable. |
| `value` | string | Yes | Value of the variable. |
| `type` | string | No | Type of the variable (default: `string`). |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Variable created successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "name": "MY_VARIABLE",
  "value": "some_value",
  "type": "string"
}
```

### Response (200)

```json
{
  "id": 1,
  "guid": "variable-guid-12345",
  "name": "MY_VARIABLE",
  "value": "some_value",
  "type": "string",
  "created_on": 1700000000000
}
```

---

**GET** `/variables`

Get all variables.
 

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `page` | number | No | Page number for pagination. |
| `limit` | number | No | Number of items per page. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Variables retrieved successfully |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "id": 1,
    "guid": "variable-guid-12345",
    "name": "MY_VARIABLE",
    "value": "some_value",
    "type": "string",
    "created_on": 1700000000000
  }
]
```

---

**PUT** `/variables/:id`

Update an existing variable.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the variable to update. |

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | No | Name of the variable. |
| `value` | string | No | Value of the variable. |
| `type` | string | No | Type of the variable. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Variable updated successfully |
| **400** | Invalid input |
| **404** | Variable not found |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "value": "new_value"
}
```

### Response (200)

```json
{
  "id": 1,
  "guid": "variable-guid-12345",
  "name": "MY_VARIABLE",
  "value": "new_value",
  "type": "string",
  "created_on": 1700000000000,
  "last_modified_on": 1700000001000
}
```

---

**DELETE** `/variables/:id`

Delete a variable.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the variable to delete. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Variable deleted successfully |
| **404** | Variable not found |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "raw": [],
  "affected": 1
}
```

