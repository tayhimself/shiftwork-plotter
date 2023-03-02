#!/bin/sh
rsync -avl --exclude-from=rsync.ignore . nightwork:/usr/share/nginx/html/data/.
