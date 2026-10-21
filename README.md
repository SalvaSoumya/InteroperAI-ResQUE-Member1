InteroperAI-ResQUE — Member 1
Intelligent Disaster Data Interoperability and Emergency Response Coordination Platform
Team: Salva Soumya and Gilledi Santhosh

Member 1 is the data integration component of InteroperAI-ResQUE. It accepts disaster-related datasets, validates and standardizes their fields into a canonical disaster-response schema, and transfers the standardized data to Member 2 for assessment.
Live Deployment
Component	URL
Member 1 frontend (Vercel)	https://interoper-ai-res-que-member1-29p4.vercel.app/
Member 1 backend API (Render)	https://interoperai-member1-api.onrender.com
Member 1 API documentation	https://interoperai-member1-api.onrender.com/docs
Member 2 frontend (Vercel)	https://interoper-ai-res-que-member2.vercel.app/
Member 2 backend API (Render)	https://interoperai-member2-api.onrender.com
Member 2 API documentation	https://interoperai-member2-api.onrender.com/docs


Deployment URLs were recorded from the project deployment information. Free Render services may take time to wake after inactivity.

What it does
- Uploads disaster-related datasets.
- Validates incoming data and presents field-level mapping information.
- Standardizes source fields into a canonical disaster-response schema.
- Derives canonical fields when source data contains suitable component fields.
- Creates an integration job and tracks its status.
- Transfers standardized data to Member 2 using an HTTP API request.
- Provides job, validation, integration, and result views through the frontend.
Architecture
User
 |
 v
React + Vite frontend (Vercel)
 |  HTTP requests
 v
FastAPI backend (Render)
 |-- Upload and validation
 |-- Field mapping and standardization
 |-- Integration/job handling
 |
 | POST multipart/form-data
 v
Member 2 FastAPI API (Render)
 |  /api/receive-file
 v
File ingestion, assessment and results
Technology Stack
Layer	Technology	Role
Frontend	React	Interactive application interface
Frontend tooling	Vite	Development server and production build
Styling	Tailwind CSS	UI styling and layout
API client	Axios	Frontend-to-backend HTTP requests
Backend	FastAPI	REST API and application logic
ASGI server	Uvicorn	Runs the FastAPI service
Data processing	Python, Pandas	Reading and transforming tabular data
HTTP integration	HTTPX	Server-to-server API communication
Deployment	Vercel	Frontend hosting
Deployment	Render	Backend hosting


End-to-end workflow
1. Open the Member 1 frontend.
2. Upload a supported disaster dataset, such as a CSV file.
3. Review validation and source-to-canonical field mappings.
4. Proceed to the data integration section.
5. Select Standardize & Transfer to Member 2.
6. Member 1 standardizes the dataset and sends the resulting file to Member 2's POST /api/receive-file endpoint as multipart form data.
7. Review the transfer status in Member 1 and inspect the ingestion and assessment information in Member 2.
The exact set of fields standardized depends on the uploaded dataset and the mappings implemented in the application.
Local Development
Prerequisites
- Python installed
- Node.js and npm installed
- Git
1. Backend
From the repository root, open a terminal:
cd backend
python -m pip install -r requirements-render.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
If you use the full development dependency file in your local environment, install the dependencies appropriate to that environment instead.

Backend URLs when running locally:
- API: http://127.0.0.1:8000
- Swagger docs: http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/health
2. Frontend
Open a separate terminal:
cd frontend
npm install
npm run dev
Vite usually serves the frontend at http://localhost:5173. If that port is occupied, Vite may select another port.

For local development, the frontend API base URL defaults to http://127.0.0.1:8000/api/v1. For the deployed frontend, configure the Vercel environment variable:
VITE_API_BASE_URL=https://interoperai-member1-api.onrender.com/api/v1
Redeploy the frontend after changing a Vercel environment variable.
Deployment
Frontend — Vercel
- Root directory: frontend
- Framework preset: Vite
- Build command: npm run build
- Output directory: dist
- Environment variable: VITE_API_BASE_URL=https://interoperai-member1-api.onrender.com/api/v1
Backend — Render
- Root directory: backend
- Build command: pip install -r requirements-render.txt
- Start command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
- Set MEMBER2_API_URL in the Render environment to:
https://interoperai-member2-api.onrender.com
Keep secrets and local .env files out of Git. Render environment variables are configured separately from local environment files.
Integration Contract
Member 1 sends the standardized output to Member 2's receiving endpoint:
POST https://interoperai-member2-api.onrender.com/api/receive-file
Content-Type: multipart/form-data
Field: file
The receiving API also accepts optional headers such as X-Source-System, X-Client-Id, and X-Correlation-Id, as documented by Member 2's OpenAPI page.
Operational Notes
- Confirm both Render services are live before testing an end-to-end transfer.
- Free Render services can sleep after inactivity, so the first request may be slow.
- Do not commit .env files, credentials, virtual environments, backups, or generated data.
- Use small sample datasets while testing the integration flow.
- A successful HTTP transfer confirms receipt; inspect Member 2's response and logs to confirm downstream processing also completed.
Team
Salva Soumya and Gilledi Santhosh

InteroperAI-ResQUE — Intelligent Disaster Data Interoperability and Emergency Response Coordination Platform.
