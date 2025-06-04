#!/bin/bash

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check if required environment variables are set
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL must be set in .env file"
  exit 1
fi

# Apply migrations
echo "Applying database migrations..."
psql "$DATABASE_URL" -v NODE_ENV="$NODE_ENV" -f supabase/migrations/20240602_initial_schema.sql

echo "Migrations completed successfully!" 