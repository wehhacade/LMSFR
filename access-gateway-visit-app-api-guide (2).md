# Client API Guide

**Client:** Visitors Application  
**Client ID:** `visit-app`

You have access to **15 APIs** across **1 project**.

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
| Hubiye | `hubiye-api` | 15 |

## Quick API reference

| Project | Method | API | Gateway endpoint | Params / keys |
| --- | --- | --- | --- | --- |
| Hubiye | `POST` | Initiate Face | `/gateway/hubiye-api/seeding/face` | body |
| Hubiye | `POST` | Initiate Fingerprint | `/gateway/hubiye-api/seeding/fingerprint` | body |
| Hubiye | `POST` | Initiate OTP | `/gateway/hubiye-api/seeding/otp` | body |
| Hubiye | `POST` | Resend when needed | `/gateway/hubiye-api/seeding/otp/resend` | body |
| Hubiye | `POST` | Retrieve the profile | `/gateway/hubiye-api/seeding/otp/profile` | body |
| Hubiye | `POST` | Retrieve the profile (Face) | `/gateway/hubiye-api/seeding/face/profile` | body |
| Hubiye | `POST` | Retrieve the profile (Fingerprint) | `/gateway/hubiye-api/seeding/fingerprint/profile` | body |
| Hubiye | `GET` | Seeding Fields | `/gateway/hubiye-api/seeding/fields` | — |
| Hubiye | `GET` | Seeding Reasons | `/gateway/hubiye-api/seeding/reasons` | — |
| Hubiye | `POST` | Demographic Match | `/gateway/hubiye-api/verification/demographic` | body |
| Hubiye | `POST` | Demographic match | `/gateway/hubiye-api/verification/demographic` | body |
| Hubiye | `GET` | Discover reasons | `/gateway/hubiye-api/verification/reasons` | — |
| Hubiye | `GET` | Discover types | `/gateway/hubiye-api/verification/types` | — |
| Hubiye | `POST` | Identity card match | `/gateway/hubiye-api/verification/demographic` | body |
| Hubiye | `POST` | Identity existence | `/gateway/hubiye-api/verification/demographic` | body |

## API details

### Hubiye

- **Project slug:** `hubiye-api`
- **Accessible APIs:** 15

#### Seeding

##### Initiate Face

- **Method:** `POST`
- **Gateway endpoint:** `/gateway/hubiye-api/seeding/face`
- **Full URL:** `https://10.0.20.44/gateway/hubiye-api/seeding/face`

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
  "idNumber": "12345678901",
  "seedingReasonCode": "CUSTOMER_ONBOARDING"
}
```

**Example request**

```bash
curl -X POST \
  "https://10.0.20.44/gateway/hubiye-api/seeding/face" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"idNumber": "12345678901", "seedingReasonCode": "CUSTOMER_ONBOARDING"}'
```

##### Initiate Fingerprint

- **Method:** `POST`
- **Gateway endpoint:** `/gateway/hubiye-api/seeding/fingerprint`
- **Full URL:** `https://10.0.20.44/gateway/hubiye-api/seeding/fingerprint`

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
  "idNumber": "12345678901",
  "seedingReasonCode": "CUSTOMER_ONBOARDING"
}
```

**Example request**

```bash
curl -X POST \
  "https://10.0.20.44/gateway/hubiye-api/seeding/fingerprint" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"idNumber": "12345678901", "seedingReasonCode": "CUSTOMER_ONBOARDING"}'
```

##### Initiate OTP

- **Method:** `POST`
- **Gateway endpoint:** `/gateway/hubiye-api/seeding/otp`
- **Full URL:** `https://10.0.20.44/gateway/hubiye-api/seeding/otp`

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
  "idNumber": "12345678901",
  "seedingReasonCode": "CUSTOMER_ONBOARDING"
}
```

**Example request**

```bash
curl -X POST \
  "https://10.0.20.44/gateway/hubiye-api/seeding/otp" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"idNumber": "12345678901", "seedingReasonCode": "CUSTOMER_ONBOARDING"}'
