# SportBooker Backend

A modern, scalable backend API for sports venue booking and management. Built with **NestJS**, **TypeScript**, and **PostgreSQL**, SportBooker enables users to browse venues, book matches, manage payments, and leave reviews.

## 🎯 Features

- **Multi-Tenant Architecture**: Support for multiple venues and businesses with isolated data
- **User Authentication & Authorization**: JWT-based authentication with role-based access control
- **Venue Management**: Create and manage sports venues with multiple sport types
- **Match Booking**: Browse and book sports matches at venues
- **Wallet System**: In-app wallet for managing credits and transactions
- **Payment Integration**: Secure payment processing
- **Reviews & Ratings**: Users can leave reviews and ratings for venues
- **Email Notifications**: Automated email notifications for bookings and updates
- **File Upload**: AWS S3 integration for venue images
- **API Documentation**: Swagger/OpenAPI documentation
- **Database Migrations**: Automated schema management
- **Comprehensive Testing**: Unit and E2E tests with Jest

## 🛠️ Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) 10.x
- **Language**: [TypeScript](https://www.typescriptlang.org/) 5.x
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **Authentication**: JWT with [Passport](http://www.passportjs.org/)
- **Validation**: [Class Validator](https://github.com/typestack/class-validator)
- **API Docs**: [Swagger/OpenAPI](https://swagger.io/)
- **Testing**: [Jest](https://jestjs.io/), [Supertest](https://github.com/visionmedia/supertest)
- **Cloud Storage**: [AWS S3](https://aws.amazon.com/s3/)
- **Email**: [Resend](https://resend.com/)
- **Code Quality**: ESLint, Prettier
- **Git Hooks**: Husky, Lint-staged
- **Containerization**: Docker, Docker Compose

## 📋 Prerequisites

- **Node.js**: 18.x or higher
- **npm** or **pnpm**: Package manager
- **PostgreSQL**: 12.x or higher
- **Docker** (optional): For containerized development

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/MeladAdera/SportBooker-backend.git
cd SportBooker-backend
```

### 2. Install Dependencies

Using npm:
```bash
npm install
```

Or using pnpm:
```bash
pnpm install
```

### 3. Configure Environment Variables

Copy the example environment file and update with your configuration:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/sportbooker
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=sportbooker

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRATION=3600
JWT_REFRESH_SECRET=your_refresh_token_secret
JWT_REFRESH_EXPIRATION=604800

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET_NAME=your_bucket_name

# Email (Resend)
RESEND_API_KEY=your_resend_api_key

# App
NODE_ENV=development
APP_PORT=3000
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Email
MAIL_FROM=noreply@sportbooker.com
```

## 🗄️ Database Setup

### Option 1: Using Docker Compose (Recommended)

```bash
# Start PostgreSQL and pgAdmin
npm run db:up

# Run migrations
npm run migrate

# Seed database with initial data
npm run seed

# Seed with fake players data
npm run seed:fake-players
```

### Option 2: Manual PostgreSQL Setup

```bash
# Create database
createdb sportbooker

# Run migrations
npm run migrate

# Seed database
npm run seed
```

**Available Database Commands:**

```bash
# Reset database (drop and recreate)
npm run db:reset

# Run migrations only
npm run migrate

# Seed with initial data
npm run seed

# Seed with fake player data
npm run seed:fake-players

# Start Docker containers
npm run docker:up

# Start only database container
npm run db:up
```

## 🏃 Running the Application

### Development Mode

```bash
# Start with hot-reload
npm run start:dev

# Debug mode
npm run start:debug
```

The API will be available at `http://localhost:3000`

### Production Mode

```bash
# Build the project
npm run build

# Start production server
npm run start:prod
```

### Docker

```bash
# Build and run all services
npm run docker:up

# Access the application
# API: http://localhost:3000
# pgAdmin: http://localhost:5050
```

## 📚 API Documentation

Access the interactive Swagger documentation:

```
http://localhost:3000/api/docs
```

## 🧪 Testing

### Run All Tests

```bash
npm run test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage Report

```bash
npm run test:cov
```

### Run E2E Tests

```bash
npm run test:e2e
```

## 📁 Project Structure

```
SportBooker-backend/
├── src/
│   ├── admin/                 # Admin management features
│   ├── auth/                  # Authentication & authorization
│   │   ├── decorators/        # Custom decorators
│   │   ├── dto/               # Data transfer objects
│   │   ├── guards/            # Auth guards
│   │   └── strategies/        # Passport strategies
│   ├── bookings/              # Booking management
│   ├── common/                # Shared utilities
│   │   ├── constants/         # Application constants
│   │   ├── filters/           # HTTP exception filters
│   │   ├── interceptors/      # Request/response interceptors
│   │   └── pipes/             # Validation pipes
│   ├── config/                # Configuration files
│   ├── database/              # Database setup & providers
│   ├── matches/               # Match management
│   ├── payments/              # Payment processing
│   ├── tenant/                # Tenant middleware
│   ├── tenants/               # Tenant management
│   ├── users/                 # User management
│   ├── venues/                # Venue management
│   ├── app.module.ts          # Root module
│   └── main.ts                # Application entry point
├── database/
│   ├── migrations/            # SQL migration files
│   ├── seeds/                 # Seed data files
│   ├── migrate.ts             # Migration runner
│   └── seed.ts                # Seed runner
├── test/                      # E2E tests
├── docs/                      # Documentation
├── Dockerfile                 # Docker configuration
├── docker-compose.yml         # Docker Compose setup
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript configuration
└── README.md                  # This file
```

## 🔑 Key Modules

### Auth Module
- User registration and login
- JWT token management
- Password reset functionality
- Email verification

### Venues Module
- Create and manage sports venues
- Support for multiple sport types (Football, Basketball, Tennis, Volleyball, Generic)
- Venue image upload to AWS S3
- Venue search and filtering

### Matches Module
- Create and manage sports matches
- Browse available matches
- Match roster management
- Match status tracking (Upcoming, Completed, Cancelled)

### Bookings Module
- Book matches and venues
- Manage booking status
- Booking history

### Users Module
- User profile management
- Role-based access control (Admin, Venue Owner, Player)
- User deactivation and profile updates

### Tenants Module
- Multi-tenant support
- Tenant workspace management
- Timezone support

## 🔒 Authentication & Authorization

The API uses JWT-based authentication with role-based access control (RBAC):

- **Public Routes**: Registration, login, venue browsing
- **Protected Routes**: User profile, booking management, match creation
- **Admin Routes**: User management, tenant administration

Include the JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## 📝 Code Quality

### Linting & Formatting

```bash
# Fix linting issues
npm run lint

# Format code with Prettier
npm run format

# Type check
npm run type-check
```

### Pre-commit Hooks

The project uses Husky for Git hooks:
- **pre-commit**: Runs linting and formatting on staged files
- **commit-msg**: Validates commit messages with Commitlint

## 🤝 Contributing

1. Create a feature branch from `main`
2. Make your changes following the code style
3. Write or update tests
4. Ensure all tests pass
5. Commit with a descriptive message
6. Push to your fork and create a pull request

## 📜 License

UNLICENSED - This project is proprietary and not licensed for public use.

## 👥 Authors

- **Melad Adera** - Main Developer
- **Yazan Ali** - Contributor

## 📧 Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

**Happy coding! 🚀**
