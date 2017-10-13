#!/bin/bash

echo "Setting up snapshot dir"
adduser -D -g '' elasticsearch
chown -R elasticsearch /snapshots

FILE=/data/passwordschanged

if [ ! -f $FILE -a $NODE_DATA == "true" ]; then
    # Reset passwords
    echo "Setting passwords"
    OLD_HTTP_ENABLE="${HTTP_ENABLE}"
    OLD_NETWORK_HOST="${NETWORK_HOST}"
    HTTP_ENABLE="true"
    NETWORK_HOST=0.0.0.0
    ACCEPT_DEFAULT_PASSWORD=true

    # Start temporary elasticsearch
    ulimit -l unlimited
    chown -R elasticsearch:elasticsearch /elasticsearch
    chown -R elasticsearch:elasticsearch /data

    su-exec elasticsearch /elasticsearch/bin/elasticsearch -d

    sleep 30

    curl -XPUT -u elastic:changeme 'localhost:9200/_xpack/security/user/elastic/_password?pretty' -H 'Content-Type: application/json' -d"
    {
    \"password\": \"${ELASTIC_PASSWORD}\"
    }
    "

    curl -XPUT -u elastic:$ELASTIC_PASSWORD 'localhost:9200/_xpack/security/user/kibana/_password?pretty' -H 'Content-Type: application/json' -d"
    {
    \"password\": \"${KIBANA_PASSWORD}\"
    }
    "

    # Kill temporary elasticsearch
    kill -SIGTERM $(ps -ef | grep elasticsearch | awk '{print $2}')

    HTTP_ENABLE="${OLD_HTTP_ENABLE}"
    NETWORK_HOST="${OLD_NETWORK_HOST}"
    ACCEPT_DEFAULT_PASSWORD=false

    touch $FILE
fi

echo "Starting up"
/run.sh
	
# echo http://nl.alpinelinux.org/alpine/edge/community >> /etc/apk/repositories && \
#	apk --no-cache add shadow && \
#	adduser -D -g '' elasticsearch && \

#	chmod 700 /snapshots && \
#	mkdir /snapshots/~ && \
#	usermod -u 1000 elasticsearch && \