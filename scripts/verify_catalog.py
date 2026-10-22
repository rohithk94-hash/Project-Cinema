#!/usr/bin/env python3
"""Metadata-only verification of studio and archive film IDs. Not browser playback or full-length verification."""
import concurrent.futures
import datetime
import json
from pathlib import Path
import requests

movies=json.loads(Path("catalog.json").read_text(encoding="utf-8"))["movies"]
def probe(m):
    result={"id":m["id"],"title":m["title"],"expected_uploader":m["archive"],"metadata_status":"unverified","actual_uploader":None,"http_status":None}
    try:
        response=requests.get("https://www.youtube.com/oembed",params={"url":m["watch_url"],"format":"json"},headers={"User-Agent":"Mozilla/5.0"},timeout=12)
        result["http_status"]=response.status_code
        if response.status_code==200:
            info=response.json()
            author=info.get("author_name","")
            result["actual_uploader"]=author
            normalized=author.casefold()
            expected=m["archive"]
            if expected=="Mosfilm":
                accepted=("mosfilm" in normalized or "мосфильм" in normalized)
            elif expected=="Korean Film Archive":
                accepted=("korean" in normalized and ("film" in normalized or "archive" in normalized))
            else:
                accepted=False
            result["metadata_status"]="source_channel_confirmed" if accepted else "source_channel_mismatch"
        else:
            result["metadata_status"]="metadata_http_"+str(response.status_code)
    except (requests.RequestException, ValueError) as e:
        result["metadata_status"]="metadata_lookup_failed"
        result["error"]=str(e)[:120]
    return result

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    checks=list(pool.map(probe,movies))
status_counts={}
for item in checks:
    status_counts[item["metadata_status"]]=status_counts.get(item["metadata_status"],0)+1
summary={
    "checked_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "disclaimer":"YouTube oEmbed metadata does not establish full-length runtime, third-party iframe permission, US geo-availability or successful playback. HTTP failures are inconclusive.",
    "count":len(checks),
    "metadata_summary":status_counts,
    "checks":checks
}
Path("catalog-link-checks.json").write_text(json.dumps(summary,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
print("oEmbed results:",status_counts,flush=True)
for item in checks:
    if item["metadata_status"]=="source_channel_mismatch":
        print("REVIEW uploader mismatch",item,flush=True)
