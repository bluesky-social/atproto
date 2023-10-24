FROM node:18-buster-slim as waverly-atp

RUN mkdir -p /waverly-at

COPY /*.json /waverly-at
COPY /*.js /waverly-at
COPY /*.yaml /waverly-at
COPY /*.js /waverly-at
COPY /*.ts /waverly-at
COPY /packages /waverly-at/packages
COPY /services /waverly-at/services

WORKDIR /waverly-at

RUN npm install --global pnpm
RUN pnpm install --frozen-lockfile
RUN pnpm build

WORKDIR /waverly-at/packages/dev-env

CMD [ "node", "dist/bin" ]
