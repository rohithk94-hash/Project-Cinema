import json
from pathlib import Path
import streamlit as st

st.set_page_config(page_title="Project Cinema", page_icon="🎬", layout="wide")
movies=json.loads((Path(__file__).parent/"movies.json").read_text())
by_id={m["id"]:m for m in movies}
for key in ("favorites","watchlist","watched","dismissed"):
    if key not in st.session_state: st.session_state[key]=[]

st.title("🎬 Project Cinema")
st.write("Discover your next favorite film. A free, experimental recommendation app.")
with st.sidebar:
    st.header("Your preferences")
    backup={k:st.session_state[k] for k in ("favorites","watchlist","watched","dismissed")}
    st.download_button("Save preferences",json.dumps(backup),file_name="cinema-preferences.json",mime="application/json")
    uploaded=st.file_uploader("Restore preferences",type=["json"])
    if uploaded and st.button("Restore"):
        try:
            data=json.load(uploaded)
            for k in backup:
                st.session_state[k]=[x for x in data.get(k,[]) if x in by_id]
            st.rerun()
        except (ValueError,TypeError,AttributeError):
            st.error("Invalid backup file.")

discover,recommend,watchlist=st.tabs(["Discover","For You","Watchlist"])
with discover:
    st.subheader("Choose at least five movies you love")
    search=st.text_input("Search movies",placeholder="Try Drishyam or Parasite")
    choices=[m for m in movies if search.casefold() in m["title"].casefold()]
    if not choices: st.info("No matches in our small starter collection yet.")
    for m in choices:
        a,b=st.columns([4,1])
        a.write(f'**{m["title"]}** ({m["year"]}) · {", ".join(m["genres"])}')
        chosen=m["id"] in st.session_state.favorites
        if b.button("✓ Loved" if chosen else "+ Love",key="fav"+m["id"]):
            if chosen: st.session_state.favorites.remove(m["id"])
            else: st.session_state.favorites.append(m["id"])
            st.rerun()
    st.caption(f'{len(st.session_state.favorites)} favorites selected')
with recommend:
    st.subheader("Made for your taste")
    fav=[by_id[x] for x in st.session_state.favorites]
    if len(fav)<5:
        st.info("Select five favorites in Discover first.")
    else:
        counts={g:sum(g in m["genres"] for m in fav) for m in movies for g in m["genres"]}
        top=sorted(counts,key=counts.get,reverse=True)[:3]
        st.write("Your favorite genres: "+", ".join(top))
        excluded=set(st.session_state.favorites+st.session_state.watched+st.session_state.dismissed)
        pool=[m for m in movies if m["id"] not in excluded]
        def score(m):
            return sum(counts.get(g,0) for g in m["genres"])+m["quality"]*.2+(1.5 if m["country"] not in {f["country"] for f in fav} else 0)
        for m in sorted(pool,key=score,reverse=True)[:5]:
            similar=max(fav,key=lambda f:len(set(f["genres"]) & set(m["genres"])))
            st.markdown(f'### {m["title"]} ({m["year"]})')
            st.caption(f'{m["country"]} · {", ".join(m["genres"])}')
            st.write(m["description"])
            st.write(f'**Why this fits:** You enjoyed {similar["title"]}; this shares some of its genres or themes.')
            a,b,c=st.columns(3)
            if a.button("Save",key="save"+m["id"]):
                if m["id"] not in st.session_state.watchlist: st.session_state.watchlist.append(m["id"])
                st.rerun()
            if b.button("Already watched",key="seen"+m["id"]):
                st.session_state.watched.append(m["id"]);st.rerun()
            if c.button("Not interested",key="skip"+m["id"]):
                st.session_state.dismissed.append(m["id"]);st.rerun()
            st.divider()
with watchlist:
    st.subheader("Your watchlist")
    if not st.session_state.watchlist: st.info("Save recommendations to see them here.")
    for mid in list(st.session_state.watchlist):
        m=by_id[mid]
        a,b=st.columns([4,1])
        a.write(f'**{m["title"]}** ({m["year"]})')
        if b.button("Remove",key="remove"+mid):
            st.session_state.watchlist.remove(mid);st.rerun()
st.caption("Free prototype: curated catalog, rule-based ranking, no verified streaming availability. Preferences persist only in the active session unless exported.")
