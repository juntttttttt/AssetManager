# Roblox Uploader API Server

Backend API server for the Roblox Mass Uploader application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration:
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT tokens (use a strong random string)
- `REGISTRATION_ENABLED`: Set to `true` to enable user registration
- `INITIAL_OWNER_USERNAME`: Username for initial owner account
- `INITIAL_OWNER_PASSWORD`: Password for initial owner account

4. Make sure MongoDB is running:
```bash
# If using local MongoDB
mongod
```

5. Start the server:
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user (only if registration enabled)
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires auth)
- `GET /api/auth/registration-status` - Check if registration is enabled

### Owner Routes (requires owner role)

- `GET /api/owner/dashboard` - Owner dashboard data

## Default Owner Account

On first run, an owner account is created with:
- Username: `owner` (or from `INITIAL_OWNER_USERNAME`)
- Password: `changeme123` (or from `INITIAL_OWNER_PASSWORD`)

**⚠️ Change the default password immediately after first login!**

## Security Notes

- Passwords are hashed using bcrypt
- JWT tokens expire after 7 days (configurable)
- Registration is disabled by default
- Only one owner account can exist

