FROM mhart/alpine-node:9

RUN npm install -g lerna

RUN apk --update add git openssh bash && \
    rm -rf /var/lib/apt/lists/* && \
    rm /var/cache/apk/*