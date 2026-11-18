# syntax=docker/dockerfile:1.7
# Static dashboard served by nginx; API requests use the configured API origin.

FROM nginx:1.27-alpine

LABEL org.opencontainers.image.title="apex-sensor-web" \
      org.opencontainers.image.description="Apex Sensor Studio dashboard"

# wget used by container health checks
RUN apk add --no-cache wget \
 && rm -rf /usr/share/nginx/html/*

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/index.html /usr/share/nginx/html/index.html
COPY frontend/src /usr/share/nginx/html/src

# Non-root is awkward with official nginx; keep default user, tighten conf instead
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
