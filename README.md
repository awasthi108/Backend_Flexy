# Smart Inventory Reservation System

A backend system for managing inventory reservations during flash sales with concurrency safety, idempotency, and automatic expiry handling.

## Architecture

The system follows a clean layered architecture:

- **Controllers** (`src/controllers/`) - API request/response handling
- **Services** (`src/services/`) - Business logic and orchestration
- **Repositories** (`src/repositories/`) - Data access layer

## Features

- ✅ Concurrency-safe reservations using database transactions
- ✅ Idempotent operations (same user + SKU returns existing reservation)
- ✅ Automatic reservation expiry (5 minutes)
- ✅ Prevents negative inventory
- ✅ Handles duplicate requests gracefully
- ✅ Automatic cleanup of expired reservations

## Setup

```bash
npm install
npm start
```

The server will start on `http://localhost:3000`

## API Endpoints

### 1. Reserve Inventory

**POST** `/inventory/reserve`

Reserve inventory when a user starts checkout.

**Request:**
```json
{
  "userId": "user-123",
  "sku": "SKU-001",
  "quantity": 2
}
```

**Success Response (200):**
```json
{
  "success": true,
  "reservationId": "550e8400-e29b-41d4-a716-446655440000",
  "expiresAt": "2024-01-15T10:35:00.000Z",
  "availableQuantity": 98
}
```

**Idempotent Response (200):**
```json
{
  "success": true,
  "reservationId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Existing reservation found",
  "expiresAt": "2024-01-15T10:35:00.000Z"
}
```

**Insufficient Inventory (409):**
```json
{
  "success": false,
  "error": "Insufficient inventory",
  "availableQuantity": 0
}
```

### 2. Confirm Reservation

**POST** `/checkout/confirm`

Confirm a reservation if not expired.

**Request:**
```json
{
  "reservationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "reservationId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Reservation confirmed"
}
```

**Duplicate Confirm (200):**
```json
{
  "success": true,
  "reservationId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Reservation already confirmed"
}
```

**Expired Reservation (400):**
```json
{
  "success": false,
  "error": "Reservation expired"
}
```

### 3. Cancel Reservation

**POST** `/checkout/cancel`

Cancel a reservation and release inventory.

**Request:**
```json
{
  "reservationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "reservationId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Reservation cancelled"
}
```

**Duplicate Cancel (200):**
```json
{
  "success": true,
  "reservationId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Reservation already cancelled"
}
```

### 4. Get Inventory

**GET** `/inventory/:sku`

Get current available quantity for a SKU.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sku": "SKU-001",
    "totalQuantity": 100,
    "availableQuantity": 95,
    "reservedQuantity": 5
  }
}
```

## Database Schema

### inventory
- `sku` (TEXT, PRIMARY KEY) - Stock Keeping Unit
- `total_quantity` (INTEGER) - Total inventory
- `available_quantity` (INTEGER) - Available for reservation
- `reserved_quantity` (INTEGER) - Currently reserved
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

### reservations
- `id` (TEXT, PRIMARY KEY) - UUID
- `user_id` (TEXT) - User identifier
- `sku` (TEXT) - Foreign key to inventory
- `quantity` (INTEGER) - Reserved quantity
- `status` (TEXT) - PENDING, CONFIRMED, CANCELLED, EXPIRED
- `expires_at` (DATETIME) - Expiration timestamp
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

## Edge Cases Handled

1. **Concurrent Reservations**: Database transactions prevent race conditions
2. **Reservation Expiry**: Automatic cleanup every minute releases expired inventory
3. **Page Refresh**: Idempotent reserve endpoint returns existing reservation
4. **Duplicate Confirm/Cancel**: Safe to call multiple times
5. **Negative Inventory**: Atomic updates prevent inventory from going negative

## Concurrency Safety

- Uses SQLite WAL mode for better concurrency
- Atomic inventory updates with WHERE conditions
- Transaction-based reservation creation
- Row-level locking through WHERE clauses in UPDATE statements

## Logging

All operations are logged with prefixes:
- `[RESERVE]` - Reservation attempts
- `[CONFIRM]` - Confirmation attempts
- `[CANCEL]` - Cancellation attempts
- `[CLEANUP]` - Expired reservation cleanup

## Testing Examples

### Test Concurrent Reservations
```bash
# Terminal 1
curl -X POST http://localhost:3000/inventory/reserve \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-1","sku":"SKU-001","quantity":1}'

# Terminal 2 (simultaneously)
curl -X POST http://localhost:3000/inventory/reserve \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-2","sku":"SKU-001","quantity":1}'
```

### Test Idempotency
```bash
# Same request twice
curl -X POST http://localhost:3000/inventory/reserve \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-1","sku":"SKU-001","quantity":1}'
```

