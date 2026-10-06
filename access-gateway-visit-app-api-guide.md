# Client API Guide

**Client:** Visitors Application  
**Client ID:** `visit-app`

You have access to **7 APIs** across **1 project**.

## Gateway Base URL

`https://10.0.20.44`

All requests use:

```text
https://10.0.20.44/gateway/{project-slug}/{api-path}
```

## Authentication

Authenticate with Access Gateway using your Gateway API key. If the project's connection requires automatic authentication, Access Gateway handles the target-system authentication automatically.

Send your key on every request:

```http
Authorization: Bearer <YOUR_GATEWAY_API_KEY>
```

Replace `<YOUR_GATEWAY_API_KEY>` with the Gateway API key provided to you.

Some APIs also require extra headers, query parameters, path parameters, or body fields.
Those are listed under each API below.

## Projects you can access

| Project | Project slug | Accessible APIs |
| --- | --- | ---: |
| Hubiye | `hubiye` | 7 |

## Quick API reference

| Project | Method | API | Gateway endpoint | Params / keys |
| --- | --- | --- | --- | --- |
| Hubiye | `POST` | Fingerprint | `/gateway/hubiye/seeding/fingerprint` | — |
| Hubiye | `POST` | Resend OTP | `/gateway/hubiye/seeding/otp/resend` | — |
| Hubiye | `POST` | Retrieve profile | `/gateway/hubiye/seeding/otp/profile` | body |
| Hubiye | `GET` | Seeding Fields | `/gateway/hubiye/seeding/fields` | — |
| Hubiye | `POST` | Seeding Inititation | `/gateway/hubiye/seeding/otp` | body |
| Hubiye | `GET` | Seeding Reasons | `/gateway/hubiye/seeding/reasons` | — |
| Hubiye | `GET` | Verification Reasons | `/gateway/hubiye/verification/reasons` | — |

## API details

### Hubiye

- **Project slug:** `hubiye`
- **Accessible APIs:** 7

#### Seeding

##### Fingerprint

- **Method:** `POST`
- **Gateway endpoint:** `/gateway/hubiye/seeding/fingerprint`
- **Full URL:** `https://10.0.20.44/gateway/hubiye/seeding/fingerprint`

**Headers**

| Name | Type | Required | Description | Example |
| --- | --- | --- | --- | --- |
| `Authorization` | string | yes | Gateway API key | `Bearer <YOUR_GATEWAY_API_KEY>` |

**Query parameters**

_None._

**Path parameters**

_None._

**Required keys for this API**

_No extra required keys beyond the Gateway API key and any marked parameters above._

**Request body**

_No request body documented for this API._

**Example request**

```bash
curl -X POST \
  "https://10.0.20.44/gateway/hubiye/seeding/fingerprint" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>"
```

##### Resend OTP

- **Method:** `POST`
- **Gateway endpoint:** `/gateway/hubiye/seeding/otp/resend`
- **Full URL:** `https://10.0.20.44/gateway/hubiye/seeding/otp/resend`

**Headers**

| Name | Type | Required | Description | Example |
| --- | --- | --- | --- | --- |
| `Authorization` | string | yes | Gateway API key | `Bearer <YOUR_GATEWAY_API_KEY>` |

**Query parameters**

_None._

**Path parameters**

_None._

**Required keys for this API**

_No extra required keys beyond the Gateway API key and any marked parameters above._

**Request body**

_No request body documented for this API._

**Example request**

```bash
curl -X POST \
  "https://10.0.20.44/gateway/hubiye/seeding/otp/resend" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>"
```

##### Retrieve profile

- **Method:** `POST`
- **Gateway endpoint:** `/gateway/hubiye/seeding/otp/profile`
- **Full URL:** `https://10.0.20.44/gateway/hubiye/seeding/otp/profile`

**Headers**

| Name | Type | Required | Description | Example |
| --- | --- | --- | --- | --- |
| `Authorization` | string | yes | Gateway API key | `Bearer <YOUR_GATEWAY_API_KEY>` |

**Query parameters**

