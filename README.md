# Job Portal Backend (NestJS)

This repository contains the backend API for a comprehensive Job Portal application built with NestJS, TypeORM, and PostgreSQL. It connects Employees seeking jobs with Employers posting job openings, incorporating features like role-based authentication, profile management, job/application handling, and AI-powered resume feedback.

## ✨ Core Features

**Authentication & Authorization:**

*   Separate registration flows for Employees (email verification required) and Employers (admin approval required).
*   Secure login using email and password (`bcrypt` hashing).
*   JWT (JSON Web Token) based authentication for protected routes.
*   Role-based access control (`employee`, `employer`, `admin`) using Guards.
*   Password reset functionality via email (6-digit code).
*   Password change functionality for logged-in users.
*   Server-side token invalidation on logout and password change (using JTI deny list).

**Employee Features:**

*   Create and manage profile (bio, skills, years of experience).
*   Manage Education history (CRUD).
*   Manage Project showcase/portfolio items (CRUD with optional URLs).
*   Upload, view, and download resume (PDF, DOCX, DOC support).
*   **AI Resume Feedback:** Trigger analysis of the uploaded resume using Hugging Face Inference API (Mistral/Flan-T5 models) for general feedback.
*   Search available jobs by title or skills (OR logic) with location filtering.
*   View detailed job information, including the number of applications submitted.
*   **Job Recommendations:** Get personalized job suggestions based on skill overlap with profile.
*   Apply for jobs (full application).
*   Express interest in jobs ("Quick Apply" style).
*   View own application history and status (`applied`, `viewed`, `contacted`, `interested`).
*   Add private notes to submitted applications for tracking.

**Employer Features:**

*   Register requiring admin approval (providing company details).
*   Post new job openings.
*   View, update, and delete own job postings.
*   View list of applications received for their jobs.
*   View details of specific applications/applicants (excluding sensitive data).
*   Update the status of applications (`viewed`, `contacted`).
*   Receive email notification when they are approved by an admin.

**Admin Features:**

*   (Requires Manual Setup) View list of pending employer registration requests.
*   (Requires Manual Setup) View details of a specific pending employer request.
*   (Requires Manual Setup / Debug Endpoint) Approve pending employer registrations (triggers approval email to employer).

**General Features:**

*   Email notifications (Password Reset, Employee Verification, Employer Approval, Application Status Change) using Nodemailer via a dedicated `MailerService`.
*   Static file serving for uploaded resumes.
*   Input validation using `class-validator` and `ValidationPipe`.
*   Database interaction managed by TypeORM.

## 💻 Technologies Used

*   **Framework:** NestJS (^Version based on your `package.json`)
*   **Language:** TypeScript
*   **Database:** PostgreSQL
*   **ORM:** TypeORM
*   **Authentication:** JWT (`@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`), `bcrypt`
*   **Validation:** `class-validator`, `class-transformer`
*   **API Calls:** `axios` (for AI service)
*   **File Uploads:** `multer`, `@nestjs/platform-express`
*   **Resume Parsing:** `pdf-parse`, `mammoth`
*   **Email:** Nodemailer (`nodemailer`, `@types/nodemailer`)
*   **Environment Variables:** `@nestjs/config`
*   **Unique IDs:** `uuid`
*   **Runtime:** Node.js (Specify version, e.g., v18+)
*   **Package Manager:** npm or yarn

