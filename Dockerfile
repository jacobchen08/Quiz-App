# Builds the React frontend, then serves it from the FastAPI backend as a single web service.

# ---- 1. Build the frontend ----
FROM node:22-slim AS frontend
WORKDIR /app/my-react-app
COPY my-react-app/package.json my-react-app/package-lock.json ./
RUN npm ci
COPY my-react-app/ ./
RUN npm run build

# ---- 2. Run the backend ----
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY --from=frontend /app/my-react-app/dist my-react-app/dist

WORKDIR /app/backend
# Hosting services tell the app which port to use through $PORT
CMD ["sh", "-c", "uvicorn apicall:app --host 0.0.0.0 --port ${PORT:-8000} --no-access-log"]
