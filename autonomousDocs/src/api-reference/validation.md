# Validation

**GET** `/validation/:id`

Check validation status of a chatflow.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The ID of the chatflow. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Validation checked successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "isValid": true,
  "errors": []
}
```

