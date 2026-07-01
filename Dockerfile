#1 FROM
FROM node:24-alpine

#2 WORKDIR
WORKDIR /app

#3 COPY
COPY package*.json ./
COPY package-lock.json ./

#4 RUN
RUN npm install

#5 COPY
COPY . . 

#6 EXPOSE 
EXPOSE 3001

#7 CMD
CMD ["npm", "start"]