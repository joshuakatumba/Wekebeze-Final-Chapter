# Full-stack multi-stage Dockerfile for single-service deployment (e.g. Render Web Service)
# Builds the React frontend and serves it alongside the Django API via Gunicorn + WhiteNoise.

FROM node:20-alpine AS frontend-build
WORKDIR /frontend
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY --from=frontend-build /frontend/dist /app/frontend_dist
RUN python manage.py collectstatic --noinput
EXPOSE 8000
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py seed_wekebeze && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2"]
