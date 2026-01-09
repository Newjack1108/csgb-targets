# CSGB Targets - Sales + Production Dashboard System

A Railway-deployable web application that provides role-based dashboards for Sales and Production teams, using **boxes as the shared unit of truth** for tracking performance across the UK Financial Year.

## Overview

This system provides:
- **Sales Dashboard**: Track orders, boxes sold, baseline contribution, discount impact, and sales mix
- **Production Dashboard**: Monitor boxes built, cost compliance, quality metrics, and production flow
- **Director View**: Read-only access to all dashboards and settings management
- **UK Financial Year Logic**: Runs on July 1 - June 30 cycle with monthly targets

## Boxes-First Operating System

The entire system is built around **boxes** as the fundamental unit of measurement:

- All targets are expressed in boxes
- All calculations derive from order-level box data
- Sales and Production share the same box metrics
- Weekly/monthly/FY views automatically aggregate from order-level input

## Sales vs Production Responsibility Split

### Sales Responsibility
- **Enter and manage orders** (order-level input)
- **Track personal performance** against monthly box targets
- **Monitor discount impact** and baseline contribution
- **See team headline totals** (but not individual rep details)
- **Do NOT see**: Overheads, other reps' details, settings

### Production Responsibility
- **Enter production data** (boxes built, cost compliance, quality)
- **Track boxes built** against monthly plan
- **Monitor cost compliance** and quality metrics
- **Track production flow** and backlog
- **Do NOT see**: Sales discount details, individual order margins

### Director Responsibility
- **Read-only access** to all dashboards
- **Manage settings** (targets, thresholds, capacity)
- **Manage users** (create, edit, delete)
- **Full visibility** across all metrics

## RAG (Traffic Light) Interpretation

### Global RAG Rules
- **GREEN (≥100%)**: On target or above
- **AMBER (≥90% and <100%)**: Watch - below target but within acceptable range
- **RED (<90%)**: Below target - needs explanation

### Sales Dashboard RAGs

1. **Boxes Sold vs Monthly Target**
   - Green: ≥100% of monthly target
   - Amber: 90-99% of monthly target
   - Red: <90% of monthly target

2. **Baseline Contribution vs Target**
   - Green: ≥100% of target (monthly target × baseline floor per box)
   - Amber: 90-99% of target
   - Red: <90% of target

3. **Discount Impact (Soft RAG)**
   - Green: ≤1 equivalent box lost
   - Amber: 1-3 boxes lost
   - Red: >3 boxes lost

### Production Dashboard RAGs

1. **Boxes Built vs Plan**
   - Green: ≥100% of monthly box target
   - Amber: 90-99% of monthly target
   - Red: <90% of monthly target

2. **Cost Compliance %**
   - Green: ≥95% (boxes within cost)
   - Amber: 90-94%
   - Red: <90%

3. **Quality (Rework Rate)**
   - Green: ≤3% rework rate
   - Amber: 3-5% rework rate
   - Red: >5% rework rate

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

## Technology Stack

- **Node.js 20** + **Express** - Server framework
- **PostgreSQL** - Database (via Railway DATABASE_URL)
- **EJS** - Server-rendered templates
- **Express Session** - Cookie-based authentication
- **bcrypt** - Password hashing

## Environment Variables

Required environment variables:

- `DATABASE_URL` - PostgreSQL connection string (provided by Railway)
- `SESSION_SECRET` - Secret key for session encryption
- `APP_PASSCODE` - (Optional) Application passcode
- `PORT` - Server port (defaults to 3000, Railway provides this)

