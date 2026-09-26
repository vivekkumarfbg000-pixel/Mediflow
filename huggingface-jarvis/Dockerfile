FROM node:18-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 7860

# Start the unified Jarvis + Auto-Healer server
CMD ["npm", "start"]
