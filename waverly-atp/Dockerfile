FROM node:18-buster-slim as waverly-atp

COPY /*.json /
COPY /*.js /
COPY /*.yaml /
COPY /packages /packages
COPY /services /services

RUN npm install --global pnpm
RUN pnpm install --frozen-lockfile
RUN pnpm build

WORKDIR /packages/dev-env

CMD [ "pnpm", "run", "start" ]
