import React, { useEffect, useMemo, useState } from "react";
import { getAuthClient, makeActor, login as iiLogin, logout as iiLogout } from "./auth.js";

const EMOJIS = ["🏓","🔥","🐉","🦊","🐼","🦁","🚀","🥷","🤖","🐝","🦄","🍕","👑","⚡","🐙","🦖"];

// Speiler TABLE i backend (main.mo). Nøkkel = antall deltakere.
const POINTS = {
  2:  [8, 0],
  3:  [8, 4, 0],
  4:  [8, 6, 3, 0],
  5:  [8, 6, 4, 2, 0],
  6:  [8, 6, 4, 2, 1, 0],
  7:  [8, 6, 4, 3, 2, 1, 0],
  8:  [8, 6, 5, 4, 3, 2, 1, 0],
  9:  [8, 6, 5, 4, 3, 2, 1, 1, 0],
  10: [8, 6, 5, 4, 3, 2, 2, 1, 1, 0],
  11: [8, 6, 5, 4, 3, 2, 2, 1, 1, 0, 0],
  12: [8, 6, 5, 4, 3, 2, 2, 1, 1, 1, 0, 0],
  13: [8, 6, 5, 4, 3, 2, 2, 2, 1, 1, 1, 0, 0],
};

function fmt(n, d = 2) {
  return Number(n).toFixed(d).replace(/\.00$/, "");
}
function medal(rank) {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "#" + rank;
}
function ms(playedAt) {
  return Number(playedAt / 1000000n);
}

// ---------- Sesonger ----------
// Vår  = januar til og med juni (nyttår -> sommerferien)
// Høst = juli til og med desember (etter sommerferien -> juleferien)
function seasonOf(playedAt) {
  const d = new Date(ms(playedAt));
  const y = d.getFullYear();
  const spring = d.getMonth() <= 5;
  return {
    key: y + (spring ? "-V" : "-H"),
    label: (spring ? "Vår " : "Høst ") + y,
    sort: y * 10 + (spring ? 1 : 2),
  };
}

function seasonList(games) {
  const seen = {};
  for (const g of games) {
    const s = seasonOf(g.playedAt);
    seen[s.key] = s;
  }
  return Object.values(seen).sort((a, b) => b.sort - a.sort);
}

// ---------- Tabell ----------
// Regnes i nettleseren fra runder som allerede ligger på kjeden. Poengene er
// lagret per resultat, så dette er de samme tallene backend ville gitt.
function computeStandings(games, players) {
  const acc = {};
  for (const g of games) {
    const size = g.results.length;
    for (const r of g.results) {
      const k = String(r.playerId);
      const a = acc[k] || (acc[k] = { played: 0, pts: 0, wins: 0, lasts: 0 });
      a.played += 1;
      a.pts += Number(r.points);
      if (Number(r.placement) === 1) a.wins += 1;
      if (Number(r.placement) === size) a.lasts += 1;
    }
  }
  return players
    .map((p) => {
      const a = acc[String(p.id)] || { played: 0, pts: 0, wins: 0, lasts: 0 };
      return {
        playerId: p.id,
        name: p.name,
        emoji: p.emoji,
        photo: p.photo,
        played: a.played,
        totalPoints: a.pts,
        avgPoints: a.played ? a.pts / a.played : 0,
        wins: a.wins,
        lasts: a.lasts,
        winPct: a.played ? a.wins / a.played : 0,
      };
    })
    .filter((s) => s.played > 0)
    .sort((x, y) => y.avgPoints - x.avgPoints || y.wins - x.wins);
}

