FROM node:lts-buster

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 1200

CMD ["npm", "start"]
