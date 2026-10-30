FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application
COPY . .

# Create uploads directory for persistent storage
RUN mkdir -p /app/uploads

EXPOSE 8000

# Run database migrations, run seed, and start single-worker ASGI engine
CMD sh -c "alembic upgrade head && python scripts/seed.py && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"

