#!/usr/bin/env python3
"""Probe publisher metadata for discovery leads, without claiming playback or legal rights."""
import concurrent.futures, datetime, json
from pathlib import Path
import requests

source=Path('research/feature-film-leads.json')
data=json.loads(source.read_text('utf-8'))
def check(m):
    out={'id':m['id'],'title':m['title'],'expected_uploader':m['claimed_uploader'],'status':'not_checked','actual_uploader':None,'video_title':None,'http_status':None}
    try:
        r=requests.get('https://www.youtube.com/oembed',params={'url':'https://www.youtube.com/watch?v='+m['id'],'format':'json'},headers={'User-Agent':'Mozilla/5.0'},timeout=13)
        out['http_status']=r.status_code
        if r.status_code==200:
            obj=r.json()
            out['actual_uploader']=obj.get('author_name','')
            out['video_title']=obj.get('title','')
            out['status']='publisher_matches' if m['claimed_uploader'].lower() in out['actual_uploader'].lower() else 'publisher_mismatch'
        else:
            out['status']='metadata_http_'+str(r.status_code)
    except (requests.RequestException, ValueError) as exc:
        out['status']='metadata_failed'
        out['error']=str(exc)[:130]
    return out

with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    checked=list(pool.map(check,data['candidates']))
count={}
for item in checked:
    count[item['status']]=count.get(item['status'],0)+1
doc={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'disclaimer':'Uploader identity and title metadata alone do not establish a complete film, legal permission for embedding, country availability or actual playback.', 'summary':count,'results':checked}
Path('research/feature-film-lead-checks.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Discovery metadata verification:',count)
for item in checked:
    print(item['title'],item['status'],repr(item['actual_uploader']),repr(item['video_title']))