```

##### Resend when needed

- **Method:** `POST`
- **Gateway endpoint:** `/gateway/hubiye-api/seeding/otp/resend`
- **Full URL:** `https://10.0.20.44/gateway/hubiye-api/seeding/otp/resend`

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
  "idNumber": "12345678901",
  "otpConsentId": "66993808-1815-403e-a76c-e9e242340d44"
}
```

**Example request**

```bash
curl -X POST \
  "https://10.0.20.44/gateway/hubiye-api/seeding/otp/resend" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"idNumber": "12345678901", "otpConsentId": "66993808-1815-403e-a76c-e9e242340d44"}'
```

##### Retrieve the profile

- **Method:** `POST`
- **Gateway endpoint:** `/gateway/hubiye-api/seeding/otp/profile`
- **Full URL:** `https://10.0.20.44/gateway/hubiye-api/seeding/otp/profile`

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
  "otpCode": "123456",
  "idNumber": "12345678901",
  "otpConsentId": "66993808-1815-403e-a76c-e9e242340d44",
  "credentialType": "CARD"
}
```

**Example request**

```bash
curl -X POST \
  "https://10.0.20.44/gateway/hubiye-api/seeding/otp/profile" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"otpCode": "123456", "idNumber": "12345678901", "otpConsentId": "66993808-1815-403e-a76c-e9e242340d44", "credentialType": "CARD"}'
```

##### Retrieve the profile (Face)

- **Method:** `POST`
- **Gateway endpoint:** `/gateway/hubiye-api/seeding/face/profile`
- **Full URL:** `https://10.0.20.44/gateway/hubiye-api/seeding/face/profile`

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
  "faceData": "RkFLRV9GQUNFX0lNQUdF",
  "idNumber": "12345678901",
  "faceConsentId": "1d18da23-c0f4-4cc8-a169-b0f15e075e2a",
  "credentialType": "CARD"
}
```

**Example request**

```bash
curl -X POST \
  "https://10.0.20.44/gateway/hubiye-api/seeding/face/profile" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"faceData": "RkFLRV9GQUNFX0lNQUdF", "idNumber": "12345678901", "faceConsentId": "1d18da23-c0f4-4cc8-a169-b0f15e075e2a", "credentialType": "CARD"}'
```

##### Retrieve the profile (Fingerprint)

- **Method:** `POST`
- **Gateway endpoint:** `/gateway/hubiye-api/seeding/fingerprint/profile`
- **Full URL:** `https://10.0.20.44/gateway/hubiye-api/seeding/fingerprint/profile`

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
  "idNumber": "12345678901",
  "fingerCode": "RTH",
  "fingerData": "RkFLRV9XU1FfQllURVM=",
  "credentialType": "CERTIFICATE",
  "fingerprintConsentId": "4f830284-6ea6-4465-af3f-f8865d43d259"
}
```

**Example request**

```bash
curl -X POST \
  "https://10.0.20.44/gateway/hubiye-api/seeding/fingerprint/profile" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"idNumber": "12345678901", "fingerCode": "RTH", "fingerData": "RkFLRV9XU1FfQllURVM=", "credentialType": "CERTIFICATE", "fingerprintConsentId": "4f830284-6ea6-4465-af3f-f8865d43d259"}'
```

##### Seeding Fields

- **Method:** `GET`
- **Gateway endpoint:** `/gateway/hubiye-api/seeding/fields`
- **Full URL:** `https://10.0.20.44/gateway/hubiye-api/seeding/fields`

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
  "https://10.0.20.44/gateway/hubiye-api/seeding/fields" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>"
```

##### Seeding Reasons

- **Method:** `GET`
- **Gateway endpoint:** `/gateway/hubiye-api/seeding/reasons`
- **Full URL:** `https://10.0.20.44/gateway/hubiye-api/seeding/reasons`

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
  "https://10.0.20.44/gateway/hubiye-api/seeding/reasons" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>"
