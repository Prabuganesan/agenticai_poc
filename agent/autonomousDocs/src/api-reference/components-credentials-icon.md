# Components Credentials Icon

**GET** `/components-credentials-icon/:name`

Get the icon for a component credential.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | Yes | The name of the component credential. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Icon retrieved successfully (image file) |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

Binary image content.

