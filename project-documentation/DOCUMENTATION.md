# PRHOMZ AI DESIGNER - Technical Documentation

## 1. Project Overview
**PRHOMZ AI DESIGNER** is a premium, AI-powered interior design and visualization platform. It allows users to upload photos of their spaces and apply photorealistic transformations using generative AI. The platform also features an "AI Sourcing Nexus" that identifies furniture and decor within generated images and matches them to real-world inventory (Shopify, Amazon, Wayfair, IKEA).

---

## 2. Tech Stack
- **Frontend Framework**: React 19 (TypeScript)
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS v4
- **AI Engine**: Google Gemini API (`@google/genai`)
  - `gemini-2.5-flash-image`: For image generation and remodeling.
  - `gemini-3.1-pro-preview`: For the AI Interior Assistant (Chat).
  - `gemini-3-flash-preview`: For spatial artifact scanning and product extraction.
- **Icons**: Lucide React
- **Data Persistence**: LocalStorage (Prototype) / Shopify Admin API (Inventory Sync).

---

## 3. System Architecture

### 3.1. Component Hierarchy
- `App.tsx`: Root component managing global state (User, Mode, Gallery).
- `components/Navigation.tsx`: Sidebar navigation with role-based access control.
- `components/Auth.tsx`: Passwordless email-based authentication simulation.
- `components/Remodeler.tsx`: Core engine for uploading photos and applying AI transformations.
- `components/Assistant.tsx`: Real-time chat interface with the AI Designer.
- `components/Gallery.tsx`: Archive of all generated iterations.
- `components/ShopLookModal.tsx`: The "Sourcing Nexus" for product extraction.
- `components/AdminDashboard.tsx`: Business intelligence and system oversight.

### 3.2. Services Layer
- `services/geminiService.ts`: Encapsulates all interactions with the Gemini API.
- `services/dataService.ts`: Handles Shopify API integration and fallback inventory management.

---

## 4. Core Features & Logic

### 4.1. The Remodeler (Image-to-Image)
- **Input**: User uploads a base64 image and provides a text instruction or selects a design preset.
- **Processing**: Uses `remodelImage` service. It prepends industry-specific constraints to the prompt to ensure high-end architectural results.
- **Quota Tracking**: Implements a 2-render per 24h limit for "Client" roles, tracked via `renderTimestamps` in the user object.

### 4.2. Sourcing Nexus (Spatial Scan)
- **Extraction**: When a user clicks "Shop Furnishings", the `generateProductList` service sends the image to Gemini 3 Flash.
- **Schema Enforcement**: The AI returns a structured JSON array of items (name, description, price, colors).
- **Inventory Matching**: The `findMatchingInventory` function performs a "STRICT SOURCE SYNC". It queries the Shopify Admin API for titles matching the AI's findings. If no match is found, it falls back to a local inventory or generates external referral links.

### 4.3. AI Assistant
- **Context**: Maintains chat history to provide consistent design advice.
- **Formatting**: Custom parser in `Assistant.tsx` handles markdown-style bolding and bullet points for professional presentation.

---

## 5. Data Models (`types.ts`)
- `UserAccount`: Defines user identity, roles (Client, Designer, Admin), and usage stats.
- `GeneratedImage`: Stores the result of an AI transformation, including the prompt and any "saved" products.
- `ProductItem`: Represents a piece of furniture with Shopify IDs and sync status.

---

## 6. Development Phases (Handover Roadmap)

### Phase 1: Foundation & Core AI (Completed)
- Setup Vite/React/Tailwind environment.
- Implement Gemini Image-to-Image pipeline.
- Create design presets and instruction engine.

### Phase 2: Sourcing & Integration (Completed)
- Integrate Shopify Admin API for real-time inventory matching.
- Build the "Sourcing Nexus" modal with multi-source support (Amazon, Wayfair, etc.).
- Implement product "swapping" logic using AI suggestions.

### Phase 3: User Experience & Analytics (Completed)
- Build the Gallery for persistence.
- Develop the Admin Dashboard with simulated analytics and user management.
- Implement responsive navigation and "Google-inspired" dark mode UI.

### Phase 4: Production Hardening (Next Steps)
- **Database Migration**: Replace LocalStorage with a real backend (Firebase or PostgreSQL).
- **Image Hosting**: Move from base64 strings to S3/GCS buckets.
- **Real Auth**: Implement Firebase Auth or Auth0.
- **Shopify Webhooks**: Implement webhooks to keep inventory stock levels synced in real-time.

---

## 7. Environment & Setup
### Required Environment Variables
- `GEMINI_API_KEY`: Required for all AI features.

### Scripts
- `npm run dev`: Starts the development server.
- `npm run build`: Compiles the project for production.
- `npm run lint`: Runs TypeScript type checking.

---

## 8. Security & Constraints
- **API Key Safety**: The Gemini API key is managed via Vite's `define` and should be moved to a server-side proxy in production to prevent exposure.
- **CORS**: Shopify Admin API calls are handled with a fallback mechanism in `dataService.ts` to account for browser-side restrictions.
