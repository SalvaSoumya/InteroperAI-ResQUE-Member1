# InteroperAI-ResQUE
## Intelligent Disaster Data Interoperability and Emergency Response Coordination Platform

**Member 1 — Disaster Data Integration**

**Developed by:** Salva Soumya and Gilledi Santhosh

---

## 🌐 Live Deployment

| Component | Deployment Link |
|---|---|
| Member 1 Frontend | [Open Application](https://interoper-ai-res-que-member1-29p4.vercel.app/) |
| Member 1 Backend API | [Open Backend](https://interoperai-member1-api.onrender.com) |
| Member 1 API Documentation | [Swagger UI](https://interoperai-member1-api.onrender.com/docs) |
| Member 2 Frontend | [Open Application](https://interoper-ai-res-que-member2.vercel.app/) |
| Member 2 Backend API | [Open Backend](https://interoperai-member2-api.onrender.com) |
| Member 2 API Documentation | [Swagger UI](https://interoperai-member2-api.onrender.com/docs) |

## 📌 Project Overview

InteroperAI-ResQUE is a disaster-response data interoperability platform designed to connect heterogeneous disaster datasets with emergency assessment services.

Member 1 is responsible for receiving, validating, standardizing, and preparing disaster-related datasets for exchange with Member 2. It converts source fields into a canonical disaster-response schema so that downstream services can work with a more consistent data structure.

## 🎯 Objectives

- Accept disaster-related datasets through a web interface.
- Validate uploaded data and inspect available fields.
- Map source fields to canonical disaster-response fields.
- Standardize and derive fields when suitable source information is available.
- Track integration jobs and their processing status.
- Transfer standardized files to Member 2 through a REST API.
- Support traceable, reliable data exchange between the two system components.

## ✨ Key Features

- **Dataset Upload:** Upload supported disaster datasets, including CSV files.
- **Data Validation:** Inspect incoming fields and identify data-quality issues.
- **Schema Mapping:** Map source fields to canonical disaster-response fields.
- **Data Standardization:** Transform source data into a consistent representation.
- **Integration Job Tracking:** Track job identifiers and integration status.
- **API-Based Exchange:** Send standardized output to Member 2.
- **Interactive Dashboard:** Access upload, validation, integration, job status, and results views.

## 🏗️ System Architecture

```text
                    USER
                      |
                      v
          React + Vite Frontend
                 (Vercel)
                      |
               REST API Requests
                      |
                      v
             FastAPI Backend
                 (Render)
                      |
          +-----------+-----------+
          |           |           |
          v           v           v
       Upload      Validation   Standardization
                                  and Mapping
                                      |
                                      v
                              Integration Job
                                      |
                                      v
                            HTTP File Transfer
                                      |
                                      v
                              Member 2 Backend
```

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| React | Interactive frontend interface |
| Vite | Frontend development and production build |
| Tailwind CSS | Responsive UI styling |
| Axios | HTTP communication between frontend and backend |
| Python | Backend application logic |
| FastAPI | REST API development |
| Uvicorn | ASGI server for FastAPI |
| Pandas | Tabular data processing and transformation |
| HTTPX | Backend-to-backend API communication |
| Vercel | Frontend deployment |
| Render | Backend deployment |

## 🔄 Implementation and Working

### 1. Dataset Upload

The user uploads a disaster-related dataset through the Member 1 frontend. The backend receives the file and prepares it for validation and processing.

### 2. Data Validation

The system examines the uploaded data and its available fields. Validation helps identify data that may need correction or additional handling before integration.

### 3. Canonical Schema Mapping

Source fields are mapped to canonical disaster-response fields. Where suitable source fields are available, the application can derive or combine values to construct standardized fields.

### 4. Data Standardization

The application transforms the source dataset into a standardized structure intended for downstream disaster assessment.

### 5. Integration Job Creation

The application tracks the integration operation using job information and status details so that users can follow the processing workflow.

### 6. Transfer to Member 2

The standardized dataset is sent to Member 2's receiving endpoint using an HTTP `POST` request with `multipart/form-data`.

**Receiving endpoint:**

`POST https://interoperai-member2-api.onrender.com/api/receive-file`

The file is sent using the required form field `file`. The receiving API also documents optional headers for source-system identification, client identification, and request correlation.

### 7. Result Verification

After transfer, the user can check the integration status in Member 1 and inspect the ingestion and assessment information provided by Member 2.

## 🔗 Integration Between Member 1 and Member 2

The integration connects two independently deployed application components:

- **Member 1:** Responsible for dataset ingestion, validation, standardization, and transfer.
- **Member 2:** Responsible for receiving the standardized dataset and performing the disaster-assessment workflow supported by its backend.

This separation allows data integration and downstream assessment to be developed and deployed independently.

## 🚀 Local Setup

### Prerequisites

- Python
- Node.js and npm
- Git

### Backend Setup

Open a terminal in the repository root and run:

```powershell
cd backend
python -m pip install -r requirements-render.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Local backend URLs:

- API: `http://127.0.0.1:8000`
- Swagger documentation: `http://127.0.0.1:8000/docs`
- Health endpoint: `http://127.0.0.1:8000/health`

### Frontend Setup

Open a separate terminal:

```powershell
cd frontend
npm install
npm run dev
```

Vite usually starts at `http://localhost:5173`. If that port is occupied, it may select another available port.

### Frontend Environment Variable

For the deployed frontend, configure the following Vercel environment variable:

```text
VITE_API_BASE_URL=https://interoperai-member1-api.onrender.com/api/v1
```

The local development API URL is configured separately in the frontend code.

## ☁️ Deployment Configuration

### Frontend — Vercel

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Environment variable:

```text
VITE_API_BASE_URL=https://interoperai-member1-api.onrender.com/api/v1
```

### Backend — Render

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Build Command | `pip install -r requirements-render.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

Configure the following environment variable in the Member 1 Render service:

```text
MEMBER2_API_URL=https://interoperai-member2-api.onrender.com
```

Keep environment variables and secrets out of source control. Local `.env` values do not automatically configure the Render service.

## 🔍 Testing and Verification

1. Open the deployed Member 1 frontend.
2. Upload a supported sample dataset.
3. Review validation and schema mapping information.
4. Start the standardization and transfer operation.
5. Confirm that the transfer request completes successfully.
6. Open Member 2 and inspect its ingestion history and available assessment results.

A successful HTTP response confirms that the receiving endpoint accepted the request. Check the downstream processing status as well to confirm that the workflow completed.

## ⚠️ Operational Notes

- Free Render services may sleep after inactivity, causing the first request to take longer.
- Verify backend logs when an integration request fails.
- Keep local `.env` files, credentials, virtual environments, backup files, and unnecessary generated artifacts out of Git.
- Use representative sample datasets for testing before processing larger files.

## 👥 Team

**Salva Soumya and Gilledi Santhosh**

*InteroperAI-ResQUE — Intelligent Disaster Data Interoperability and Emergency Response Coordination Platform*
