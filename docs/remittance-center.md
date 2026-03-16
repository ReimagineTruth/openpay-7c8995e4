# Remittance Center Documentation

## Overview

The Remittance Center is a comprehensive merchant remittance management system that allows businesses to handle international money transfers, manage multiple stores, set custom fees, and track revenue analytics.

## Features

### 🏪 **Merchant Store Management**
- **Multi-Store Support**: Create and manage multiple remittance stores
- **Store Verification**: Complete verification workflow with document uploads
- **Business Types**: Support for banks, money transfer services, pawnshops, convenience stores, etc.
- **Global Coverage**: Multi-country support with local addresses and contact information
- **QR Code Generation**: Automatic QR code generation for each store

### 💰 **Transaction Processing**
- **Transaction Types**: 
  - Cash In (Customer deposits money)
  - Cash Out (Customer withdrawals money) 
  - Transfer (Send money to recipients)
- **Customer Management**: Capture customer details and identification
- **Recipient Information**: Store recipient bank details and contact information
- **Real-time Processing**: Update transaction status from pending → processing → completed
- **Reference Numbers**: Automatic unique reference number generation
- **Exchange Rates**: Support for multiple currencies with custom exchange rates

### 💳 **Fee Management**
- **Flexible Fee Structures**:
  - Percentage-based fees with min/max limits
  - Fixed amount fees
  - Tiered fee structures
- **Per Transaction Type**: Different fees for cash in, cash out, and transfers
- **Multi-Currency Support**: Set fees in different currencies
- **Automatic Calculation**: Built-in fee calculation engine

### 📊 **Revenue Analytics**
- **Real-time Revenue Tracking**: Automatic revenue calculation from transaction fees
- **Transaction Analytics**: Track volume, transaction counts, and averages
- **Visual Charts**: 
  - Revenue trends over time
  - Transaction type breakdown
  - Revenue source distribution
- **Date Range Filtering**: Analyze performance by day, week, month, or custom ranges
- **Revenue Types**: Track fee revenue, commissions, and bonuses

### 📱 **User Experience**
- **Mobile-First Design**: Optimized for mobile devices
- **Intuitive Navigation**: Tab-based interface with clear sections
- **Real-time Updates**: Live status updates and notifications
- **QR Code Support**: Scan QR codes for quick store access
- **Search & Filter**: Advanced search and filtering capabilities

## Database Schema

### Core Tables

#### `remittance_merchants`
Store information and verification status
- Store details (name, address, contact info)
- Business type and licensing
- Verification status and documents
- Operating hours

#### `remittance_merchant_fees`
Fee configuration per merchant
- Transaction type specific fees
- Fee structure (percentage, fixed, tiered)
- Min/max limits and currency settings

#### `remittance_transactions`
All remittance transactions
- Customer and recipient information
- Amount, fees, and exchange rates
- Transaction status and processing timestamps
- Reference numbers and QR codes

#### `remittance_merchant_revenue`
Revenue tracking and analytics
- Automatic revenue calculation
- Revenue type classification
- Transaction linking

#### `remittance_merchant_cash`
Cash management for physical locations
- Cash in/out tracking
- Balance management
- Transaction references

## API Functions

### Database Functions
- `calculate_merchant_fee()`: Calculate transaction fees based on merchant settings
- `generate_transaction_reference()`: Generate unique transaction reference numbers
- `update_merchant_revenue()`: Automatically update merchant revenue on transactions

### Security Features
- **Row Level Security**: Merchants can only access their own data
- **User Authentication**: Integration with OpenPay auth system
- **Data Validation**: Input validation and sanitization
- **Audit Trail**: Complete transaction history and logging

## Workflow

### 1. Store Setup
1. Create merchant store with business details
2. Upload verification documents
3. Configure fee structures
4. Generate QR codes for store access

### 2. Transaction Processing
1. Select store and transaction type
2. Enter customer and recipient information
3. Input amount and calculate fees
4. Process transaction with real-time status updates
5. Generate receipt and QR code

### 3. Revenue Tracking
1. Automatic revenue calculation from fees
2. Real-time analytics dashboard
3. Export reports and insights
4. Performance monitoring

## Integration Points

### OpenPay Integration
- Uses existing OpenPay authentication system
- Integrates with currency context for multi-currency support
- Leverages existing UI components and design system
- Compatible with OpenPay navigation and routing

### Third-Party Services
- **QR Code Generation**: qrcode.react library
- **Charts**: Recharts library for analytics
- **Date Handling**: date-fns for date manipulation
- **Currency**: OpenPay currency context

## Technical Architecture

### Frontend Components
```
src/components/remittance/
├── MerchantStoreManager.tsx    # Store management interface
├── TransactionProcessor.tsx    # Transaction processing UI
└── RevenueTracker.tsx         # Analytics and revenue tracking
```

### Database
```
supabase/migrations/
└── 2024031701_create_remitance_merchant_tables.sql
```

### Pages
```
src/pages/
└── RemittanceCenterPage.tsx   # Main remittance center interface
```

## Security Considerations

### Data Protection
- All merchant data isolated by user ID
- Sensitive information encrypted at rest
- Secure API endpoints with proper authentication
- Input validation and sanitization

### Compliance
- KYC/AML verification workflow
- Transaction monitoring and reporting
- Audit trail for all transactions
- Document storage for verification

## Performance Optimization

### Database Optimization
- Indexed queries for fast lookups
- Efficient pagination for large datasets
- Optimized joins and aggregations
- Caching for frequently accessed data

### Frontend Optimization
- Lazy loading of components
- Efficient state management
- Optimized re-renders
- Mobile-optimized performance

## Future Enhancements

### Planned Features
- **Advanced Analytics**: Machine learning insights and predictions
- **Mobile App**: Native mobile applications
- **API Integration**: Third-party service integrations
- **Compliance Tools**: Enhanced AML/KYC features
- **Multi-Language**: International language support

### Scalability
- Horizontal scaling for high-volume transactions
- Distributed architecture for global deployment
- Load balancing and caching strategies
- Real-time synchronization across locations

## Support and Maintenance

### Monitoring
- Application performance monitoring
- Database query optimization
- Error tracking and alerting
- User analytics and behavior tracking

### Updates
- Regular security updates
- Feature enhancements based on user feedback
- Performance optimizations
- Compliance updates

## Getting Started

### Prerequisites
- OpenPay application setup
- Supabase database configuration
- User authentication system

### Installation
1. Run database migration: `supabase db push`
2. Update navigation to include Remittance Center
3. Configure user permissions and access controls
4. Test with sample data

### Configuration
- Set up business types and verification requirements
- Configure default fee structures
- Set up currency exchange rates
- Configure notification preferences

## Conclusion

The Remittance Center provides a complete solution for businesses to manage international money transfers, with comprehensive store management, flexible fee structures, real-time transaction processing, and detailed revenue analytics. The system is designed for scalability, security, and ease of use, making it suitable for businesses of all sizes.
