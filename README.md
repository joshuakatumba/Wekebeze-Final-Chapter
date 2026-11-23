# Wekebeze — Cancer Awareness, Knowledge & Support

Bilingual (English & Luganda) breast and cervical cancer awareness platform built with **Django 5.2 + DRF + LangGraph/LangChain + React 18 (Vite) + PostgreSQL + Docker**.

## Core Features
- **Cancer Awareness Hub:** Database-driven bilingual educational categories and articles.
- **Intelligent AI Assistant:** LangGraph + LangChain RAG assistant with SSE streaming, approved-only medical knowledge retrieval, source citations, persistent conversations, and urgent-symptom safety escalation.
- **Guided Educational Chat:** Decision-tree learning sessions with logical `node_id` navigation and JSON export.
- **Knowledge Quizzes:** Server-side graded assessments with explanations and personal attempt history.
- **Screening Center Locator:** Ugandan screening facilities with district filters, geolocation proximity search, and Leaflet map view.
- **Admin Content & Visibility Control:** Upload images & medical guidelines, approve/index AI knowledge, and toggle module/content visibility.
- **Concurrency Safety:** Distributed Redis mutexes, bounded semaphores, and PostgreSQL row-level locks (`select_for_update`).

## Run Locally with Docker
```bash
docker compose -p wekebeze up -d --build
```
- **Frontend:** http://localhost:3005
- **Backend API:** http://localhost:8005/api/v1/core/health/

## Deploy to Render
1. Push this repository to GitHub using `./auto-push.sh "feat: initial release"`.
2. In the Render Dashboard, choose **New → Blueprint** and select your GitHub repository.
3. Render automatically provisions `wekebeze-db`, `wekebeze-api`, and `wekebeze-web` from `render.yaml`.
4. (Optional) Add your `LLM_API_KEY` in the `wekebeze-api` environment variables on Render.

