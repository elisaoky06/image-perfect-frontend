# Medical Project

A full-stack web application designed for medical appointment booking and doctor search. Built with React on the frontend and Express + MongoDB on the backend.

## 🚀 Tech Stack

### Frontend
- **Framework:** React + TypeScript (via Vite)
- **Styling:** TailwindCSS
- **Components:** Radix UI / Shadcn UI
- **Routing:** React Router DOM
- **Data Fetching/State Management:** TanStack React Query
- **Forms:** React Hook Form

### Backend
- **Framework:** Express.js (Node.js)
- **Database:** MongoDB (via Mongoose)
- **Authentication:** JSON Web Tokens (JWT) & bcryptjs
- **File Uploads:** Multer

## 📋 Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed on your machine.
You will also need a MongoDB database (either local or MongoDB Atlas) setup.

## 🛠️ Setup & Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   - Copy `.env.example` to `.env` or `.env.development`.
   - Update the variables inside (like your MongoDB URI, JWT Secret, etc.).

## 🏃‍♂️ Running the app

You can run both the frontend and backend simultaneously using concurrently:

```bash
npm run dev
```

### Alternatively, run them separately:
- **Run the React frontend only:**
  ```bash
  npm run dev:client
  ```
- **Run the Express backend only:**
  ```bash
  npm run dev:server
  ```

## 🏗️ Build for production

```bash
npm run build
```

## 🧪 Testing

Run tests using Vitest:

```bash
npm run test
```

## 📝 Scripts Summary
- `npm run dev` - Runs both client and server development setups concurrently.
- `npm run build` - Compiles TypeScript and builds Vite client app for production.
- `npm run lint` - Runs ESLint to find code issues.
- `npm run test` - Runs unit tests via Vitest.
