FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY public ./public
COPY src ./src
COPY local-server.mjs ./

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

USER node

CMD ["node", "local-server.mjs"]
