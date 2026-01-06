
````md
# Smart Inventory Reservation System

## Setup

```bash
npm install
npm start
````

The server will start on:

```
http://localhost:3000
```

---

## Pages Available

### 1. Home / Product Page

**URL:** `/`

* Displays available products
* Shows current available quantity
* Shows “Only X items left” indicator
* Allows user to reserve inventory
* Starts countdown timer after reservation

---

### 2. Pending Reservations Page

**URL:** `/pending.html`

* Displays all active (pending) reservations
* Shows:

  * User ID
  * Reservation ID
  * SKU
  * Expiry time
  * Remaining time
* Used for admin/debug/demo purposes
* Automatically updates as reservations expire or are cancelled

---

## API Endpoints

### 1. Reserve Inventory

**POST** `/inventory/reserve`

Reserve inventory when a user starts checkout.

**Request**

```json
{
  "userId": "user-123",
  "sku": "SKU-001",
  "quantity": 1
}
```

**Success**

```json
{
  "success": true,
  "reservationId": "uuid",
  "expiresAt": "2024-01-15T10:35:00Z"
}
```

**Existing Reservation (Idempotent)**

```json
{
  "success": true,
  "reservationId": "uuid",
  "message": "Existing reservation found"
}
```

**Insufficient Inventory**

```json
{
  "success": false,
  "error": "Insufficient inventory"
}
```

---

### 2. Confirm Checkout

**POST** `/checkout/confirm`

Confirm a reservation if it is still valid.

**Request**

```json
{
  "reservationId": "uuid"
}
```

**Success**

```json
{
  "success": true,
  "message": "Reservation confirmed"
}
```

**Already Confirmed**

```json
{
  "success": true,
  "message": "Reservation already confirmed"
}
```

**Expired Reservation**

```json
{
  "success": false,
  "error": "Reservation expired"
}
```

---

### 3. Cancel Checkout

**POST** `/checkout/cancel`

Cancel a reservation and release inventory.

**Request**

```json
{
  "reservationId": "uuid"
}
```

**Success**

```json
{
  "success": true,
  "message": "Reservation cancelled"
}
```

---

### 4. Get Inventory

**GET** `/inventory/:sku`

Get current inventory details.

**Response**

```json
{
  "sku": "SKU-001",
  "totalQuantity": 100,
  "availableQuantity": 95,
  "reservedQuantity": 5
}
```

---

## Database Tables

### inventory

* `sku` (PRIMARY KEY)
* `total_quantity`
* `available_quantity`
* `reserved_quantity`
* `created_at`
* `updated_at`

### reservations

* `id`
* `user_id`
* `sku`
* `quantity`
* `status` (RESERVED, CONFIRMED, CANCELLED, EXPIRED)
* `expires_at`
* `created_at`
* `updated_at`