_None._

**Path parameters**

_None._

**Required keys for this API**

_No extra required keys beyond the Gateway API key and any marked parameters above._

**Request body**

```json
{
  "otpCode": "OTP Code",
  "idNumber": "NIRA ID",
  "otpConsentId": "UUID returned by initiation.",
  "credentialType": "(Optional) CARD or CERTIFICATE; defaults to CERTIFICATE"
}
```

**Example request**

```bash
curl -X POST \
  "https://10.0.20.44/gateway/hubiye/seeding/otp/profile" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"otpCode": "OTP Code", "idNumber": "NIRA ID", "otpConsentId": "UUID returned by initiation.", "credentialType": "(Optional) CARD or CERTIFICATE; defaults to CERTIFICATE"}'
```

##### Seeding Fields

- **Method:** `GET`
- **Gateway endpoint:** `/gateway/hubiye/seeding/fields`
- **Full URL:** `https://10.0.20.44/gateway/hubiye/seeding/fields`

**Headers**

| Name | Type | Required | Description | Example |
| --- | --- | --- | --- | --- |
| `Authorization` | string | yes | Gateway API key | `Bearer <YOUR_GATEWAY_API_KEY>` |

**Query parameters**

_None._

**Path parameters**

_None._

**Required keys for this API**

_No extra required keys beyond the Gateway API key and any marked parameters above._

**Example request**

```bash
curl -X GET \
  "https://10.0.20.44/gateway/hubiye/seeding/fields" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>"
```

##### Seeding Inititation

- **Method:** `POST`
- **Gateway endpoint:** `/gateway/hubiye/seeding/otp`
- **Full URL:** `https://10.0.20.44/gateway/hubiye/seeding/otp`

**Headers**

| Name | Type | Required | Description | Example |
| --- | --- | --- | --- | --- |
| `Authorization` | string | yes | Gateway API key | `Bearer <YOUR_GATEWAY_API_KEY>` |

**Query parameters**

_None._

**Path parameters**

_None._

**Required keys for this API**

_No extra required keys beyond the Gateway API key and any marked parameters above._

**Request body**

```json
{
  "idNumber": "NIRA ID",
  "seedingReasonCode": "Use a code from GET /seeding/reasons."
}
```

**Example request**

```bash
curl -X POST \
  "https://10.0.20.44/gateway/hubiye/seeding/otp" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"idNumber": "NIRA ID", "seedingReasonCode": "Use a code from GET /seeding/reasons."}'
```

##### Seeding Reasons

Retrieves the available reasons that an authorized application can use when initiating the identity profile seeding process.

- **Method:** `GET`
- **Gateway endpoint:** `/gateway/hubiye/seeding/reasons`
- **Full URL:** `https://10.0.20.44/gateway/hubiye/seeding/reasons`

**Headers**

| Name | Type | Required | Description | Example |
| --- | --- | --- | --- | --- |
| `Authorization` | string | yes | Gateway API key | `Bearer <YOUR_GATEWAY_API_KEY>` |

**Query parameters**

_None._

**Path parameters**

_None._

**Required keys for this API**

_No extra required keys beyond the Gateway API key and any marked parameters above._

**Example request**

```bash
curl -X GET \
  "https://10.0.20.44/gateway/hubiye/seeding/reasons" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>"
```

#### Verification

##### Verification Reasons

- **Method:** `GET`
- **Gateway endpoint:** `/gateway/hubiye/verification/reasons`
- **Full URL:** `https://10.0.20.44/gateway/hubiye/verification/reasons`

**Headers**

| Name | Type | Required | Description | Example |
| --- | --- | --- | --- | --- |
| `Authorization` | string | yes | Gateway API key | `Bearer <YOUR_GATEWAY_API_KEY>` |

**Query parameters**

_None._

**Path parameters**

_None._

**Required keys for this API**

_No extra required keys beyond the Gateway API key and any marked parameters above._

**Example request**

```bash
curl -X GET \
  "https://10.0.20.44/gateway/hubiye/verification/reasons" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>"
```
