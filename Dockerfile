FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production SITE_DIR=/app/site
COPY servidor/package.json servidor/package-lock.json servidor/
RUN cd servidor && npm ci --omit=dev
COPY servidor servidor
COPY *.html *.css *.js *.webmanifest site/
COPY img site/img
RUN mkdir -p /app/dinamico && chown node:node /app/dinamico
USER node
EXPOSE 3000
CMD ["node", "servidor/server.js"]
