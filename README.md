# CSGB Targets - Sales + Production Dashboard System

A boxes-first operating system for tracking sales and production performance with clear, non-overlapping KPIs for Sales and Production teams, plus early warning indicators for Directors.

## Overview

This system uses **BOXES** as the shared unit of truth across all dashboards. All metrics, targets, and performance indicators are derived from order-level input, automatically aggregated into weekly/monthly/FY views.

### Key Principles

- **Boxes-First**: Everything is measured in boxes - the common language between Sales and Production
- **Clear Responsibility Split**: Sales owns volume and margin; Production owns build quality and cost compliance
- **UK Financial Year**: Runs 1 July - 30 June (configurable)
- **Traffic Light System**: RAG (Red/Amber/Green) indicators provide instant visual feedback

## Architecture

- **Backend**: Node.js 20 + Express
- **Database**: PostgreSQL (via Railway DATABASE_URL)
- **Views**: Server-rendered HTML (EJS templates)
- **Authentication**: Cookie-based sessions with bcrypt password hashing
- **Deployment**: Railway-ready

## Roles & Permissions

### Sales (`role: 'sales'`)
- Enter and edit orders
- View Sales Dashboard (personal performance + team headline totals)
- Cannot see:
  - Other reps' detailed performance
  - Production data
  - Settings

### Production (`role: 'production'`)
- Enter production data
- View Production Dashboard
- Cannot see:
  - Sales order details
  - Settings

### Director (`role: 'director'`)
- Read-only access to all dashboards
- Manage settings
- Manage users
- Full visibility across all data

## Financial Year Logic

The system uses UK Financial Year (1 July - 30 June) by default:

- **FY Label Format**: `YYYY/YY` (e.g., `2025/26`)
- **FY Months**: Jul, Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar, Apr, May, Jun
- All dashboards default to current FY + current FY month
- Users can select any FY and month via dropdowns

## Core Calculations

### Per Order
- **Expected Baseline** = Box RRP Total - Box Build Cost Total
- **Actual Baseline** = Box Net Total - Box Build Cost Total
- **Contribution per Box** = Actual Baseline / Boxes Quantity
- **Discount Impact** = Expected Baseline - Actual Baseline
- **Discount Boxes Lost** = Discount Impact / Baseline Floor per Box

### Aggregated (Per FY Month)
- **Boxes Sold** = Sum of all order boxes_qty
- **Baseline Actual** = Sum of all actual_baseline
- **Baseline Target** = Monthly Box Target × Baseline Floor per Box
- **Discount Impact Total** = Sum of all discount_impact
- **Discount Boxes Lost Total** = Discount Impact Total / Baseline Floor per Box

## Traffic Light (RAG) Rules

### Global RAG Thresholds
- **GREEN**: ≥ 100% of target
- **AMBER**: ≥ `rag_amber_floor_pct` (default 90%) AND < 100%
- **RED**: < `rag_amber_floor_pct`

### Sales Dashboard RAGs
1. **Boxes Sold vs Monthly Target** (standard RAG)
2. **Baseline Contribution vs Target** (standard RAG)
3. **Discount Impact** (soft RAG):
   - Green: ≤1 box lost
   - Amber: 1-3 boxes lost
   - Red: >3 boxes lost

### Production Dashboard RAGs
1. **Boxes Built vs Plan** (standard RAG)
2. **Cost Compliance %**:
   - Green: ≥95%
   - Amber: 90-94%
   - Red: <90%
3. **Quality (Rework Rate)**:
   - Green: ≤3%
   - Amber: 3-5%
   - Red: >5%

## Sales Dashboard Sections

1. **Scoreboard** (2 RAG indicators)
   - Boxes Sold vs Monthly Target
   - Baseline Contribution vs Target

2. **Discount Impact** (soft RAG)
   - Discount given (MTD)
   - Baseline contribution lost
   - Equivalent boxes lost

3. **Observed Sales Mix** (info only)
   - Box £ and %
   - Install £ and %
   - Extras £ and %

4. **Shape & Momentum** (info only)
   - Orders count
   - Avg boxes/order
   - Avg £ per box (baseline)
   - Rolling 4-week boxes/week

5. **Install Load** (info only)
   - Installed boxes MTD
   - Installs/week (last 4)
   - Capacity reference

6. **Commentary**
   - One-line note (sales + directors can edit)

## Production Dashboard Sections

1. **Scoreboard** (2 RAG indicators)
   - Boxes Built vs Plan
   - Cost Compliance %

2. **Cost Leakage**
   - Boxes over cost
   - Top reasons (auto-tagged)

3. **Flow & Capacity** (info only)
   - Boxes built MTD
   - Rolling 4-week avg
   - Install load vs capacity
   - Backlog (boxes sold - boxes built)

