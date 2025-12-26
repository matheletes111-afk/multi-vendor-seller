#!/bin/bash

# Script to add environment variables to Vercel
# Run this after you have your database and Stripe credentials ready

echo "🔐 Adding environment variables to Vercel..."
echo ""

# NEXTAUTH_SECRET (generated)
NEXTAUTH_SECRET="diXkVN9ssk/hSutsH/62bnwgPyen1SV/Ofs9T7wSbQg="
echo "Adding NEXTAUTH_SECRET..."
echo "$NEXTAUTH_SECRET" | vercel env add NEXTAUTH_SECRET production
echo "$NEXTAUTH_SECRET" | vercel env add NEXTAUTH_SECRET preview
echo "$NEXTAUTH_SECRET" | vercel env add NEXTAUTH_SECRET development

echo ""
echo "✅ NEXTAUTH_SECRET added!"
echo ""
echo "⚠️  You still need to add these environment variables:"
echo "   1. DATABASE_URL - Your production PostgreSQL connection string"
echo "   2. NEXTAUTH_URL - Will be set after first deployment"
echo "   3. STRIPE_SECRET_KEY - From Stripe Dashboard"
echo "   4. STRIPE_PUBLISHABLE_KEY - From Stripe Dashboard"
echo "   5. STRIPE_WEBHOOK_SECRET - From Stripe Dashboard (after setting up webhook)"
echo ""
echo "To add them, run:"
echo "  vercel env add DATABASE_URL production"
echo "  vercel env add STRIPE_SECRET_KEY production"
echo "  vercel env add STRIPE_PUBLISHABLE_KEY production"
echo ""
echo "Or add them via Vercel Dashboard:"
echo "  https://vercel.com/rishavs-projects-15740841/ali-project/settings/environment-variables"

