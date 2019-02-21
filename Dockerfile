FROM node:8

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --only=production
COPY . .

ENV PORT 3000
ENV DB_PATH /usr/src/app/db

EXPOSE 3000

CMD [ "npm", "start" ]