# PRHOMZ AI DESIGNER - Comprehensive Handover Documentation

## 1. Project Vision
PRHOMZ AI Designer is a high-end spatial intelligence platform that bridges the gap between AI-generated inspiration and real-world execution. It empowers users to visualize their dream interiors and instantly source the products required to build them.

---

## 2. User Roles
- **Client**: Homeowners or enthusiasts looking for design inspiration and shopping links.
- **Designer**: Professional interior designers using the tool for rapid prototyping and client mood boards.
- **Admin**: System administrators overseeing platform health, analytics, and partner integrations.

---

## 3. User Stories

### 3.1. Core Experience (Remodeling)
- **US.1**: As a Client, I want to upload a photo of my existing room so that the AI can use it as a base for transformations.
- **US.2**: As a Client, I want to select from curated design presets (e.g., Japandi, Industrial) so that I can see professional results without writing complex prompts.
- **US.3**: As a Client, I want to provide specific text instructions (e.g., "add a blue velvet sofa") to refine the AI's output to my exact needs.
- **US.4**: As a Client, I want to set a furnishing budget so that the AI biases its product suggestions toward items I can afford.

### 3.2. Sourcing & Shopping
- **US.5**: As a Client, I want to "Shop the Look" of a generated image so that I can identify the specific furniture and decor shown.
- **US.6**: As a Client, I want to choose my preferred shopping source (Shopify, Amazon, Wayfair, IKEA) to ensure the products found are from stores I trust.
- **US.7**: As a Client, I want to see "Source Accurate" pricing and direct buy links so that I can purchase items immediately.
- **US.8**: As a Client, I want to "Swap" a suggested item for an alternative if the first suggestion doesn't fit my taste.

### 3.3. Archiving & Assistance
- **US.9**: As a Client, I want to save my favorite designs to a personal gallery so that I can access them across different sessions.
- **US.10**: As a Client, I want to chat with an AI Interior Assistant to get expert advice on spatial layout, lighting, and color theory.

### 3.4. Administration
- **US.11**: As an Admin, I want to view a dashboard of system-wide analytics (total renders, revenue potential) to monitor platform growth.
- **US.12**: As an Admin, I want to sync the platform with the Shopify Admin API to ensure the product catalog is up to date.

---

## 4. Functional Requirements

### 4.1. AI Image Processing
- The system must maintain the architectural perspective and structural integrity of the uploaded photo during transformations.
- Transformations must be completed within an average of 15-20 seconds.

### 4.2. Spatial Artifact Scanning
- The AI must extract at least 3-5 key furniture/decor items from any generated scene.
- Extracted items must include metadata: Name, Description, Estimated Price, and Color options.

### 4.3. Inventory Sync
- The system must attempt a "Strict Match" against the Shopify database using product titles.
- If a direct match fails, the system must provide a "Search Referral" link to the selected retailer.

---

## 5. Technical Architecture (Summary)

### 5.1. Frontend
- **React 19 / TypeScript**: Functional components with hooks.
- **Tailwind CSS v4**: Utility-first styling with a custom "Google Dark" theme.
- **Framer Motion**: (Proposed for next phase) for smooth transitions between modes.

### 5.2. AI Services (Google Gemini)
- **Image Generation**: `gemini-2.5-flash-image` (Supports aspect ratios and high-fidelity textures).
- **Reasoning/Chat**: `gemini-3.1-pro-preview` (Used for the Assistant).
- **Data Extraction**: `gemini-3-flash-preview` (Used for JSON-based product extraction).

### 5.3. External Integrations
- **Shopify Admin API**: Used for inventory retrieval and price verification.

---

## 6. UI/UX Design Principles
- **Minimalist Luxury**: High contrast, generous spacing, and subtle borders.
- **Dark Mode Default**: To make interior design photos "pop" and reduce eye strain.
- **Feedback Loops**: Real-time timers and progress indicators during AI generation to manage user expectations.
- **Mobile First**: Fully responsive layout that adapts from a sidebar-based desktop view to a bottom-nav/hamburger mobile view.

---

## 7. Handover Checklist for Developers
1.  **API Keys**: Ensure `GEMINI_API_KEY` is set in the environment.
2.  **Shopify Config**: Update `SHOPIFY_STORE_DOMAIN` and `ACCESS_TOKEN` in `services/dataService.ts` for the target store.
3.  **Persistence**: Currently uses `LocalStorage`. Needs migration to a database (Firebase/Postgres) for multi-device support.
4.  **Image Storage**: Currently uses `base64`. Needs migration to a cloud storage provider (S3/GCS) to avoid storage limits and improve performance.
5.  **Error Handling**: Implement the `handleFirestoreError` pattern if migrating to Firebase as per the system guidelines.

---

## 8. Future Roadmap
- **AR View**: Allow users to place sourced 3D models into their real rooms using mobile AR.
- **Collaborative Boards**: Allow Designers and Clients to comment on and edit the same design iterations.
- **Pro Subscriptions**: Integration with Stripe for unlimited AI renders and premium design presets.