// ---------- Badges ----------
function computeBadges(games, standings, minGames) {
  const asc = [...games].sort((a, b) => Number(a.playedAt - b.playedAt));
  const hist = {};
  for (const g of asc) {
    for (const r of g.results) {
      const k = String(r.playerId);
      (hist[k] || (hist[k] = [])).push({
        placement: Number(r.placement),
        points: Number(r.points),
        size: g.results.length,
      });
    }
  }
  const rounds = asc.length;
  const maxWins = standings.reduce((m, s) => Math.max(m, s.wins), 0);
  const maxLasts = standings.reduce((m, s) => Math.max(m, s.lasts), 0);
  const out = {};
  for (const s of standings) {
    const k = String(s.playerId);
    const h = hist[k] || [];
    const b = [];
    let best = 0, cur = 0;
    for (const x of h) {
      if (x.placement === 1) { cur += 1; best = Math.max(best, cur); } else { cur = 0; }
    }
    if (best >= 3) b.push({ e: "🔥", t: best + " seire på rad" });
    if (s.wins > 0 && s.wins === maxWins) b.push({ e: "👑", t: "Flest seire i sesongen" });
    if (rounds > 1 && s.played === rounds) b.push({ e: "🎯", t: "Spilt hver eneste runde" });
    if (s.played >= 2 && s.wins === s.played) b.push({ e: "🎖️", t: "Vunnet alt hun/han har spilt" });
    if (maxLasts >= 2 && s.lasts === maxLasts) b.push({ e: "💀", t: "Flest sisteplasser" });
    if (h.length >= 4) {
      const l3 = h.slice(-3);
      const avg3 = l3.reduce((a, x) => a + x.points, 0) / l3.length;
      if (avg3 > s.avgPoints + 0.5) b.push({ e: "📈", t: "I form — snitt " + fmt(avg3) + " siste 3" });
      else if (avg3 < s.avgPoints - 0.5) b.push({ e: "📉", t: "Formsvikt — snitt " + fmt(avg3) + " siste 3" });
    }
    if (s.played < minGames) b.push({ e: "🆕", t: (minGames - s.played) + " runder igjen til offisiell" });
    out[k] = b;
  }
  return out;
}

function Badges({ list }) {
  if (!list || !list.length) return null;
  return (
    <div className="badges">
      {list.map((b, i) => (
        <span className="bdg" key={i} title={b.t}>{b.e}<span className="bdgt">{b.t}</span></span>
      ))}
    </div>
  );
}

