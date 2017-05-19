FROM busybox:latest

MAINTAINER Bartuer Zhou <bartuer@bartuer.com>

ENV WORKPLACE="/home/bazhou/local/src/ml"

ADD http://bazhou.azureedge.net/learning/ml/package/node  /usr/bin/node
ADD http://bazhou.azureedge.net/learning/ml/learning_daemon/index.js $WORKPLACE/index.js
RUN chmod +x /usr/bin/node && \
    mkdir -p $WORKPLACE/node_modules/azure-storage && \
    wget -O- -q http://bazhou.azureedge.net/learning/ml/package/node_modules.tar.gz | tar -C $WORKPLACE -x -z -f - && \
    wget -O- -q http://bazhou.blob.core.windows.net/learning/ml/package/azure-storage.tar.gz | tar -C $WORKPLACE/node_modules/azure-storage -x -z -f -

WORKDIR $WORKPLACE
ENTRYPOINT ["/usr/bin/node"]
CMD ["index.js"]