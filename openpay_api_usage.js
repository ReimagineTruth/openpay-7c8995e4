// ===============================================================
// OpenPay Payment Links API - JavaScript Usage Examples
// Production-ready client-side implementation
// ===============================================================

// ===============================================================
// 1. INITIALIZATION
// ===============================================================

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// ===============================================================
// 2. CREATE PAYMENT LINK
// ===============================================================

/**
 * Create a payment link
 * @param {Object} params - Payment link parameters
 * @returns {Promise<Object>} - API response
 */
async function createPaymentLink(params) {
  try {
    const { data, error } = await supabase.rpc('create_merchant_payment_link', {
      p_amount: params.amount,
      p_currency: params.currency || 'USD',
      p_description: params.description || null,
      p_customer_email: params.customerEmail || null,
      p_customer_name: params.customerName || null,
      p_collect_address: params.collectAddress || false,
      p_collect_phone: params.collectPhone || false,
      p_redirect_url: params.redirectUrl || null,
      p_expiration_minutes: params.expirationMinutes || 30,
      p_fee_payer: params.feePayer || 'customer',
      p_items: params.items || []
    })

    if (error) {
      throw new Error(error.message)
    }

    return data
  } catch (error) {
    console.error('Error creating payment link:', error)
    throw error
  }
}

// ===============================================================
// 3. USAGE EXAMPLES
// ===============================================================

// Example 1: Simple payment link
async function createSimplePaymentLink() {
  const paymentLink = await createPaymentLink({
    amount: 100.00,
    currency: 'USD',
    description: 'Payment for services'
  })
  
  console.log('Payment link created:', paymentLink)
  /*
  Response:
  {
    status: "success",
    payment_link_id: "123e4567-e89b-12d3-a456-426614174000",
    payment_link_token: "pl_1a2b3c4d5e6f7g8h9i0j1k2l3m",
    checkout_url: "https://openpay.app/pay/pl_1a2b3c4d5e6f7g8h9i0j1k2l3m",
    amount: 100.00,
    currency: "USD",
    expires_at: "2024-03-28T02:09:00.000Z",
    created_at: "2024-03-27T02:09:00.000Z"
  }
  */
}

// Example 2: Payment link with customer collection
async function createPaymentLinkWithCustomerCollection() {
  const paymentLink = await createPaymentLink({
    amount: 250.00,
    currency: 'USD',
    description: 'Premium subscription',
    customerEmail: 'customer@example.com',
    customerName: 'John Doe',
    collectAddress: true,
    collectPhone: true,
    expirationMinutes: 60
  })
  
  console.log('Payment link with customer collection:', paymentLink)
}

// Example 3: Product-based payment link
async function createProductPaymentLink() {
  const paymentLink = await createPaymentLink({
    amount: 0, // Amount calculated from items
    currency: 'USD',
    description: 'Order #12345',
    items: [
      {
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        quantity: 2,
        price: 49.99
      },
      {
        product_id: '550e8400-e29b-41d4-a716-446655440001',
        quantity: 1,
        price: 99.99
      }
    ],
    expirationMinutes: 1440 // 24 hours
  })
  
  console.log('Product payment link:', paymentLink)
}

// Example 4: Payment link with custom redirect
async function createPaymentLinkWithRedirect() {
  const paymentLink = await createPaymentLink({
    amount: 500.00,
    currency: 'USD',
    description: 'Custom order',
    redirectUrl: 'https://myapp.com/success',
    feePayer: 'merchant', // Merchant pays the fee
    expirationMinutes: 120
  })
  
  console.log('Payment link with redirect:', paymentLink)
}

// ===============================================================
// 4. GET PAYMENT LINK DETAILS
// ===============================================================

/**
 * Get payment link details
 * @param {string} paymentLinkToken - Payment link token
 * @returns {Promise<Object>} - Payment link details
 */
async function getPaymentLink(paymentLinkToken) {
  try {
    const { data, error } = await supabase.rpc('get_payment_link', {
      p_payment_link_token: paymentLinkToken
    })

    if (error) {
      throw new Error(error.message)
    }

    return data
  } catch (error) {
    console.error('Error getting payment link:', error)
    throw error
  }
}

// Example usage:
async function fetchPaymentLink() {
  const paymentLink = await getPaymentLink('pl_1a2b3c4d5e6f7g8h9i0j1k2l3m')
  console.log('Payment link details:', paymentLink)
}

// ===============================================================
// 5. LIST MERCHANT PAYMENT LINKS
// ===============================================================

/**
 * List merchant's payment links
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Array of payment links
 */
async function listPaymentLinks(options = {}) {
  try {
    const { data, error } = await supabase.rpc('list_merchant_payment_links', {
      p_status: options.status || null,
      p_limit: options.limit || 50,
      p_offset: options.offset || 0
    })

    if (error) {
      throw new Error(error.message)
    }

    return data
  } catch (error) {
    console.error('Error listing payment links:', error)
    throw error
  }
}

// Example usage:
async function fetchMerchantPaymentLinks() {
  const paymentLinks = await listPaymentLinks({
    status: 'active',
    limit: 20
  })
  
  console.log('Merchant payment links:', paymentLinks)
}

// ===============================================================
// 6. ERROR HANDLING
// ===============================================================

/**
 * Handle API errors gracefully
 * @param {Error} error - Error object
 * @returns {Object} - Formatted error response
 */
