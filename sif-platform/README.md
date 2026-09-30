# OIL SIF Precursor Detection (SIH 26165) - Backend

Decision-support tool for HSE. AI results are advisory; HSE personnel make the final call.

## Run
    cd backend
    pip install -r requirements.txt
    cp .env.example .env   # optional; SQLite is the default
    uvicorn app.main:app --reload
API docs: http://localhost:8000/docs. Demo data loads on first start.

## Demo logins
- Manager: manager@oilindia.com / Manager@123
- HSE Admin: hseadmin@oilindia.com / Admin@123

## Flow
Report -> POST /api/reports (NLP + SIF + rule mapping run automatically) -> HSE dashboard (/api/dashboard/*) -> HSE review (PUT /api/reviews/{id}).
Batch: POST /api/reports/batch with sample_reports.csv (admin only).

## Plug in a real model
Save a scikit-learn pipeline (text in, predict_proba out) to backend/models/sif_model.joblib,
or edit predict_sif() in app/ml_service.py. Nothing else changes.

## Database
Tables are created from the models in app/main.py: users, reports, ai_analysis, hse_reviews.
For PostgreSQL, set DATABASE_URL.

## Frontend (React + Vite + Tailwind + Recharts)
    cd frontend
    npm install
    npm run dev
Open http://localhost:5173 (backend must run on port 8000).

## Demo flow
1. Log in as Manager, submit: "An open electrical panel was observed near the maintenance area. The panel was energized and no barricade was placed around the area."
2. Watch the processing steps, see the AI analysis.
3. Log out, log in as HSE Admin, open the dashboard, open the new report, add a review and action.
