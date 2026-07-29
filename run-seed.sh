#!/bin/bash
cd /opt/hubforge
PASS=$(docker exec hubforge-db printenv POSTGRES_PASSWORD)
export DATABASE_URL="postgresql://hubforge:""$PASS""@localhost:5432/hubforge?schema=public"
npx tsx prisma/seed.ts
