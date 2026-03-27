# OpenPay Payment Links System - Complete Documentation

## Overview

OpenPay is a Stripe-like payment system built on PostgreSQL (Supabase) that provides secure, scalable payment link functionality for merchants. This system follows modern fintech architecture patterns with production-ready security and performance optimizations.

## Architecture

### Core Components

1. **Database Schema** - Optimized PostgreSQL tables with proper indexing
2. **RPC Functions** - Supabase-compatible stored procedures
3. **Security Layer** - Row Level Security (RLS) policies
4. **API Layer** - RESTful endpoints via Supabase
5. **Frontend Integration** - JavaScript client libraries

## Features

### ✅ Payment Link Creation
- Generate unique payment links with custom tokens
- Support for product-based and custom amount payments
- Customer data collection (email, name, address, phone)
- Flexible expiration settings (5 minutes to 1 year)
- Fee handling with configurable payer

### ✅ Security & Compliance
- Row Level Security (RLS) for data isolation
- JWT-based authentication
- Input validation and sanitization
- SQL injection prevention
- Rate limiting ready

### ✅ Performance & Scalability
- Optimized database indexes
- Efficient pagination
- Minimal database queries
- Caching-friendly design

### ✅ Developer Experience
- RESTful API design
- Comprehensive error handling
- TypeScript-ready responses
- React component examples
- Testing utilities included

## Database Schema

### payment_links Table

```sql
CREATE TABLE public.payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_link_token TEXT UNIQUE NOT NULL,
  merchant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Payment details
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  description TEXT,
  
  -- Customer collection fields
  customer_email TEXT,
  customer_name TEXT,
  collect_address BOOLEAN DEFAULT false,
  collect_phone BOOLEAN DEFAULT false,
  
  -- URL and expiration
  redirect_url TEXT,
  checkout_url TEXT,
  expires_at TIMESTAMPTZ,
  
  -- Items for product-based payments
  items JSONB DEFAULT '[]'::jsonb,
  
  -- Fee handling
  fee_amount NUMERIC(12,2) DEFAULT 0 CHECK (fee_amount >= 0),
  fee_payer TEXT DEFAULT 'customer' CHECK (fee_payer IN ('customer', 'merchant', 'split')),
  
  -- Metadata and timestamps
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Indexes

- `idx_payment_links_token` - Fast lookup by token
- `idx_payment_links_merchant` - Merchant queries
- `idx_payment_links_status` - Status-based filtering
- `idx_payment_links_expires` - Expiration cleanup
- `idx_payment_links_created` - Chronological ordering

## API Functions

### create_merchant_payment_link

Creates a new payment link with comprehensive validation and security checks.

**Parameters:**
- `p_amount` (NUMERIC) - Payment amount (required)
- `p_currency` (TEXT) - 3-letter currency code (default: 'USD')
- `p_description` (TEXT) - Payment description (optional)
- `p_customer_email` (TEXT) - Customer email (optional)
- `p_customer_name` (TEXT) - Customer name (optional)
- `p_collect_address` (BOOLEAN) - Collect billing address (default: false)
- `p_collect_phone` (BOOLEAN) - Collect phone number (default: false)
- `p_redirect_url` (TEXT) - Success redirect URL (optional)
- `p_expiration_minutes` (INTEGER) - Link expiration (default: 30, range: 5-525600)
- `p_fee_payer` (TEXT) - Who pays fee ('customer', 'merchant', 'split')
- `p_items` (JSONB) - Product items array (optional)

**Returns:**
```json
{
  "status": "success",
  "payment_link_id": "uuid",
  "payment_link_token": "pl_token",
  "checkout_url": "https://openpay.app/pay/pl_token",
  "amount": 100.00,
  "currency": "USD",
  "expires_at": "2024-03-28T02:09:00.000Z",
  "created_at": "2024-03-27T02:09:00.000Z"
}
```

**Error Responses:**
```json
{
  "status": "error",
  "error": "Amount must be greater than 0",
  "code": "invalid_amount"
}
```

### get_payment_link

Retrieves payment link details by token.

**Parameters:**
- `p_payment_link_token` (TEXT) - Payment link token

**Returns:** Payment link details or null if not found

### list_merchant_payment_links

Lists payment links for authenticated merchant.

**Parameters:**
- `p_status` (TEXT) - Filter by status (optional)
- `p_limit` (INTEGER) - Maximum results (default: 50)
- `p_offset` (INTEGER) - Pagination offset (default: 0)

**Returns:** Array of payment links

## Security Model

### Authentication
- JWT-based authentication via Supabase Auth
- User context: `auth.uid()`
- Session management

### Authorization (Row Level Security)

1. **Merchants can create payment links**
   ```sql
   CREATE POLICY "Merchants can create payment links" ON public.payment_links
     FOR INSERT WITH CHECK (auth.uid() = merchant_user_id);
   ```

2. **Merchants can view own payment links**
   ```sql
   CREATE POLICY "Merchants can view own payment links" ON public.payment_links
     FOR SELECT USING (auth.uid() = merchant_user_id);
   ```

3. **Anonymous access to public links**
   ```sql
   GRANT EXECUTE ON FUNCTION public.get_payment_link(TEXT) TO anon;
   ```

### Input Validation

- Amount: > 0, max 999999.99
- Currency: 3-letter ISO code
- Expiration: 5-525600 minutes
- Fee payer: customer/merchant/split
- SQL injection prevention via parameterized queries

## Integration Guide

### 1. Database Setup

```bash
# Apply the complete system
psql -h localhost -U postgres -d openpay -f openpay_payment_links_system.sql
```

### 2. Frontend Integration

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Create payment link
const paymentLink = await supabase.rpc('create_merchant_payment_link', {
  p_amount: 100.00,
  p_currency: 'USD',
  p_description: 'Payment for services'
})
```

