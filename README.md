# 📦 Job Queue System

A production-ready distributed job processing system with automatic retries, dead letter queue, and real-time monitoring.

## ✨ Features

- **📊 Real-time Dashboard** - Live job feed with WebSocket updates
- **🔄 Smart Retries** - Exponential backoff for failed jobs (2^attempts seconds)
- **💀 Dead Letter Queue** - Isolate permanently failed jobs for manual review
- **🔒 Race Condition Free** - PostgreSQL row-level locking with `SELECT FOR UPDATE SKIP LOCKED`
- **🚀 Horizontal Scaling** - Add more worker processes anytime
- **🔐 JWT Authentication** - Secure access with refresh token rotation
- **📈 Queue Statistics** - Monitor pending, processing, completed, failed jobs

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js + TypeScript |
| Framework | Fastify |
| Database | PostgreSQL + Prisma |
| Real-time | Socket.IO |
| Auth | JWT + bcrypt |
| Validation | Zod |

## 🚀 Quick Start (5 minutes)

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/job-queue-system
cd job-queue-system

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# 4. Set up database
npx prisma migrate dev --name init

# 5. Start the API server
npm run dev

# 6. In a new terminal, start a worker
npm run worker

# 7. Open the dashboard
open http://localhost:8080
