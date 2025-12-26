# Deployment Guide

## ✅ Completed Steps

1. ✅ Git repository initialized
2. ✅ All files committed
3. ✅ Remote origin added: `https://github.com/matheletes111-afk/multi-vendor-seller.git`
4. ✅ Vercel configuration created (`vercel.json`)
5. ✅ Package.json updated with Prisma postinstall script

## 🔐 Push to GitHub

Your code is committed locally but needs to be pushed to GitHub. Choose one of these methods:

### Method 1: Using Personal Access Token (Recommended)

1. Create a Personal Access Token:
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token" → "Generate new token (classic)"
   - Give it a name (e.g., "Vercel Deployment")
   - Select scopes: `repo` (full control of private repositories)
   - Click "Generate token"
   - **Copy the token immediately** (you won't see it again)

2. Push using the token:
   ```bash
   git push -u origin main
   ```
   - Username: `matheletes111-afk`
   - Password: **Paste your Personal Access Token** (not your GitHub password)

### Method 2: Using SSH (If you have SSH keys set up)

1. Change remote to SSH:
   ```bash
   git remote set-url origin git@github.com:matheletes111-afk/multi-vendor-seller.git
   ```

2. Push:
   ```bash
   git push -u origin main
   ```

### Method 3: Using GitHub CLI

```bash
gh auth login
git push -u origin main
```

## 🚀 Deploy to Vercel

### Option A: Via Vercel Dashboard (Easiest)

1. **Go to Vercel**: https://vercel.com
   - Sign in with your GitHub account (recommended)

2. **Import Project**:
   - Click "Add New Project"
   - Select your repository: `matheletes111-afk/multi-vendor-seller`
   - Vercel will auto-detect Next.js settings

3. **Configure Build Settings**:
   - Framework Preset: Next.js (auto-detected)
   - Build Command: `pnpm run build` (or leave default)
   - Output Directory: `.next` (auto-detected)
   - Install Command: `pnpm install` (or leave default)
   - Root Directory: `./` (default)

4. **Set Environment Variables**:
   Click "Environment Variables" and add:

   ```
   DATABASE_URL=your_production_database_url
   NEXTAUTH_URL=https://your-project.vercel.app
   NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
   STRIPE_SECRET_KEY=sk_live_... (or sk_test_... for testing)
   STRIPE_PUBLISHABLE_KEY=pk_live_... (or pk_test_... for testing)
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

5. **Deploy**:
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live at `https://your-project.vercel.app`

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (from project root)
cd /Volumes/Myssd/REACT/ali-project
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? (select your account)
# - Link to existing project? No
# - Project name? (press enter for default)
# - Directory? ./
# - Override settings? No
```

Then add environment variables:
```bash
vercel env add DATABASE_URL
vercel env add NEXTAUTH_URL
vercel env add NEXTAUTH_SECRET
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_PUBLISHABLE_KEY
vercel env add STRIPE_WEBHOOK_SECRET
```

## 📊 Database Setup for Production

You need a PostgreSQL database for production. Recommended options:

### Option 1: Vercel Postgres (Easiest - Integrated)
1. In your Vercel project dashboard
2. Go to "Storage" tab
3. Click "Create Database" → "Postgres"
4. Copy the connection string to `DATABASE_URL` environment variable

### Option 2: Supabase (Free tier available)
1. Go to https://supabase.com
2. Create a new project
3. Go to Settings → Database
4. Copy the connection string (use "Connection pooling" for serverless)

### Option 3: Neon (Serverless PostgreSQL)
1. Go to https://neon.tech
2. Create a new project
3. Copy the connection string

### After Setting Up Database:

Run migrations on your production database:
```bash
# Set DATABASE_URL to production URL
export DATABASE_URL="your_production_database_url"

# Run migrations
npx prisma migrate deploy

# Optional: Seed database
npx prisma db seed
```

## 🔔 Stripe Webhook Configuration

1. **Get your Vercel deployment URL**:
   - After deployment, note your app URL: `https://your-project.vercel.app`

2. **Configure Stripe Webhook**:
   - Go to: https://dashboard.stripe.com/webhooks
   - Click "Add endpoint"
   - Endpoint URL: `https://your-project.vercel.app/api/webhooks/stripe`
   - Select events to listen to:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `customer.subscription.created`
   - Click "Add endpoint"
   - Copy the "Signing secret" (starts with `whsec_`)
   - Add it to Vercel as `STRIPE_WEBHOOK_SECRET`

3. **Update NEXTAUTH_URL**:
   - In Vercel environment variables, set `NEXTAUTH_URL` to your deployment URL

## 🔑 Generate NEXTAUTH_SECRET

Run this command to generate a secure secret:
```bash
openssl rand -base64 32
```

Or using Node.js:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the output and use it as `NEXTAUTH_SECRET` in Vercel.

## ✅ Post-Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Vercel project created and linked to GitHub
- [ ] Production database set up
- [ ] Database migrations run (`prisma migrate deploy`)
- [ ] All environment variables configured in Vercel
- [ ] Stripe webhook configured with production URL
- [ ] `NEXTAUTH_URL` set to production URL
- [ ] Test the deployment URL
- [ ] Test authentication flow
- [ ] Test Stripe checkout flow
- [ ] Verify webhook is receiving events in Stripe dashboard

## 🐛 Troubleshooting

### Build Fails
- Check that all environment variables are set
- Verify `DATABASE_URL` is accessible from Vercel
- Check build logs in Vercel dashboard

### Database Connection Issues
- Ensure `DATABASE_URL` uses connection pooling (for serverless)
- Check database allows connections from Vercel IPs
- Verify database credentials are correct

### Authentication Not Working
- Verify `NEXTAUTH_URL` matches your deployment URL exactly
- Check `NEXTAUTH_SECRET` is set and matches between deployments
- Ensure database has the required NextAuth tables

### Stripe Webhook Not Working
- Verify webhook URL is correct in Stripe dashboard
- Check `STRIPE_WEBHOOK_SECRET` matches the signing secret
- View webhook logs in Stripe dashboard for errors

## 📝 Notes

- The project uses `pnpm` as the package manager (see `pnpm-lock.yaml`)
- Prisma Client is generated automatically via `postinstall` script
- The build command includes `prisma generate` to ensure Prisma Client is ready
- All sensitive files (`.env`, `.env.local`) are in `.gitignore`

