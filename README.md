Here is the English README.md content, ready to copy:

```markdown
# 🌸 OrchidMart - E-Commerce Platform

OrchidMart is a modern e-commerce platform designed for selling orchid plants and other gardening supplies. The platform is built with a monorepo architecture that separates the frontend (user-facing store and admin panel) from the backend (high-performance API services).

---

## 🚀 Key Features

- **Admin Dashboard**: Daily sales analytics summary, order status, low-stock alerts, and order management.
- **Product & Inventory Management**: Orchid product catalog system with automatic stock control.
- **Secure Authentication**: Registration and login using JWT (JSON Web Token) with hashed password storage (`bcrypt`).
- **Payment Integration**: Automated payment system using the Midtrans payment gateway.
- **Shipping Cost Calculation**: RajaOngkir API integration for real-time shipping cost calculation.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS & Framer Motion (for premium animations)
- **Icons**: Lucide React
- **State Management**: Zustand / React Context

### Backend
- **Language**: Go (Golang)
- **Framework**: Gin Gonic (Web Framework)
- **Database**: PostgreSQL (GORM / ORM)
- **Cache**: Redis
- **Authentication**: JWT & Go-Bcrypt

---

## 📂 Project Structure

```text
ecommerce-kp/
├── backend/            # Backend API application (Go)
│   ├── cmd/server/     # Server entry point (main.go)
│   └── internal/       # Organized business logic (handler, service, repository, model, dto)
├── frontend/           # Web application & Admin Panel (Next.js)
│   ├── src/app/        # Next.js App Router routing structure
│   ├── src/components/ # Reusable UI components (Navbar, Footer, etc.)
│   └── src/lib/        # API helpers, fetcher configuration, & real-time
├── docker-compose.yml  # PostgreSQL & Redis for local development
└── README.md           # Project documentation
```

---

## ⚙️ Local Development Guide

### Prerequisites
Make sure you have installed:
- Docker & Docker Compose
- Go (latest version)
- Node.js & npm

### Steps to Run

1. **Clone the Repository & Enter the Project Folder**
   ```bash
   git clone https://github.com/blitzz-berry/abah-orchid.git
   cd abah-orchid
   ```

2. **Run Database & Cache (Docker)**
   Start PostgreSQL and Redis containers in the background:
   ```bash
   docker compose up -d postgres redis
   ```

3. **Run the Backend API (Go)**
   Navigate to the backend directory, then run the server:
   ```bash
   cd backend
   go run ./cmd/server
   ```
   *The backend will run on `http://localhost:8080`*

4. **Run the Frontend (Next.js)**
   Open a new terminal in the project root, navigate to the frontend directory, install dependencies, then start the development server:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *The frontend will run on `http://localhost:3000`*

---

## 🧪 Testing (Whitebox Testing)

This project includes comprehensive unit testing on the backend side to internally test business logic, middleware, and payment module functionality.

Run all tests with the following command:
```bash
cd backend
go test -v ./...
```

To view the code coverage percentage (*coverage report*):
```bash
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

---

## 📝 Commit Guidelines (Conventional Commits)

To keep a clean change history on GitHub, get used to using the **Conventional Commits** format:
- `feat: ...` for new feature additions (e.g., `feat: add midtrans payment trigger`)
- `fix: ...` for bug fixes (e.g., `fix: resolve token validation crash`)
- `docs: ...` for documentation changes (e.g., `docs: update readme guide`)
- `style: ...` for code formatting (e.g., running gofmt / prettier)
```

Simply copy the content above into a file named `README.md` in your repository.
