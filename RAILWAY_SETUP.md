# Railway Deployment Guide

This guide will walk you through deploying the CSGB Targets app to Railway.

## Prerequisites

- ✅ GitHub account with this repository
- ✅ Railway account (sign up at https://railway.app)

## Step-by-Step Setup

### 1. Push Your Code to GitHub

If you haven't already, push your code to GitHub:

```bash
git init  # if not already a git repo
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Create Railway Project

1. Go to https://railway.app and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository (`csgb-targets`)
5. Railway will create a new project

### 3. Add PostgreSQL Database

1. In your Railway project, click **"New"** button
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will automatically:
   - Create a PostgreSQL database
   - Add `DATABASE_URL` environment variable to your project
   - Set up SSL connection

**Important:** The `DATABASE_URL` is automatically available to your app - you don't need to set it manually!

### 4. Set Environment Variables

In your Railway project:

1. Go to your **service** (the web service, not the database)
2. Click on the **"Variables"** tab
3. Add these environment variables:

| Variable Name | Value | Notes |
|--------------|-------|-------|
| `SESSION_SECRET` | `xwFTG6VP/WNNxPM5TZvaB8qcjXAiAdlVY7a++/xPn4Y=` | Use the generated secret (or generate a new one) |
| `NODE_ENV` | `production` | Tells the app it's in production mode |

**Note:** `DATABASE_URL` and `PORT` are automatically set by Railway - don't add them manually!

### 5. Deploy

Railway will automatically deploy when you:
- Push to your GitHub repository, OR
- Click **"Deploy"** in the Railway dashboard

The first deployment will:
1. Install dependencies (`npm install`)
2. Start the server (`node server.js`)
3. Automatically run the database schema and seeds on first startup

### 6. Check Deployment

1. Go to your service in Railway
2. Click on the **"Deployments"** tab
3. Click on the latest deployment
4. Check the **"Logs"** to see:
   - ✅ "Database connection successful"
   - ✅ "Schema created successfully" (first time only)
   - ✅ "Database seeded successfully" (first time only)
   - ✅ "Server running on port XXXX"

### 7. Get Your App URL

1. In your Railway service, go to **"Settings"**
2. Under **"Networking"**, click **"Generate Domain"**
3. Your app will be available at: `https://your-app-name.up.railway.app`

### 8. Test Your App

1. Visit your Railway URL
2. You should see the login page
3. Use these default credentials (from seeds):
   - **Sales User:** `alice@example.com` / `password123`
   - **Production User:** `charlie@example.com` / `password123`
   - **Director:** `diana@example.com` / `password123`

**⚠️ IMPORTANT:** Change all passwords immediately in production!

## Troubleshooting

### Database Connection Issues

- Check that PostgreSQL service is running in Railway
- Verify `DATABASE_URL` is automatically set (don't set it manually)
- Check logs for connection errors

### App Won't Start

- Check logs in Railway dashboard
- Verify all environment variables are set
- Make sure `SESSION_SECRET` is set

### Database Not Initializing

- Check logs for schema/seeds errors
- The app auto-runs schema on first startup
- If needed, you can manually run SQL from `db/schema.sql` and `db/seeds.sql`

## Local Development (Optional)

If you want to test locally with Railway's database:

1. In Railway, go to your PostgreSQL service
2. Click **"Connect"** tab
3. Copy the **"Connection URL"**
4. Update your local `.env` file:
   ```
   DATABASE_URL=<paste-connection-url-from-railway>
   SESSION_SECRET=<your-secret>
   NODE_ENV=development
   PORT=3000
   ```
5. Run `npm start` locally

## Next Steps

- [ ] Change default user passwords
- [ ] Update settings with your actual targets
- [ ] Add your real users
- [ ] Configure custom domain (optional)

---

**Remember:** Railway automatically handles:
- ✅ Database connection (`DATABASE_URL`)
- ✅ Port assignment (`PORT`)
- ✅ SSL certificates
- ✅ Auto-deployment from GitHub

You only need to set:
- `SESSION_SECRET` (required)
- `NODE_ENV=production` (recommended)
