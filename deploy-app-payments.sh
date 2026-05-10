#!/bin/bash

# Deployment script for app-payments edge function
echo "Deploying app-payments edge function..."

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Deploy the function
echo "🚀 Deploying app-payments function..."
supabase functions deploy app-payments --no-verify-jwt

if [ $? -eq 0 ]; then
    echo "✅ Function deployed successfully!"
    
    # Test the function
    echo "🧪 Testing function health..."
    SUPABASE_URL=${SUPABASE_URL:-$(grep VITE_SUPABASE_URL .env | cut -d '=' -f2)}
    
    if [ -n "$SUPABASE_URL" ]; then
        curl -X GET "$SUPABASE_URL/functions/v1/app-payments" \
             -H "Authorization: Bearer $(grep VITE_SUPABASE_ANON_KEY .env | cut -d '=' -f2)" \
             -H "Content-Type: application/json" \
             -w "\nStatus: %{http_code}\n"
    else
        echo "⚠️  SUPABASE_URL not set. Please set it to test the function."
    fi
else
    echo "❌ Function deployment failed!"
    exit 1
fi

echo "📝 Next steps:"
echo "1. Make sure the database migration has been applied:"
echo "   supabase db push"
echo "2. Test the app creation in the browser"
echo "3. Check the function logs if issues occur:"
echo "   supabase functions logs app-payments"
