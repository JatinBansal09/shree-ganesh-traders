#!/bin/sh
set -e

echo "→ Waiting for database..."
while ! python -c "
import os, MySQLdb
try:
    MySQLdb.connect(
        host=os.environ.get('DB_HOST','db'),
        user=os.environ.get('DB_USER','root'),
        passwd=os.environ.get('DB_PASSWORD',''),
        db=os.environ.get('DB_NAME','shreeganesh'),
        port=int(os.environ.get('DB_PORT',3306))
    )
    print('DB ready')
except:
    exit(1)
" 2>/dev/null; do
    echo "  Database not ready yet, retrying in 3s..."
    sleep 3
done

echo "→ Running migrations..."
python manage.py makemigrations --noinput
python manage.py migrate --noinput

echo "→ Loading initial data..."
python manage.py loaddata initial_data.json || echo "⚠ loaddata skipped"

echo "→ Collecting static files..."
python manage.py collectstatic --noinput

echo "→ Backend ready. Starting server..."
exec gunicorn backend.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 3 \
    --timeout 120