function handleApiError(error) {
  const errorMessages = {
    'auth_required': 'Authentication required. Please log in.',
    'invalid_amount': 'Amount must be greater than 0.',
    'invalid_currency': 'Invalid currency code. Use 3-letter currency code.',
    'invalid_fee_payer': 'Invalid fee payer. Must be customer, merchant, or split.',
    'invalid_expiration': 'Expiration must be between 5 and 525600 minutes.',
    'internal_error': 'Internal server error. Please try again.'
  }

  return {
    success: false,
    error: error.message,
    code: error.code || 'unknown_error',
    message: errorMessages[error.code] || 'An unknown error occurred.',
    timestamp: new Date().toISOString()
  }
}

// Example usage with error handling:
async function createPaymentLinkWithErrorHandling() {
  try {
    const paymentLink = await createPaymentLink({
      amount: 100.00,
      currency: 'USD',
      description: 'Test payment'
    })
    
    return {
      success: true,
      data: paymentLink,
      message: 'Payment link created successfully'
    }
    
  } catch (error) {
    return handleApiError(error)
  }
}

// ===============================================================
// 7. REACT COMPONENT EXAMPLE
// ===============================================================

/*
import React, { useState } from 'react'

function PaymentLinkCreator() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const formData = new FormData(e.target)
      const params = {
        amount: parseFloat(formData.get('amount')),
        currency: formData.get('currency'),
        description: formData.get('description'),
        customerEmail: formData.get('customerEmail') || null,
        expirationMinutes: parseInt(formData.get('expirationMinutes')) || 30
      }

      const response = await createPaymentLink(params)
      
      if (response.status === 'success') {
        setResult(response)
        // Copy checkout URL to clipboard
        navigator.clipboard.writeText(response.checkout_url)
        alert('Payment link created! URL copied to clipboard.')
      } else {
        alert('Error: ' + response.message)
      }
    } catch (error) {
      alert('Error creating payment link: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Amount ($)</label>
        <input type="number" name="amount" step="0.01" min="0.50" required />
      </div>
      
      <div>
        <label>Currency</label>
        <select name="currency">
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </select>
      </div>
      
      <div>
        <label>Description</label>
        <input type="text" name="description" placeholder="Payment description" />
      </div>
      
      <div>
        <label>Customer Email (Optional)</label>
        <input type="email" name="customerEmail" placeholder="customer@example.com" />
      </div>
      
      <div>
        <label>Expiration (minutes)</label>
        <input type="number" name="expirationMinutes" min="5" max="525600" defaultValue="30" />
      </div>
      
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Payment Link'}
      </button>
      
      {result && (
        <div>
          <h3>Payment Link Created!</h3>
          <p><strong>Checkout URL:</strong> {result.checkout_url}</p>
          <p><strong>Amount:</strong> {result.amount} {result.currency}</p>
          <p><strong>Expires:</strong> {new Date(result.expires_at).toLocaleString()}</p>
        </div>
      )}
    </form>
  )
}

export default PaymentLinkCreator
*/

// ===============================================================
// 8. TESTING UTILITIES
// ===============================================================

/**
 * Test payment link creation
 * @returns {Promise<void>}
 */
async function testPaymentLinkCreation() {
  console.log('Testing payment link creation...')
  
  try {
    // Test 1: Simple payment link
    const test1 = await createPaymentLink({
      amount: 10.00,
      currency: 'USD',
      description: 'Test payment link 1'
    })
    console.log('✅ Test 1 passed:', test1.status === 'success')
    
    // Test 2: Payment link with customer collection
    const test2 = await createPaymentLink({
      amount: 25.00,
      currency: 'USD',
      description: 'Test payment link 2',
      customerEmail: 'test@example.com',
      collectAddress: true
    })
    console.log('✅ Test 2 passed:', test2.status === 'success')
    
    // Test 3: Invalid amount (should fail)
    try {
      await createPaymentLink({
        amount: -10.00,
        currency: 'USD',
        description: 'Invalid test'
      })
      console.log('❌ Test 3 failed: Should have thrown error for negative amount')
    } catch (error) {
      console.log('✅ Test 3 passed: Correctly caught error for negative amount')
    }
    
    // Test 4: Invalid currency (should fail)
    try {
      await createPaymentLink({
        amount: 10.00,
        currency: 'INVALID',
        description: 'Invalid currency test'
      })
      console.log('❌ Test 4 failed: Should have thrown error for invalid currency')
    } catch (error) {
      console.log('✅ Test 4 passed: Correctly caught error for invalid currency')
    }
    
  } catch (error) {
    console.error('Test suite failed:', error)
  }
}

// Run tests
testPaymentLinkCreation()

// ===============================================================
// 9. PRODUCTION CONFIGURATION
// ===============================================================

const OPENPAY_CONFIG = {
  // API endpoints
  API_BASE_URL: process.env.NODE_ENV === 'production' 
    ? 'https://api.openpay.com' 
    : 'https://api-staging.openpay.com',
  
  // Checkout URLs
  CHECKOUT_BASE_URL: 'https://openpay.app/pay',
  
  // Default settings
  DEFAULT_CURRENCY: 'USD',
  DEFAULT_EXPIRATION_MINUTES: 30,
  MAX_EXPIRATION_MINUTES: 525600, // 1 year
  
  // Fee settings
  DEFAULT_FEE_PAYER: 'customer',
  FEE_PERCENTAGE: 0.029, // 2.9%
  MINIMUM_FEE: 0.30,
  
  // Validation rules
  MIN_AMOUNT: 0.50,
  MAX_AMOUNT: 999999.99,
  SUPPORTED_CURRENCIES: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
  
  // Rate limiting
  RATE_LIMIT_REQUESTS: 100,
  RATE_LIMIT_WINDOW: 60000 // 1 minute in milliseconds
}

module.exports = {
  createPaymentLink,
  getPaymentLink,
  listPaymentLinks,
  handleApiError,
  OPENPAY_CONFIG
}
