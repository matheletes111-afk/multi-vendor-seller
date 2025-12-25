# Multivendor E-Commerce + Services Platform

A full-featured multivendor marketplace platform built with Next.js 16, TypeScript, Prisma, and Stripe.

## Features

### User Types
- **Customers**: Browse and purchase products, book services
- **Product Sellers**: Manage products with variants, inventory, and orders
- **Service Sellers**: Manage services (appointment-based and fixed-price), bookings
- **Admin**: Platform management, seller approval, analytics

### Subscription Model
- **Free Plan**: 5 products/services, 10 orders/month
- **Standard Plan**: 50 products/services, unlimited orders, reviews enabled
- **Premium Plan**: Unlimited listings, featured listings, advanced analytics

### Key Features
- Role-based authentication (NextAuth.js)
- Subscription management with Stripe
- Product management with variants
- Service management (appointments & fixed-price)
- Order processing with commission calculation
- Category-based commission rates
- Admin dashboard for platform management
- Seller approval workflow

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5
- **Payments**: Stripe (checkout & subscriptions)
- **Styling**: Tailwind CSS + shadcn/ui
- **Validation**: Zod

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Stripe account (for payments)

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:
```
DATABASE_URL="postgresql://user:password@localhost:5432/ali_project"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

4. Set up the database:
```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
ali-project/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Database seed script
├── src/
│   ├── app/               # Next.js app router pages
│   │   ├── (auth)/        # Authentication pages
│   │   ├── (customer)/    # Customer-facing pages
│   │   ├── (dashboard)/   # Dashboard pages
│   │   └── api/           # API routes
│   ├── components/        # React components
│   │   └── ui/           # shadcn/ui components
│   ├── lib/              # Utility functions
│   ├── server/           # Server actions & validations
│   └── types/           # TypeScript type definitions
```

## Database Schema

The platform uses a comprehensive Prisma schema with models for:
- Users & Authentication
- Sellers & Stores
- Products & Variants
- Services & Service Slots/Packages
- Orders & Payments
- Subscriptions & Plans
- Categories & Commissions
- Reviews & Cart Items

## Authentication

The platform uses NextAuth.js v5 with:
- Credentials provider (email/password)
- JWT sessions
- Role-based access control (RBAC)
- Protected routes via middleware

## Subscription System

Sellers must subscribe to use the platform:
1. Subscription limits are enforced at the database and application level
2. Stripe handles subscription payments
3. Webhooks update subscription status
4. UI shows limit warnings and prevents actions when limits are reached

## Commission Model

- Commission rates are set per category
- Commissions are calculated at order creation
- Commission records are tracked for platform revenue

## Development

### Database Commands
```bash
npm run db:push      # Push schema changes
npm run db:migrate   # Create migration
npm run db:generate  # Generate Prisma Client
npm run db:seed      # Seed database
```

### Building for Production
```bash
npm run build
npm start
```

## Environment Variables

See `.env.example` for all required environment variables.

## License

MIT