export default function App() {
  const [actor, setActor] = useState(null);
  const [principal, setPrincipal] = useState(null);
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState("rank");
  const [players, setPlayers] = useState([]);
  const [allGames, setAllGames] = useState([]);
  const [minGames, setMinGames] = useState(3);
  const [season, setSeason] = useState(null);
  const [detail, setDetail] = useState(null);
  const [toast, setToast] = useState("");

  const loggedIn = !!principal && principal !== "2vxsx-fae";

  useEffect(() => {
    (async () => {
      const client = await getAuthClient();
      const authed = await client.isAuthenticated();
      const identity = client.getIdentity();
      const a = makeActor(identity);
      setActor(a);
      setPrincipal(authed ? identity.getPrincipal().toText() : null);
      setBooting(false);
    })();
  }, []);

  async function refresh(a = actor) {
    if (!a) return;
    const [p, g, m] = await Promise.all([a.listPlayers(), a.listGames(), a.getMinGames()]);
    setPlayers(p.filter((x) => x.active));
    setAllGames([...g].sort((x, y) => Number(y.playedAt - x.playedAt)));
    setMinGames(Number(m));
  }

  useEffect(() => { if (actor) refresh(actor); }, [actor]);

  const seasons = useMemo(() => seasonList(allGames), [allGames]);
  const active = season || (seasons[0] && seasons[0].key) || null;
  const games = useMemo(
    () => allGames.filter((g) => !active || seasonOf(g.playedAt).key === active),
    [allGames, active]
  );
  const board = useMemo(() => computeStandings(games, players), [games, players]);
  const badges = useMemo(() => computeBadges(games, board, minGames), [games, board, minGames]);

  function flash(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  }

  async function doLogin() {
    const identity = await iiLogin();
    const a = makeActor(identity);
    setActor(a);
    setPrincipal(identity.getPrincipal().toText());
    refresh(a);
  }

  async function doLogout() {
    await iiLogout();
    const client = await getAuthClient();
    const a = makeActor(client.getIdentity());
    setActor(a);
    setPrincipal(null);
  }

  if (booting) return <div className="wrap"><div className="empty">Laster… 🏓</div></div>;

  if (!loggedIn) {
    return (
      <div className="wrap">
        <div className="gate">
          <div className="big spin">🏓</div>
          <h2>Bordtenniskameratene</h2>
          <p className="hint">Logg inn for å registrere runder. Bruk Internet Identity — der kan du velge «Continue with Google» og bruke Gmail-kontoen din.</p>
          <button className="btn" onClick={doLogin}>Logg inn</button>
          <p className="hint" style={{ marginTop: 14 }}>Rankingen er åpen for alle å se 👇</p>
          <button className="btn ghost" onClick={() => setPrincipal("guest")}>Se ranking uten innlogging</button>
        </div>
      </div>
    );
  }

  const guest = principal === "guest";

  return (
    <div className="wrap">
      <header className="top">
        <span className="spin" style={{ fontSize: 26 }}>🏓</span>
        <h1>Bordtenniskameratene</h1>
        <button className="pill on" onClick={doLogout}>{guest ? "Gjest" : "Logg ut"}</button>
      </header>

      {seasons.length > 0 && (tab === "rank" || tab === "hist") && (
        <div className="chips seasons">
          {seasons.map((s) => (
            <span key={s.key} className={"chip" + (s.key === active ? " on" : "")} onClick={() => setSeason(s.key)}>
              {s.label}
            </span>
          ))}
        </div>
      )}

      <div className="tabs">
        <button className={tab === "rank" ? "on" : ""} onClick={() => setTab("rank")}>Ranking</button>
        <button className={tab === "new" ? "on" : ""} onClick={() => setTab("new")}>Ny runde</button>
        <button className={tab === "hist" ? "on" : ""} onClick={() => setTab("hist")}>Historikk</button>
        <button className={tab === "ppl" ? "on" : ""} onClick={() => setTab("ppl")}>Spillere</button>
      </div>

      {tab === "rank" && (
        <Ranking
          board={board}
          games={games}
          badges={badges}
          minGames={minGames}
          actor={actor}
          guest={guest}
          onPick={(s) => setDetail(s)}
          onMinChanged={(n) => { setMinGames(n); refresh(); flash("Grense satt til " + n + " runder ✅"); }}
        />
      )}
      {tab === "new" && (
        <NewGame
          players={players}
          actor={actor}
          board={board}
          minGames={minGames}
          onSaved={() => { refresh(); setTab("rank"); flash("Runde lagret! 🎉"); }}
          guest={guest}
        />
      )}
      {tab === "hist" && <History games={games} players={players} />}
      {tab === "ppl" && <People players={players} actor={actor} onChange={() => refresh()} flash={flash} guest={guest} />}

      {detail && (
        <PlayerDetail
          s={detail}
          games={games}
          players={players}
          badges={badges[String(detail.playerId)]}
          seasonLabel={(seasons.find((x) => x.key === active) || {}).label}
          onClose={() => setDetail(null)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// Hvordan tabellen så ut FØR siste runde, for opp-/nedrykk.
function useMovement(board, games, minGames) {
  return useMemo(() => {
    if (!board.length || games.length < 2) return { map: {}, lastDate: null, hasPrev: false };
    const last = games[0];
    const earlier = games.slice(1);
    const agg = {};
    for (const g of earlier) {
      for (const r of g.results) {
        const k = String(r.playerId);
        const a = agg[k] || (agg[k] = { played: 0, pts: 0, wins: 0 });
        a.played += 1;
        a.pts += Number(r.points);
        if (Number(r.placement) === 1) a.wins += 1;
      }
    }
    const prevOf = (s) => {
      const a = agg[String(s.playerId)] || { played: 0, pts: 0, wins: 0 };
      return { played: a.played, avg: a.played ? a.pts / a.played : 0, wins: a.wins };
    };
    const ordered = board
      .filter((s) => prevOf(s).played >= minGames)
      .sort((x, y) => {
        const a = prevOf(x); const b = prevOf(y);
        if (a.avg !== b.avg) return b.avg - a.avg;
        return b.wins - a.wins;
      });
    const map = {};
    ordered.forEach((s, i) => { map[String(s.playerId)] = { prevRank: i + 1 }; });
    return { map, lastDate: new Date(ms(last.playedAt)), hasPrev: true };
  }, [board, games, minGames]);
}

function Move({ mv, rank, hasPrev }) {
  if (!hasPrev || !mv) return <span className="mv new">NY</span>;
  const d = mv.prevRank - rank;
  if (d > 0) return <span className="mv up">▲{d}</span>;
  if (d < 0) return <span className="mv dn">▼{-d}</span>;
  return <span className="mv same">–</span>;
}

function RankRow({ s, rank, mv, hasPrev, minGames, badges, dim, onPick }) {
  const missing = minGames - Number(s.played);
  return (
    <div className={"card tappable" + (dim ? " dim" : "")} onClick={() => onPick && onPick(s)}>
      <div className="row">
        <div className={"rk g" + (dim ? 0 : rank)}>{dim ? "–" : medal(rank)}</div>
        {!dim && <Move mv={mv} rank={rank} hasPrev={hasPrev} />}
        <div className="ava">
          {s.photo && s.photo[0] ? <img src={s.photo[0]} alt="" /> : <span>{s.emoji}</span>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="nm">{s.name}</div>
          <div className="sub">
            {s.played} runder · {s.wins} seire · {fmt(s.winPct * 100, 0)}% 🏆
            {dim && missing > 0 ? " · " + missing + " igjen til offisiell" : ""}
          </div>
          <Badges list={badges} />
        </div>
        <div className="stat">
          <b>{fmt(s.avgPoints)}</b>
          <div className="sub">snitt</div>
        </div>
      </div>
    </div>
  );
}

function Ranking({ board, games, badges, minGames, actor, guest, onPick, onMinChanged }) {
  const { map, lastDate, hasPrev } = useMovement(board, games, minGames);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(minGames);
  const [busy, setBusy] = useState(false);

  useEffect(() => setVal(minGames), [minGames]);

  const official = board.filter((s) => s.played >= minGames);
  const unofficial = board.filter((s) => s.played < minGames);

  async function saveMin() {
    const n = Number(val);
    if (!Number.isInteger(n) || n < 1 || n > 50) { alert("Velg et tall mellom 1 og 50"); return; }
    setBusy(true);
    try {
      const ok = await actor.setMinGames(BigInt(n));
      if (!ok) { alert("Kunne ikke lagre — er du logget inn?"); return; }
      setEditing(false);
      onMinChanged(n);
    } finally { setBusy(false); }
  }

  if (!board.length) return <div className="empty">Ingen runder i denne sesongen ennå.<br />Trykk «Ny runde» og kom i gang 🏓</div>;

  return (
    <>
      <div className="minbar">
        <span className="sub">Krav for offisiell ranking: <b>{minGames}</b> {minGames === 1 ? "runde" : "runder"}</span>
        {!guest && !editing && <button className="pill" onClick={() => setEditing(true)}>Endre</button>}
        {editing && (
          <span className="minedit">
            <input type="number" min="1" max="50" value={val} onChange={(e) => setVal(e.target.value)} />
            <button className="pill on" disabled={busy} onClick={saveMin}>{busy ? "…" : "Lagre"}</button>
            <button className="pill" onClick={() => { setEditing(false); setVal(minGames); }}>Avbryt</button>
          </span>
        )}
      </div>

      {hasPrev && lastDate && (
        <p className="hint">Pilene viser endring etter runden {lastDate.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" })}. Trykk på en spiller for detaljer.</p>
      )}

      {official.length === 0 && <div className="empty">Ingen har spilt {minGames} runder ennå 🤷</div>}
      {official.map((s, i) => (
        <RankRow key={String(s.playerId)} s={s} rank={i + 1} mv={map[String(s.playerId)]}
          hasPrev={hasPrev} minGames={minGames} badges={badges[String(s.playerId)]} onPick={onPick} />
      ))}

      {unofficial.length > 0 && (
        <>
          <div className="sectionhead">Uoffisiell · under {minGames} {minGames === 1 ? "runde" : "runder"}</div>
          {unofficial.map((s) => (
            <RankRow key={String(s.playerId)} s={s} rank={0} minGames={minGames}
              badges={badges[String(s.playerId)]} dim onPick={onPick} />
          ))}
        </>
      )}
    </>
  );
}

function PlayerDetail({ s, games, players, badges, seasonLabel, onClose }) {
  const byId = useMemo(() => Object.fromEntries(players.map((p) => [String(p.id), p])), [players]);
  const mine = games
    .filter((g) => g.results.some((r) => String(r.playerId) === String(s.playerId)))
    .sort((a, b) => Number(b.playedAt - a.playedAt));

  const bestPlace = mine.reduce((m, g) => {
    const r = g.results.find((x) => String(x.playerId) === String(s.playerId));
    return Math.min(m, Number(r.placement));
  }, 99);

  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheetin" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ marginBottom: 6 }}>
          <div className="ava big">{s.photo && s.photo[0] ? <img src={s.photo[0]} alt="" /> : <span>{s.emoji}</span>}</div>
          <div>
            <div className="nm" style={{ fontSize: 20 }}>{s.name}</div>
            <div className="sub">{seasonLabel || "Sesongen"} · {s.played} runder · snitt {fmt(s.avgPoints)}</div>
          </div>
          <button className="pill" style={{ marginLeft: "auto" }} onClick={onClose}>Lukk</button>
        </div>

        <Badges list={badges} />

        <div className="kpis">
          <div className="kpi"><b>{s.wins}</b><span>seire</span></div>
          <div className="kpi"><b>{bestPlace === 99 ? "–" : medal(bestPlace)}</b><span>beste</span></div>
          <div className="kpi"><b>{s.totalPoints}</b><span>poeng</span></div>
          <div className="kpi"><b>{fmt(s.winPct * 100, 0)}%</b><span>seiersandel</span></div>
        </div>

        <div className="sectionhead">Runder</div>
        {mine.map((g) => {
          const r = g.results.find((x) => String(x.playerId) === String(s.playerId));
          const d = new Date(ms(g.playedAt));
          const others = g.results
            .slice()
            .sort((a, b) => Number(a.placement - b.placement))
            .map((x) => (byId[String(x.playerId)] || {}).emoji || "🏓")
            .join(" ");
          return (
            <div className="card" key={String(g.id)}>
              <div className="row">
                <div className="rk">{medal(Number(r.placement))}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="nm" style={{ fontSize: 14 }}>
                    {d.toLocaleDateString("nb-NO", { weekday: "short", day: "numeric", month: "short" })}
                  </div>
                  <div className="sub">av {g.results.length} spillere · {others}</div>
                </div>
                <div className="stat"><b style={{ fontSize: 17 }}>{Number(r.points)}p</b></div>
              </div>
              {g.note && <div className="note">💬 {g.note}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewGame({ players, actor, board, minGames, onSaved, guest }) {
  const [sel, setSel] = useState([]);
  const [note, setNote] = useState("");
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const rankInfo = useMemo(() => {
    const info = {};
    const official = board.filter((s) => s.played >= minGames);
    const rest = board.filter((s) => s.played < minGames);
    official.forEach((s, i) => {
      info[String(s.playerId)] = { rank: i + 1, official: true, avg: s.avgPoints, played: s.played };
    });
    rest.forEach((s) => {
      info[String(s.playerId)] = { rank: null, official: false, avg: s.avgPoints, played: s.played };
    });
    return info;
  }, [board, minGames]);

  function byRanking(ids) {
    return [...ids].sort((x, y) => {
      const a = rankInfo[x] || { official: false, avg: -1, played: 0 };
      const b = rankInfo[y] || { official: false, avg: -1, played: 0 };
      if (a.official !== b.official) return a.official ? -1 : 1;
      if (a.official && b.official) return a.rank - b.rank;
      if (a.avg !== b.avg) return b.avg - a.avg;
      return b.played - a.played;
    });
  }

  function toggle(id) {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function move(i, dir) {
    setSel((s) => {
      const a = [...s];
      const j = i + dir;
      if (j < 0 || j >= a.length) return a;
      const t = a[i]; a[i] = a[j]; a[j] = t;
      return a;
    });
  }
  const byId = useMemo(() => Object.fromEntries(players.map((p) => [String(p.id), p])), [players]);

  async function save() {
    setSaving(true);
    try {
      const res = await actor.recordGame(sel.map((x) => BigInt(x)), note);
      if (!res.length) { alert("Kunne ikke lagre — er du logget inn?"); return; }
      setSel([]); setNote(""); setStep(1);
      onSaved();
    } finally { setSaving(false); }
  }

  if (guest) return <div className="empty">Logg inn for å registrere runder ✌️</div>;
  if (!players.length) return <div className="empty">Legg til spillere først under «Spillere».</div>;

  if (step === 1) {
    return (
      <>
        <p className="hint">Hvem er med i denne pausen? Rekkefølgen ordner seg selv i neste steg.</p>
        <div className="grid">
          {players.map((p) => {
            const i = sel.indexOf(String(p.id));
            return (
              <div key={String(p.id)} className={"pick" + (i >= 0 ? " on" : "")} onClick={() => toggle(String(p.id))}>
                {i >= 0 && <div className="badge">{i + 1}</div>}
                <div className="ava big">{p.photo && p.photo[0] ? <img src={p.photo[0]} alt="" /> : <span>{p.emoji}</span>}</div>
                <div className="nm2">{p.name}</div>
              </div>
            );
          })}
        </div>
        <div style={{ height: 14 }} />
        <button className="btn" disabled={sel.length < 2} onClick={() => { setSel(byRanking(sel)); setStep(2); }}>
          {sel.length < 2 ? "Velg minst 2 spillere" : "Videre med " + sel.length + " spillere →"}
        </button>
      </>
    );
  }

  const table = POINTS[Math.min(sel.length, 13)] || [];

  return (
    <>
      <p className="hint">Startet i rekkefølge etter dagens ranking — juster med ↑↓ etter hvordan det faktisk gikk.</p>
      <div className="ord">
        {sel.map((id, i) => {
          const p = byId[id];
          const ri = rankInfo[id];
          return (
            <div className="ordrow" key={id}>
              <div className="pos">{medal(i + 1)}</div>
              <div className="ava">{p && p.photo && p.photo[0] ? <img src={p.photo[0]} alt="" /> : <span>{p ? p.emoji : "🏓"}</span>}</div>
              <div style={{ minWidth: 0 }}>
                <div className="nm">
                  {p ? p.name : "?"}{" "}
                  {ri && ri.official ? <span className="rkchip">#{ri.rank}</span> : <span className="rkchip off">uoff.</span>}
                </div>
                <div className="sub">{table[i] !== undefined ? table[i] : 0} poeng{ri ? " · snitt " + fmt(ri.avg) : ""}</div>
              </div>
              <div className="arrows">
                <button onClick={() => move(i, -1)}>↑</button>
                <button onClick={() => move(i, 1)}>↓</button>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ height: 8 }} />
      <button className="btn ghost" onClick={() => setSel(byRanking(sel))}>↕ Sorter etter ranking igjen</button>

      <div className="notebox">
        <div className="notelabel">💬 Dagens merknad</div>
        <textarea
          rows={3}
          placeholder="Hva skjedde? «Psykologisk spill fra Ola, men sterk første seier» 😏"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="sub">Vises i historikken og på spillerkortene. Halve moroa 🏓</div>
      </div>

      <button className="btn" disabled={saving} onClick={save}>{saving ? "Lagrer…" : "Lagre runde 🏓"}</button>
      <div style={{ height: 8 }} />
      <button className="btn ghost" onClick={() => setStep(1)}>← Tilbake</button>
    </>
  );
}

function History({ games, players }) {
  const byId = useMemo(() => Object.fromEntries(players.map((p) => [String(p.id), p])), [players]);
  if (!games.length) return <div className="empty">Ingen runder i denne sesongen 🤷</div>;
  return (
    <>
      {games.map((g) => {
        const d = new Date(ms(g.playedAt));
        const sorted = [...g.results].sort((a, b) => Number(a.placement - b.placement));
        return (
          <div className="card" key={String(g.id)}>
            <div className="sub" style={{ marginBottom: 8 }}>
              {d.toLocaleDateString("nb-NO", { weekday: "short", day: "numeric", month: "short" })} · {d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })} · {g.results.length} spillere
            </div>
            {sorted.map((r) => (
              <div className="row" key={String(r.playerId)} style={{ padding: "4px 0" }}>
                <div className="rk">{medal(Number(r.placement))}</div>
                <div className="nm" style={{ fontSize: 14 }}>
                  {(byId[String(r.playerId)] || {}).emoji} {(byId[String(r.playerId)] || {}).name || "?"}
                </div>
                <div className="stat"><b style={{ fontSize: 15 }}>{Number(r.points)}p</b></div>
              </div>
            ))}
            {g.note && <div className="note big">💬 {g.note}</div>}
          </div>
        );
      })}
    </>
  );
}

function People({ players, actor, onChange, flash, guest }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🏓");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await actor.addPlayer(name.trim(), emoji);
      setName("");
      onChange();
      flash("Spiller lagt til 👋");
    } finally { setBusy(false); }
  }

  async function pickPhoto(id, file) {
    const bitmap = await createImageBitmap(file);
    const size = 256;
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const ctx = c.getContext("2d");
    const s = Math.min(bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, (bitmap.width - s) / 2, (bitmap.height - s) / 2, s, s, 0, 0, size, size);
    const dataUrl = c.toDataURL("image/jpeg", 0.72);
    await actor.setPhoto(BigInt(id), dataUrl);
    onChange();
    flash("Bilde lagret 📸");
  }

  return (
    <>
      {!guest && (
        <div className="card">
          <div className="hint">Ny spiller</div>
          <input placeholder="Navn" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="chips">
            {EMOJIS.map((e) => (
              <span key={e} className={"chip" + (e === emoji ? " on" : "")} onClick={() => setEmoji(e)}>{e}</span>
            ))}
          </div>
          <div style={{ height: 10 }} />
          <button className="btn" disabled={busy || !name.trim()} onClick={add}>Legg til {emoji}</button>
        </div>
      )}
      {players.map((p) => (
        <div className="card" key={String(p.id)}>
          <div className="row">
            <div className="ava">{p.photo && p.photo[0] ? <img src={p.photo[0]} alt="" /> : <span>{p.emoji}</span>}</div>
            <div className="nm">{p.name}</div>
            {!guest && (
              <label className="pill" style={{ marginLeft: "auto" }}>
                📸 Bilde
                <input type="file" accept="image/*" style={{ display: "none" }}
                  onChange={(e) => e.target.files && e.target.files[0] && pickPhoto(p.id, e.target.files[0])} />
              </label>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
