Job Queue System
A distributed job processing system with real-time monitoring.

Features
📦 Create and manage background jobs
🔄 Auto-retry with exponential backoff
💀 Dead letter queue for failed jobs
📊 Real-time dashboard with WebSockets
🔐 JWT authentication
🚀 Horizontal scaling support

Tech Stack
Node.js + TypeScript
Fastify
PostgreSQL + Prisma
Socket.IO
JWT

Quick Start
bash

# Clone and install

git clone <your-repo>
npm install

# Set up database

cp .env.example .env
npx prisma migrate dev

# Start server

npm run dev

# Start worker (new terminal)

npx ts-node src/workers/example.worker.ts

# Open dashboard

http://localhost:8080
API Endpoints
Auth
text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh-token
GET /api/auth/me
Jobs
text
POST /api/jobs # Create job
GET /api/jobs # List jobs
GET /api/jobs/stats # Queue stats
GET /api/jobs/:id # Get job
PATCH /api/jobs/:id/cancel # Cancel job
Example Usage
bash

# Login

curl -X POST http://localhost:8080/api/auth/login \
 -H "Content-Type: application/json" \
 -d '{"email":"test@example.com","password":"Test1234"}'

# Create a job

curl -X POST http://localhost:8080/api/jobs \
 -H "Authorization: Bearer YOUR_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{"type":"send-email","payload":{"to":"user@example.com"}}'

Project Structure
src/
├── modules/
│ ├── auth/ # Authentication
│ └── jobs/ # Job queue system
├── shared/ # Shared utilities
├── config/ # Configuration
└── workers/ # Worker processes

Dashboard
Real-time monitoring at http://localhost:8080
Live job feed
Queue statistics
Job creation
Connection status

License
MIT
