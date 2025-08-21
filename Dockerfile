# Playwright base with Chromium + system deps preinstalled
FROM mcr.microsoft.com/playwright:v1.46.0-jammy

WORKDIR /app

# Install deps (use lockfile if present; otherwise fall back to npm install)
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci; \
    else \
      npm install --no-audit --no-fund; \
    fi

# Copy source and build
COPY . .
RUN npm run build

# Run
ENV NODE_ENV=production
EXPOSE 3000
# Render injects $PORT; ensure Next binds to it
ENV PORT=3000
CMD ["npm","start"]
