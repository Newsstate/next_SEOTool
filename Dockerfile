FROM mcr.microsoft.com/playwright:v1.46.0-jammy
WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci; \
    else \
      npm install --no-audit --no-fund; \
    fi

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
ENV PORT=3000
CMD ["npm","start"]
