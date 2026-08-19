FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the site explicitly rather than `COPY . /usr/share/nginx/html`.
#
# The whole-directory copy published this Dockerfile, nginx.conf, and the old Cloudflare
# `_headers` file at the site root -- all three were served with HTTP 200 in production. An
# explicit allowlist also means a future stray file in this directory is not auto-published.
COPY index.html privacy.html /usr/share/nginx/html/
COPY images /usr/share/nginx/html/images

EXPOSE 8080
