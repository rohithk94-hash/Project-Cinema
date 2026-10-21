#!/usr/bin/env python3
"""Build a source-attributed discovery catalog from Rotten Tomatoes' 2025 guide."""
import json, re, urllib.request
from html.parser import HTMLParser
from pathlib import Path

SOURCE = "https://editorial.rottentomatoes.com/guide/best-free-youtube-movies/"
class Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.depth=0
        self.active=None
        self.items=[]
        self.pending_rank=None
        self.heading=None
        self.in_h=False
        self.text=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag in ('h2','h3'):
            self.in_h=True;self.text=[]
        if tag=='a' and self.in_h:
            self.active=attrs.get('href','')
    def handle_data(self,data):
        if self.in_h:self.text.append(data)
    def handle_endtag(self,tag):
        if tag in ('h2','h3') and self.in_h:
            t=' '.join(''.join(self.text).split())
            self.in_h=False
            m=re.search(r'#(\d+)\s+(.+?)\s*\((\d{4})\)',t)
            if m:self.items.append(dict(rank=int(m.group(1)),title=m.group(2),year=int(m.group(3))))
            self.active=None

def build():
    req=urllib.request.Request(SOURCE,headers={'User-Agent':'Mozilla/5.0 (compatible; ProjectCinemaCatalog/1.0)'})
    with urllib.request.urlopen(req,timeout=25) as response: html=response.read().decode('utf-8','replace')
    # RT article ranks and title links are often separate HTML blocks.
    from html.parser import HTMLParser
    class Extract(HTMLParser):
        def __init__(self):super().__init__();self.in_heading=False;self.parts=[];self.headings=[]
        def handle_starttag(self,tag,attrs):
            if tag in ('h2','h3'):self.in_heading=True;self.parts=[]
        def handle_data(self,data):
            if self.in_heading:self.parts.append(data)
        def handle_endtag(self,tag):
            if tag in ('h2','h3') and self.in_heading:
                self.headings.append(' '.join(''.join(self.parts).split()));self.in_heading=False
    p=Extract();p.feed(html)
    candidates=[]
    for h in p.headings:
        m=re.match(r'^#?(\d{1,3})\s*\.?\s*(.+?)\s*\((\d{4})\)$',h)
        if m:candidates.append({'rank':int(m.group(1)),'title':m.group(2),'year':int(m.group(3))})
    from bs4 import BeautifulSoup
    soup=BeautifulSoup(html,'html.parser')
    candidates=[]
    for item in soup.select('.countdown-item'):
        rank_el=item.select_one('.countdown-index')
        heading=item.select_one('h2,h3,.article_movie_title,.countdown-item-title')
        if not rank_el or not heading:continue
        rank_match=re.search(r'(\d{1,3})',rank_el.get_text(' ',strip=True))
        title_match=re.search(r'(.+?)\s*\((\d{4})\)',heading.get_text(' ',strip=True))
        if rank_match and title_match:
            candidates.append({'rank':int(rank_match.group(1)),'title':title_match.group(1).strip(),'year':int(title_match.group(2))})
    if len(candidates)<80:
        # In RT's countdown template the title is frequently in a div, not an h2.
        candidates=[]
        for item in soup.select('.countdown-item'):
            rank_el=item.select_one('.countdown-index')
            if not rank_el:continue
            rank_match=re.search(r'(\d{1,3})',rank_el.get_text(' ',strip=True))
            if not rank_match:continue
            title_el=item.select_one('.article_movie_title,.countdown-item-title,h2,h3')
            if not title_el:continue
            match=re.search(r'(.+?)\s*\((\d{4})\)',title_el.get_text(' ',strip=True))
            if match:candidates.append({'rank':int(rank_match.group(1)),'title':match.group(1).strip(),'year':int(match.group(2))})
    if len(candidates)<80:
        # RT sometimes changes its countdown layout. Match headings to the nearest prior
        # rank marker within a short source window, rather than inventing titles.
        candidates=[]
        for heading in soup.select('h2,h3'):
            match=re.search(r'(.+?)\s*\((\d{4})\)',heading.get_text(' ',strip=True))
            if not match:continue
            previous=heading.find_previous(string=re.compile(r'^\s*#\d{1,3}\s*$'))
            if previous is None:continue
            rank=int(re.search(r'\d+',str(previous)).group())
            if 1<=rank<=110:candidates.append({'rank':rank,'title':match.group(1).strip(),'year':int(match.group(2))})
    if len(candidates)<80:
        # Template-independent fallback: parse adjacent rank/title text nodes.
        candidates=[]
        lines=[x.strip() for x in soup.get_text('\n',strip=True).splitlines() if x.strip()]
        for i,line in enumerate(lines[:-1]):
            rank_match=re.fullmatch(r'#\s*(\d{1,3})',line)
            if not rank_match:continue
            for candidate in lines[i+1:i+5]:
                title_match=re.fullmatch(r'(.+?)\s*\((\d{4})\)',candidate)
                if title_match:
                    candidates.append({'rank':int(rank_match.group(1)),'title':title_match.group(1),'year':int(title_match.group(2))})
                    break
    if len(candidates)<80:
        # Rotten Tomatoes exposes rank, linked title and year as adjacent text.
        flat=soup.get_text(' ',strip=True)
        candidates=[]
        for match in re.finditer(r'#\s*(\d{1,3})\s+(.{1,150}?)\s*\((\d{4})\)',flat):
            rank=int(match.group(1))
            title=match.group(2).strip()
            if 1<=rank<=100 and not re.search(r'#\d+',title):
                candidates.append({'rank':rank,'title':title,'year':int(match.group(3))})
    # Keep duplicates only if source really has them, do not fabricate 100 entries.
    unique={}
    for m in candidates:
        key=(m['title'].lower(),m['year'])
        unique.setdefault(key,m)
    movies=list(unique.values())
    if len(movies)<80:
        print('HTML sample:',repr(html[:900]))
        print('TEXT sample:',repr(soup.get_text(' ',strip=True)[:1200]))
        raise RuntimeError(f'Only parsed {len(movies)} films; refusing to overwrite previous catalog')
    movies.sort(key=lambda x:x['rank'])
    for m in movies:
        m['availability']='Listed free on YouTube by Rotten Tomatoes (Aug 2025); current availability unverified'
        m['source']=SOURCE
    Path('rt-free-movies.json').write_text(json.dumps({'source':SOURCE,'source_date':'2025-07-30','availability_note':'Historical editorial list, not live YouTube availability','movies':movies},indent=2,ensure_ascii=False)+'\n')
    print(f'Generated {len(movies)} movies')
if __name__=='__main__':build()
