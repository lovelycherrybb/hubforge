import json, shutil, os
src = '/Users/gongcheng/Documents/GC cowork/16-HubForge/docker-daemon-proxy.json'
dst = os.path.expanduser('~/.orbstack/config/docker.json')
shutil.copy2(src, dst)
print('Done - restart OrbStack')
