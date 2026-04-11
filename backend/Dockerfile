FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY app/ ./app/

# Environment defaults (can be overridden)
ENV STRM_BASE_DIR=/app/data
ENV STRM_SOURCE_DIR=/data/clouddrive/gdrive
ENV STRM_OUTPUT_DIR=/app/output

# Create dirs
RUN mkdir -p /app/data /app/output /app/data/logs

# Expose port
EXPOSE 3011

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3011"]