```

#### Verification

##### Demographic Match

- **Method:** `POST`
- **Gateway endpoint:** `/gateway/hubiye-api/verification/demographic`
- **Full URL:** `https://10.0.20.44/gateway/hubiye-api/verification/demographic`

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
  "identityData": {
    "sex": "F",
    "fullName": "Example Person",
    "idNumber": "12345678901",
    "dateOfBirth": "01-01-1990"
  },
  "verificationType": "DEMOGRAPHIC_MATCH",
  "verificationReasonCode": "BGC"
}
```

**Example request**

```bash
curl -X POST \
  "https://10.0.20.44/gateway/hubiye-api/verification/demographic" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"identityData": {"sex": "F", "fullName": "Example Person", "idNumber": "12345678901", "dateOfBirth": "01-01-1990"}, "verificationType": "DEMOGRAPHIC_MATCH", "verificationReasonCode": "BGC"}'
```

##### Demographic match

- **Method:** `POST`
- **Gateway endpoint:** `/gateway/hubiye-api/verification/demographic`
- **Full URL:** `https://10.0.20.44/gateway/hubiye-api/verification/demographic`

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
  "identityData": {
    "idNumber": "12345678901"
  },
  "verificationType": "IDENTITY_EXISTENCE",
  "verificationReasonCode": "BGC"
}
```

**Example request**

```bash
curl -X POST \
  "https://10.0.20.44/gateway/hubiye-api/verification/demographic" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"identityData": {"idNumber": "12345678901"}, "verificationType": "IDENTITY_EXISTENCE", "verificationReasonCode": "BGC"}'
```

##### Discover reasons

- **Method:** `GET`
- **Gateway endpoint:** `/gateway/hubiye-api/verification/reasons`
- **Full URL:** `https://10.0.20.44/gateway/hubiye-api/verification/reasons`

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
  "https://10.0.20.44/gateway/hubiye-api/verification/reasons" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>"
```

##### Discover types

- **Method:** `GET`
- **Gateway endpoint:** `/gateway/hubiye-api/verification/types`
- **Full URL:** `https://10.0.20.44/gateway/hubiye-api/verification/types`

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
  "https://10.0.20.44/gateway/hubiye-api/verification/types" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>"
```

##### Identity card match

- **Method:** `POST`
- **Gateway endpoint:** `/gateway/hubiye-api/verification/demographic`
- **Full URL:** `https://10.0.20.44/gateway/hubiye-api/verification/demographic`

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
  "identityData": {
    "sex": "F",
    "fullName": "Example Person",
    "idNumber": "12345678901",
    "issueDate": "01-01-2024",
    "expiryDate": "01-01-2029",
    "dateOfBirth": "01-01-1990"
  },
  "verificationType": "IDENTITY_CARD_MATCH",
  "verificationReasonCode": "CUSTOMER_ONBOARDING"
}
```

**Example request**

```bash
curl -X POST \
  "https://10.0.20.44/gateway/hubiye-api/verification/demographic" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"identityData": {"sex": "F", "fullName": "Example Person", "idNumber": "12345678901", "issueDate": "01-01-2024", "expiryDate": "01-01-2029", "dateOfBirth": "01-01-1990"}, "verificationType": "IDENTITY_CARD_MATCH", "verificationReasonCode": "CUSTOMER_ONBOARDING"}'
```

##### Identity existence

- **Method:** `POST`
- **Gateway endpoint:** `/gateway/hubiye-api/verification/demographic`
- **Full URL:** `https://10.0.20.44/gateway/hubiye-api/verification/demographic`

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
  "identityData": {
    "idNumber": "12345678901"
  },
  "verificationType": "DEMOGRAPHIC_MATCH",
  "verificationReasonCode": "BGC"
}
```

**Example request**

```bash
curl -X POST \
  "https://10.0.20.44/gateway/hubiye-api/verification/demographic" \
  -H "Authorization: Bearer <YOUR_GATEWAY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"identityData": {"idNumber": "12345678901"}, "verificationType": "DEMOGRAPHIC_MATCH", "verificationReasonCode": "BGC"}'
```
