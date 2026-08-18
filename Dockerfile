FROM nginx:alpine

COPY . /usr/share/nginx/html

# Ships in the repo root so the build context stays a plain copy; it belongs in
# nginx's config directory, not in the web root.
RUN mv /usr/share/nginx/html/nginx.conf /etc/nginx/conf.d/default.conf
