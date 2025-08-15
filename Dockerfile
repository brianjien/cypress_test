# Use an official Node.js runtime as a parent image
FROM node:18

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install Cypress dependencies
# See: https://docs.cypress.io/guides/continuous-integration/docker
RUN apt-get update && \
    apt-get install -y \
    libgtk2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    libnotify-dev \
    libgconf-2-4 \
    libnss3 \
    libxss1 \
    libasound2 \
    libxtst6 \
    xauth \
    xvfb

# Install app dependencies
RUN npm install

# Bundle app source
COPY . .

# Your app binds to port 3000, but Render will map it to 80/443
EXPOSE 3000

# Define the command to run your app
CMD [ "npm", "start" ]