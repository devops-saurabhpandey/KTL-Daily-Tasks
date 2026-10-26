# KTL Daily Tasks

A mobile-friendly customer vehicle task tracker for KTL. Tracks customer name, phone number, chassis number, vehicle number, number plate receipt, and RC receipt by customer.

## Run locally
1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Set `MONGODB_URI` to your MongoDB connection string.
4. Optional: set `MONGODB_DB=ktl_daily_tasks`.
5. Run `npm start` and open `http://localhost:3000`.

## Deploy on Render
- Create a **Web Service** and connect this repository.
- Runtime: Node.
- Build command: `npm install`
- Start command: `npm start`
- Add environment variables:
  - `MONGODB_URI`: MongoDB Atlas connection string
  - `MONGODB_DB`: `ktl_daily_tasks` (optional)
- Deploy, then check `/api/health`.

## Important
- The database must be reachable from the hosting service and the MongoDB database user needs appropriate read/write permissions.
- This initial version has no login/authentication. Do not store sensitive customer data or expose the app publicly until authentication and access controls are added.
- Do not put database credentials in source files or commit them to GitHub.