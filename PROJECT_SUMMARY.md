# SmartRoute - Project Summary

## Overview
**SmartRoute** is a comprehensive, full-stack logistics and route-optimization platform designed to manage the entire lifecycle of delivery operations. It bridges the gap between administrators managing fleets, senders submitting orders, and drivers executing deliveries in the field.

## Architecture & Technology Stack
The platform is built using a modern, scalable three-tier architecture:

1. **Backend (FastAPI & PostgreSQL)**
   - **Framework:** FastAPI (Python 3.11+)
   - **Database:** Supabase (PostgreSQL)
   - **Authentication:** Custom JWT-based authentication using direct `bcrypt` hashing.
   - **Hosting:** Deployed live on Railway (`smartroute-production.up.railway.app`).

2. **Web Dashboards (Next.js & React)**
   - **Admin Web:** A command center for administrators to oversee drivers, vehicles, and system-wide analytics.
   - **Sender Web:** A portal for clients/senders to create delivery orders and track their status.
   - **Styling:** Tailwind CSS with modern UI/UX principles.
   - **Hosting:** Deployed live on Vercel.

3. **Mobile Driver App (React Native & Expo)**
   - **Framework:** React Native via Expo.
   - **Key Features:** Live Google Maps integration, background GPS location tracking, and dynamic route management.
   - **Distribution:** Standalone Android APK compiled via Expo Application Services (EAS).

## Key Features
- **Real-Time Tracking:** Background location tracking allows the backend to monitor driver positions continuously.
- **Route Management:** Intelligent sorting of stops (Pickups, Deliveries, Returns) with dynamic UI updates upon stop completion.
- **Responsive Mobile UI:** A fully responsive, scalable UI system in React Native that perfectly fits any screen size (from small phones to large tablets) without distortion.
- **Unified Ecosystem:** All three applications (Backend, Web, Mobile) communicate seamlessly in real-time, providing a single source of truth for the entire logistical operation.
