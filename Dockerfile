# Root Dockerfile for single-service Docker deployment (e.g. Render Web Service)
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY app-shell/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app-shell/backend/ .
EXPOSE 8000
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py seed_wekebeze && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2"]