## Installation & Setup

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd csgb-targets
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database URL and session secret
   ```

4. **Run the server**
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

5. **Access the application**
   - Open http://localhost:3000
   - Login with seeded users (see below)

### Default Users

The database is seeded with example users (password: `password123`):

- **Alice Sales** (alice@example.com) - Sales role
- **Bob Sales** (bob@example.com) - Sales role
- **Charlie Production** (charlie@example.com) - Production role
- **Diana Director** (diana@example.com) - Director role

**⚠️ IMPORTANT**: Change all passwords immediately in production!

## Railway Deployment

### Prerequisites
- Railway account
- Railway CLI (optional, can use web interface)

### Deployment Steps

1. **Create a new Railway project**
   - Go to Railway dashboard
   - Click "New Project"
   - Select "Deploy from GitHub repo" or "Empty Project"

2. **Add PostgreSQL database**
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will provide `DATABASE_URL` automatically

3. **Configure environment variables**
   - Go to project settings → Variables
   - Add:
     - `SESSION_SECRET` - Generate a strong random string
     - `NODE_ENV=production`

4. **Deploy**
   - If using GitHub: Push to your repository, Railway auto-deploys
   - If using CLI: `railway up`

5. **Database initialization**
   - The app automatically runs `schema.sql` and `seeds.sql` on first startup
   - Check logs to confirm database initialization

### Railway Configuration

The `railway.json` file configures:
- Build command: `npm install`
- Start command: `node server.js`
- Auto-restart on failure

## Database Schema

### Tables

1. **users** - User accounts with roles (sales, production, director)
2. **settings** - Single-row configuration (targets, thresholds, capacity)
3. **orders** - Order-level input (source of truth for sales metrics)
4. **production_boxes** - Production entries (boxes built, cost compliance, quality)
5. **dashboard_notes** - Commentary notes per FY/month/role

See `db/schema.sql` for full schema details.

## Key Features

### Financial Year Logic
- UK Financial Year: July 1 - June 30
- FY labels: YYYY/YY format (e.g., 2025/26)
- All dashboards default to current FY + current month
- Users can select any FY and month

### Order Entry
- Simple order-by-order form
- Auto-calculates: discount, baseline contribution, £/box
- Visual RAG badge for contribution per box
- Duplicate order functionality
- Edit history tracked

### Calculations

**Per Order:**
- Expected baseline = RRP - Build Cost
- Actual baseline = Net - Build Cost
- Contribution per box = Actual baseline / Boxes qty
- Discount impact = Expected - Actual baseline
- Equivalent boxes lost = Discount impact / Baseline floor

**Aggregated (per FY month):**
- Boxes sold, baseline actual vs target
- Discount impact total
- Observed sales mix (box/install/extras %)
- Shape metrics (orders count, avg boxes/order, rolling 4-week)

## Project Structure

```
csgb-targets/
├── server.js              # Main Express app
├── package.json           # Dependencies
├── railway.json           # Railway config
├── db/
│   ├── schema.sql         # Database schema
│   ├── seeds.sql          # Initial data
│   └── index.js           # DB connection pool
├── routes/                # Route handlers
│   ├── auth.js
│   ├── sales.js
│   ├── production.js
│   ├── settings.js
│   └── users.js
├── middleware/            # Auth & role checks
│   └── auth.js
├── utils/                 # Business logic
│   ├── fy.js              # Financial year calculations
│   ├── calculations.js    # Per-order metrics
│   ├── aggregations.js    # Dashboard aggregations
│   └── rag.js             # Traffic light logic
├── views/                 # EJS templates
│   ├── partials/
│   ├── auth/
│   ├── sales/
│   ├── production/
│   ├── settings/
│   └── users/
└── public/
    └── styles.css         # Single stylesheet
```

## Development

### Running Tests
(Add test instructions if tests are added)

### Code Style
- Use standard JavaScript conventions
- Follow existing code structure
- Comment complex business logic

## Support

For issues or questions:
1. Check the dashboard footer: "We target boxes and margin. Everything else explains the result."
2. Review RAG interpretation guide above
3. Check Railway logs for errors

## License

[Add license information]

---

**Remember**: We target boxes and margin. Everything else explains the result.
