FROM node:18-buster-slim as base-waverly-atp

COPY /*.json /
COPY /*.js /
COPY /yarn.lock /
COPY /packages /packages

RUN yarn

FROM base-waverly-atp as waverly-atp

WORKDIR /packages/dev-env

CMD [ "yarn", "start" ]