4. **Quality**
   - Rework/snags rate (RAG)

5. **Observed Install Shape** (info only)
   - % installed vs collection

6. **Commentary**
   - One-line note (production + directors can edit)

## Language Rules

The system uses approved language throughout:

**Never use:**
- "Failed"
- "Missed"
- "Underperformed"

**Always use:**
- "Below target"
- "Watch"
- "High impact"
- "Needs explanation"

**Footer (all dashboards):**
> "We target boxes and margin. Everything else explains the result."

## Installation & Setup

### Prerequisites
- Node.js 20+
- PostgreSQL database
- Railway account (for deployment) or local PostgreSQL instance

### Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (create `.env` file):
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/csgb_targets
   SESSION_SECRET=your-secret-key-here
   APP_PASSCODE=your-app-passcode-here
   PORT=3000
   ```

4. The database will auto-initialize on first run:
   - Schema will be created automatically
   - Seed data will be loaded if tables are empty

5. Start the server:
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

6. Access the application at `http://localhost:3000`

### Default Login Credentials

After seeding, you can login with:
- **Sales**: `alice@example.com` / `password123`
- **Sales**: `bob@example.com` / `password123`
- **Production**: `charlie@example.com` / `password123`
- **Director**: `diana@example.com` / `password123`

**⚠️ IMPORTANT**: Change all passwords immediately in production!

## Railway Deployment

### Prerequisites
- Railway account
- Railway CLI (optional, can use web interface)

### Deployment Steps

1. **Create Railway Project**
   - Go to [railway.app](https://railway.app)
   - Create new project
   - Add PostgreSQL service

2. **Connect Repository**
   - Connect your Git repository
   - Railway will auto-detect the project

3. **Set Environment Variables**
   Railway will automatically provide `DATABASE_URL` from the PostgreSQL service.
   
   You need to set:
   - `SESSION_SECRET`: Generate a secure random string
   - `APP_PASSCODE`: (Optional) App-level passcode if needed
   - `NODE_ENV`: Set to `production`

4. **Deploy**
   - Railway will automatically:
     - Run `npm install` (from `railway.json`)
     - Start with `node server.js`
     - Bind to port provided by Railway (via `PORT` env var)

5. **Database Initialization**
   - On first deploy, the app will:
     - Create all tables from `db/schema.sql`
     - Load seed data from `db/seeds.sql` (if tables are empty)

### Railway Configuration

The `railway.json` file configures:
- Build command: `npm install`
- Start command: `node server.js`
- Restart policy: On failure, max 10 retries

## Database Schema

### Tables

1. **users**: User accounts with roles
2. **settings**: Single-row configuration (baseline floor, targets, RAG thresholds)
3. **orders**: Order-level input (source of truth)
4. **production_boxes**: Production confirmation per box batch
5. **dashboard_notes**: Commentary notes per FY/month/role

See `db/schema.sql` for full schema details.

## Settings Management

Directors can configure:
- **Baseline Floor per Box** (£): Minimum contribution per box
- **Yearly Box Target**: Total boxes for the FY
- **Monthly Box Targets**: Distribution across Jul-Jun (must sum to yearly target)
- **RAG Amber Floor %**: Threshold for amber status (default 90%)
- **Install Capacity**: High season capacity per week
- **FY Start Month**: Financial year start (default 7 = July)

## Order Entry

Sales users can:
- Create new orders with required fields:
  - Order date
  - Boxes quantity
  - Box RRP total
  - Box net total (after discount)
  - Box build cost total
- Optional fields:
  - Install revenue
  - Extras revenue
  - Order reference
  - Notes
- Auto-calculated fields (displayed in form):
  - Discount amount
  - Baseline contribution
  - Contribution per box (with RAG badge)
- Edit existing orders
- Duplicate orders (creates copy with today's date)

## Production Entry

Production users can:
- Record production batches with:
  - Production date
  - Boxes built
  - Boxes over cost
  - Over cost reasons (JSON format)
  - Rework boxes
  - Notes
- Edit existing entries

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` is set correctly
- Check PostgreSQL service is running (Railway)
- Ensure database exists and is accessible

### Session Issues
- Verify `SESSION_SECRET` is set
- Check cookie settings match your deployment (HTTPS vs HTTP)
- Clear browser cookies if experiencing login loops

### Calculation Errors
- Verify settings are configured (especially monthly targets)
- Check that orders have valid dates within FY range
- Ensure all required fields are present in orders

## Support

For issues or questions:
1. Check the dashboard footer: "We target boxes and margin. Everything else explains the result."
2. Review settings to ensure targets are configured correctly
3. Verify data entry follows expected formats

## License

ISC
