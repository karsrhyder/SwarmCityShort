FROM node:8

WORKDIR /usr/src/app
COPY package.json ./
COPY yarn.lock ./
RUN yarn install --production
COPY . .

ENV PORT=3000 \
    DB_PATH=/usr/src/app/db
EXPOSE 3000

CMD [ "yarn", "start" ]