## 🚀 Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/) (LTS version recommended, e.g., v18+)
*   [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
*   [PostgreSQL](https://www.postgresql.org/) database server running.
*   An account and API Token from [Hugging Face](https://huggingface.co/settings/tokens) (for AI resume feedback).
*   Email account (e.g., Gmail with an "App Password" if using 2FA, or other SMTP provider) for sending emails.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd <repository-folder>
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

### Environment Variables

1.  This project uses a `.env` file for configuration. Based on our discussion, create a file named `.env` in the `src` directory (`src/.env`).
    *(Note: If you prefer it in the root, change the `envFilePath` in `src/app.module.ts`)*

2.  Add the following variables to your `src/.env` file, replacing the placeholder values with your actual credentials and settings:

    ```dotenv
    # Application Environment
    NODE_ENV=development # or production

    # Database Credentials
    DB_TYPE=postgres
    DB_HOST=localhost
    DB_PORT=5432
    DB_USERNAME=postgres # Your PostgreSQL username
    DB_PASSWORD=admin123 # Your PostgreSQL password
    DB_DATABASE=jobportal # Your PostgreSQL database name

    # JWT Configuration
    JWT_SECRET=your-very-strong-and-secret-jwt-key # Choose a strong, random secret

    # Email Configuration (Example using Gmail)
    # For Gmail, enable 2FA and generate an "App Password"
    EMAIL_SERVICE=gmail
    EMAIL_USER=your-email@gmail.com
    EMAIL_PASS=your-gmail-app-password

    # Application Base URL (for constructing links in emails)
    BASE_URL=http://localhost:3000 # Adjust port if needed

    # AI Configuration (Hugging Face)
    HF_API_TOKEN=hf_YourSecretHuggingFaceTokenHere # Your Hugging Face Read Token
    HF_MODEL_ID=google/flan-t5-large # Or mistralai/Mistral-7B-Instruct-v0.1, etc.

    # Optional Frontend URL (for links in emails)
    # FRONTEND_LOGIN_URL=http://localhost:3001/login
    ```

3.  **IMPORTANT:** Add `src/.env` (or `.env` if in root) to your `.gitignore` file to prevent committing sensitive credentials.

    ```gitignore
    # .gitignore
    node_modules/
    dist/
    src/.env
    .env
    ```

### Database Setup

1.  Ensure your PostgreSQL server is running.
2.  Create a database named `jobportal` (or whatever you specified in `DB_DATABASE`).
3.  When you first run the application in development (`NODE_ENV=development`), TypeORM's `synchronize: true` setting will attempt to automatically create the necessary tables based on your entities.

### Running the Application

1.  **Development Mode (with Hot-Reloading):**
    ```bash
    npm run start:dev
    ```
    The application will start (usually on `http://localhost:3000`) and automatically restart when you save file changes.

2.  **Production Mode:**
    ```bash
    # 1. Build the application
    npm run build

    # 2. Start the optimized version
    npm run start:prod
    ```
    *Remember to set `NODE_ENV=production` and configure `synchronize: false` in `app.module.ts` or TypeORM config, using migrations for schema changes in production.*

### Admin User Setup (Manual)

This application does not have an admin registration endpoint. To create the first admin user:

1.  **Generate Password Hash:**
    *   Create a temporary script (e.g., `hash-password.js`):
        ```javascript
        const bcrypt = require('bcrypt');
        const saltRounds = 10; // Match your app's setting
        const plainPassword = 'YourChosenAdminPassword'; // Set a strong password
        bcrypt.hash(plainPassword, saltRounds).then(hash => {
          console.log("Plain:", plainPassword);
          console.log("Hash:", hash); // Copy this hash
        });
        ```
    *   Run `node hash-password.js`.
    *   Copy the generated hash.
    *   Delete the script file.

2.  **Insert into Database:** Connect to your PostgreSQL database and run:
    ```sql
    INSERT INTO users (name, email, password, role, status, "createdAt", "passwordChangedAt")
    VALUES ('Admin User', 'admin@jobportal.com', 'PASTE_GENERATED_HASH_HERE', 'admin', 'active', NOW(), NOW());
    ```
    *(Replace placeholders with your details and the copied hash)*

You can now log in as this admin using the `POST /auth/login` endpoint.

## ⚙️ API Endpoints Overview

The application exposes RESTful API endpoints grouped by functionality. Authentication (Bearer Token) is required for most endpoints, and role-based access control is applied where necessary.

*   **Auth (`/auth`)**: `register/employee`, `register/employer`, `verify-email/complete`, `login`, `logout`, `forgot-password`, `reset-password`, `change-password`
*   **Users (`/users`)**: `admin/pending-employers`, `admin/pending-employer/:id`, `admin/approve-employer/:id` (Admin only); `test-update-password` (Debug)
*   **Employee (`/employee`)**: `profile` (GET, PUT, PATCH), `resume` (POST), `resume/info` (GET), `resume/download` (GET), `resume/feedback` (POST, GET), `education` (POST, GET), `education/:id` (PATCH, DELETE), `projects` (POST, GET), `projects/:id` (PATCH, DELETE)
*   **Jobs (`/jobs`)**: (POST - Employer), (GET - All Users), `search/any` (GET - All Users), `recommendations/my` (GET - Employee), `my/posted` (GET - Employer), `:id` (GET - All Users), `:id` (PATCH - Employer), `:id` (DELETE - Employer)
*   **Job Applications (`/applications`)**: `job/:jobId` (POST - Employee), `interest/job/:jobId` (POST - Employee), `my` (GET - Employee), `job/:jobId` (GET - Employer), `:id` (GET - Employee/Employer), `:id/status` (PATCH - Employer), `:id/notes` (PATCH - Employee)

*(Refer to the Postman collection or source code (`*.controller.ts` files) for detailed request/response structures and required roles.)*

## 🧪 Testing

*(Section for testing information - currently TBD)*

No automated tests are included in this version. To test:

*   Use the provided Postman commands (or import a collection if provided separately).
*   Manually test API endpoints after running the application.

## 🚀 Future Improvements

*   **Database Migrations:** Replace `synchronize: true` with TypeORM migrations for safe production schema updates.
*   **Redis:** Implement Redis for the token deny list for scalability and persistence.
*   **Asynchronous Processing:** Use queues (e.g., BullMQ) for long-running tasks like AI feedback generation and email sending.
*   **Testing:** Add comprehensive unit, integration, and E2E tests.
*   **Advanced AI Features:** Implement Resume Tailoring, Skill Gap Analysis, Interview Prep, etc.
*   **Admin Module:** Build dedicated APIs and potentially a UI for admin tasks (user management, employer approval queue, analytics).
*   **Scalability:** WebSocket scaling considerations, database indexing optimization.
*   **Frontend:** Develop a user interface (React, Vue, Angular, etc.).
*   **Containerization:** Dockerize the application for easier deployment.
*   **Enhanced Search:** Implement more robust full-text search capabilities in PostgreSQL.
*   **Notifications:** Implement real-time notifications (WebSocket/SSE) for events like new applications, status changes, etc.
