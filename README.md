# SentinalIQ — Enterprise SIEM / SOC Platform

A full-stack Security Information and Event Management (SIEM) / Security Operations Center (SOC) dashboard built with React 19, TypeScript, Python FastAPI, and SQLite.

![SentinalIQ Dashboard](https://via.placeholder.com/800x400/0a0e1a/06b6d4?text=SentinalIQ+SOC+Platform)

## Features

- **Security Dashboard** — Real-time security metrics, charts, and live activity feed
- **Log Explorer** — Searchable, filterable security event log viewer with pagination
- **Incident Management** — Full lifecycle management (open → investigating → resolved)
- **EDR / XDR** — Endpoint detection and response with health metrics and risk scoring
- **WAF Monitor** — Web application firewall rule management and live traffic monitoring
- **Threat Intelligence** — IOC management, threat actor tracking, CSV/JSON import
- **Data Ingestion** — URL scanning and file upload for threat intel import
- **AI Copilot** — Floating chat assistant with context-aware security responses
- **Command Palette** — Ctrl+K quick navigation and search
- **Dual Theme System** — Dark cyberpunk SOC mode and clean light mode
- **Real-Time Updates** — WebSocket-powered live alerts and notifications
- **Authentication** — JWT-based auth with login, register, and protected routes

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Vite, React Router v6 |
| **State** | React Context (Auth, Theme, Notifications, Global State, Toasts) |
| **Charts** | Recharts |
| **Animation** | Framer Motion |
| **Icons** | Lucide React |
| **Backend** | Python FastAPI |
| **Database** | SQLite (via SQLAlchemy) |
| **Auth** | JWT (python-jose) |
| **Real-Time** | WebSocket (native) |
| **Styling** | CSS Custom Properties (Design Token System) |

## Project Structure

```
/backend/
  server.py           # FastAPI server with all REST endpoints + WebSocket
  models.py           # Database models (User, Incident, LogEvent, ThreatIntel, etc.)
  auth.py             # JWT authentication utilities
  seed.py             # Seed data generator
  requirements.txt    # Python dependencies

/frontend/
  src/
    App.tsx            # Main app with routing and layout
    main.tsx           # Entry point
    
    contexts/
      AuthContext.tsx       # Authentication state
      ThemeContext.tsx      # Dark/Light theme
      NotificationContext.tsx  # WebSocket-powered notifications
      ToastContext.tsx      # Toast notifications
      GlobalStateContext.tsx  # Dashboard state
    
    components/
      layout/
        Header.tsx          # Top navigation bar with notification center
        Sidebar.tsx         # Collapsible sidebar navigation
        CommandPalette.tsx  # Ctrl+K command palette
      copilot/
        Copilot.tsx         # Floating AI chat assistant
    
    pages/
      Landing.tsx      # Public marketing page with 3D particle background
      Login.tsx        # User login
      Register.tsx     # User registration
      Dashboard.tsx    # Security overview with widgets and charts
      Logs.tsx         # Log explorer
      Incidents.tsx    # Incident management
      EDR.tsx          # Endpoint detection & response
      WAF.tsx          # WAF monitor & live traffic
      Threats.tsx      # Threat intelligence
      Ingestion.tsx    # Data ingestion & URL scanning
      Settings.tsx     # Theme picker & account settings
    
    styles/
      tokens.css      # Design token system (CSS custom properties)
      global.css      # Global component styles
```

## Setup Instructions

### Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.10+ and **pip**

### 1. Backend Setup

```bash
cd backend

# Install dependencies
pip install fastapi uvicorn[standard] sqlalchemy python-jose[cryptography] passlib[bcrypt] python-multipart websockets aiosqlite

# Seed the database
python seed.py

# Start the server
python server.py
```

The backend runs on **http://localhost:8000** with auto-reload enabled.

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend runs on **http://localhost:5173** and proxies API requests to the backend.

### 3. Demo Credentials

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Admin |
| `analyst` | `analyst123` | Analyst |
| `soc_lead` | `soc123` | SOC Lead |

## API Endpoints

### Authentication
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Sign in
- `POST /api/auth/refresh` — Refresh JWT token
- `GET /api/auth/me` — Current user info

### Dashboard
- `GET /api/dashboard/stats` — Security metrics
- `GET /api/dashboard/attack-vectors` — Attack vector breakdown
- `GET /api/dashboard/severity-breakdown` — Severity distribution
- `GET /api/dashboard/recent-activity` — Latest events
- `GET /api/dashboard/incident-timeline` — Incident timeline

### Incidents
- `GET /api/incidents` — List with filters
- `GET /api/incidents/:id` — Get details
- `PATCH /api/incidents/:id` — Update status/severity

### Logs
- `GET /api/logs` — List with filters and pagination

### EDR
- `GET /api/endpoints` — List endpoints
- `GET /api/endpoints/:id` — Endpoint details

### WAF
- `GET /api/waf/rules` — List WAF rules
- `PATCH /api/waf/rules/:id` — Toggle rule

### Threats
- `GET /api/threats` — List IOCs
- `POST /api/threats/import` — Import from file

### Other
- `GET /api/notifications` — User notifications
- `POST /api/notifications/:id/read` — Mark read
- `POST /api/copilot/chat` — AI assistant
- `POST /api/ingestion/scan-url` — URL security scan
- `WS /ws` — Real-time event stream

## Theme System

The entire UI is themed through CSS custom properties under `[data-theme="dark"]` and `[data-theme="light"]` attributes on the `<html>` element. No component-level theme branching — just variable swaps.

### Dark Theme (Cyberpunk SOC)
- Neon cyan/pink/purple glow accents
- Glassmorphism panels
- CRT scanline overlay
- Glowing borders and shadows

### Light Theme (Clean Minimal)
- Soft neutral backgrounds
- Muted semantic accent colors
- No neon glow or scanlines
- Clean shadows and borders

## License

MIT
