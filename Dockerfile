FROM node:12.18.3-slim

RUN apt-get update \
    && apt-get install -y cron vim python build-essential
WORKDIR /usr/src/app
COPY package*.json ./
COPY . .
RUN npm install
WORKDIR /usr/src/app
COPY package*.json ./
COPY . .
RUN ln -fs /usr/share/zoneinfo/America/New_York /etc/localtime
RUN dpkg-reconfigure --frontend noninteractive tzdata
COPY automater-cron /etc/cron.d/automater-cron
RUN chmod 0644 /etc/cron.d/automater-cron
RUN crontab /etc/cron.d/automater-cron
CMD ["cron", "-f"]