### 3. React Component

```jsx
import { useState } from 'react'

function PaymentLinkCreator() {
  const [loading, setLoading] = useState(false)
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const response = await supabase.rpc('create_merchant_payment_link', {
        p_amount: parseFloat(e.target.amount.value),
        p_currency: e.target.currency.value,
        p_description: e.target.description.value
      })
      
      if (response.status === 'success') {
        navigator.clipboard.writeText(response.checkout_url)
        alert('Payment link created! URL copied to clipboard.')
      }
    } catch (error) {
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="amount" type="number" step="0.01" min="0.50" required />
      <select name="currency">
        <option value="USD">USD</option>
        <option value="EUR">EUR</option>
      </select>
      <textarea name="description" placeholder="Payment description" />
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Payment Link'}
      </button>
    </form>
  )
}
```

## Error Handling

### Error Codes

| Code | Description | Resolution |
|-------|-------------|------------|
| `auth_required` | User not authenticated | Login and retry |
| `invalid_amount` | Amount ≤ 0 | Use positive amount |
| `invalid_currency` | Invalid currency code | Use 3-letter code |
| `invalid_fee_payer` | Invalid fee payer | Use customer/merchant/split |
| `invalid_expiration` | Invalid expiration | Use 5-525600 range |
| `internal_error` | Database error | Retry or contact support |

### Error Response Format

```json
{
  "success": false,
  "error": "Error message",
  "code": "error_code",
  "message": "User-friendly message",
  "timestamp": "2024-03-27T02:09:00.000Z"
}
```

## Performance Optimization

### Database Indexes
- Primary key: `id` (UUID)
- Unique index: `payment_link_token`
- Composite indexes for common query patterns
- Automatic expiration cleanup via indexes

### Query Optimization
- Single RPC calls for complex operations
- Efficient pagination with LIMIT/OFFSET
- Minimal JOIN operations
- Optimized JSONB operations

### Caching Strategy
- Payment link cache (Redis/Memcached)
- Merchant session caching
- Rate limiting per merchant
- CDN for checkout URLs

## Production Deployment

### Environment Variables

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your-service-key

# OpenPay Configuration
OPENPAY_API_URL=https://api.openpay.com
OPENPAY_WEBHOOK_SECRET=your-webhook-secret
OPENPAY_ENCRYPTION_KEY=your-encryption-key
```

### Monitoring & Logging

```sql
-- Monitor payment link creation
SELECT 
  DATE(created_at) as date,
  COUNT(*) as links_created,
  SUM(amount) as total_volume,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_payments
FROM public.payment_links 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Monitor expiration cleanup
SELECT 
  COUNT(*) as expired_links,
  COUNT(CASE WHEN status = 'expired' THEN 1 END) as cleaned_up
FROM public.payment_links 
WHERE expires_at < NOW() - INTERVAL '1 day';
```

## Testing

### Unit Tests

```javascript
// Test payment link creation
const testCases = [
  {
    name: 'Valid payment link',
    input: { amount: 100, currency: 'USD' },
    expected: { status: 'success' }
  },
  {
    name: 'Invalid amount',
    input: { amount: -100, currency: 'USD' },
    expected: { status: 'error', code: 'invalid_amount' }
  },
  {
    name: 'Invalid currency',
    input: { amount: 100, currency: 'INVALID' },
    expected: { status: 'error', code: 'invalid_currency' }
  }
]

testCases.forEach(test => {
  // Run test and assert results
})
```

### Load Testing

```bash
# Simulate high load
for i in {1..100}; do
  curl -X POST https://your-api.com/payment-links \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"amount": 100, "currency": "USD"}' &
done

# Monitor performance
pgbench -c 10 -j 2 -t 60 your-db-connection-string
```

## Security Best Practices

### 1. Data Protection
- Encrypt sensitive data at rest
- Use HTTPS for all API calls
- Validate all inputs
- Sanitize outputs

### 2. Access Control
- Principle of least privilege
- Regular security audits
- API key rotation
- IP whitelisting

### 3. Compliance
- PCI DSS compliance for card data
- GDPR data handling
- Audit logging
- Data retention policies

## Troubleshooting

### Common Issues

1. **"Could not find function" error**
   - Solution: Apply SQL schema first
   - Check Supabase migrations

2. **"Unauthorized" error**
   - Solution: Check JWT token
   - Verify user permissions

3. **Slow query performance**
   - Solution: Check indexes
   - Analyze query plans

4. **Payment link not working**
   - Solution: Verify token format
   - Check expiration settings

## Support

### Documentation
- API Reference: `/docs/api`
- Status Page: `https://status.openpay.com`
- Support Email: `support@openpay.com`

### Changelog
- v1.0.0: Initial release
- v1.1.0: Added product items support
- v1.2.0: Enhanced fee handling

---

## Quick Start

1. **Deploy Database:**
   ```bash
   psql -h localhost -U postgres -d openpay -f openpay_payment_links_system.sql
   ```

2. **Test API:**
   ```bash
   node test-api.js
   ```

3. **Integrate Frontend:**
   ```javascript
   import { createPaymentLink } from './openpay-api'
   ```

4. **Monitor:**
   ```bash
   tail -f /var/log/openpay/access.log
   ```

🚀 **Your OpenPay payment system is now production-ready!**
