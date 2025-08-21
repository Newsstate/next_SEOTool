# Playwright base with Chromium + deps
FROM mcr.microsoft.com/playwright:v1.46.0-jammy

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm","start"]
