# Playwright base with Chromium + deps
FROM mcr.microsoft.com/playwright:v1.46.0-jammy

# ---- Upgrade Node in the image to >= 20.18.1 ----
# (uses official Node tarball; avoids apt repo drift)
RUN ARCH=x64 \
 && curl -fsSL https://nodejs.org/dist/v20.18.1/node-v20.18.1-linux-$ARCH.tar.xz -o /tmp/node.tar.xz \
 && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 --no-same-owner \
 && rm /tmp/node.tar.xz \
 && node -v && npm -v

WORKDIR /app

# Install deps (use lockfile if present; otherwise fallback to npm install)
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci; \
    else \
      npm install --no-audit --no-fund; \
    fi

# Copy source & build
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
ENV PORT=3000
CMD ["npm","start"]
