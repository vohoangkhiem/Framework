# Official Playwright image: matching browsers + OS dependencies preinstalled.
# Keep the tag in sync with the @playwright/test version in package.json.
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

WORKDIR /app

ENV CI=true \
    HUSKY=0 \
    LOG_FORMAT=json \
    NO_COLOR=1

# No GPU in the container: WebKit's accelerated compositing / DMABUF renderer crashes the
# web process ("Page crashed"). Force the software rendering path.
ENV WEBKIT_DISABLE_COMPOSITING_MODE=1 \
    WEBKIT_DISABLE_DMABUF_RENDERER=1

# Install dependencies first to maximise Docker layer caching.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Default: full run. Override with `docker run <image> npx playwright test --project=chromium --grep @smoke`.
CMD ["npx", "playwright", "test"]
