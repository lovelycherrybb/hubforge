import json
with open('/Users/gongcheng/.docker/daemon.json', 'r') as f:
    cfg = json.load(f)
cfg['registry-mirrors'] = ['https://docker.1ms.run', 'https://docker.xuanyuan.me']
with open('/Users/gongcheng/.docker/daemon.json', 'w') as f:
    json.dump(cfg, f, indent=2)
print('Done - please restart Docker Desktop')
