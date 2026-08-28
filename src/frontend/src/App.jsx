import React, { useEffect, useMemo, useState } from "react";
import { getAuthClient, makeActor, login as iiLogin, logout as iiLogout } from "./auth.js";

const EMOJIS = ["🏓","🔥","🐉","🦊","🐼","🦁","🚀","🥷","🤖","🐝","🦄","🍕","👑","⚡","🐙","🦖"];

// Speiler TABLE i backend (main.mo). Indeks = antall deltakere.
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

export default function App() {
  const [actor, setActor] = useState(null);
  const [principal, setPrincipal] = useState(null);
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState("rank");
  const [players, setPlayers] = useState([]);
  const [board, setBoard] = useState([]);
  const [games, setGames] = useState([]);
  const [minGames, setMinGames] = useState(3);
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
    const [b, p, g, m] = await Promise.all([a.standings(), a.listPlayers(), a.listGames(), a.getMinGames()]);
    setBoard(b);
    setPlayers(p.filter((x) => x.active));
    setGames([...g].sort((x, y) => Number(y.playedAt - x.playedAt)));
    setMinGames(Number(m));
  }

  useEffect(() => { if (actor) refresh(actor); }, [actor]);

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

  return (
    <div className="wrap">
      <header className="top">
        <span className="spin" style={{ fontSize: 26 }}>🏓</span>
        <h1>Bordtenniskameratene</h1>
        <button className="pill on" onClick={doLogout}>
          {principal === "guest" ? "Gjest" : "Logg ut"}
        </button>
      </header>

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
          minGames={minGames}
          actor={actor}
          guest={principal === "guest"}
          onMinChanged={(n) => { setMinGames(n); refresh(); flash("Grense satt til " + n + " runder ✅"); }}
        />
      )}
      {tab === "new" && <NewGame players={players} actor={actor} board={board} minGames={minGames} onSaved={() => { refresh(); setTab("rank"); flash("Runde lagret! 🎉"); }} guest={principal === "guest"} />}
      {tab === "hist" && <History games={games} players={players} />}
      {tab === "ppl" && <People players={players} actor={actor} onChange={() => refresh()} flash={flash} guest={principal === "guest"} />}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// Regner ut hvordan tabellen så ut FØR siste runde, slik at vi kan vise
// opp-/nedrykk. Alt skjer i nettleseren – ingen data endres på kjeden.
function useMovement(board, games, minGames) {
  return useMemo(() => {
    if (!board.length || games.length < 2) return { map: {}, lastDate: null, hasPrev: false };

    // games er sortert nyest først
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

    // Samme sortering som backend: snitt, så antall seire. Bare spillere som
    // var offisielle FØR siste runde teller med i den forrige tabellen.
    const ordered = board
      .filter((s) => prevOf(s).played >= minGames)
      .sort((x, y) => {
        const a = prevOf(x);
        const b = prevOf(y);
        if (a.avg !== b.avg) return b.avg - a.avg;
        return b.wins - a.wins;
      });

    const map = {};
    ordered.forEach((s, i) => {
      map[String(s.playerId)] = { prevRank: i + 1, played: prevOf(s).played };
    });

    return { map, lastDate: new Date(Number(last.playedAt / 1000000n)), hasPrev: true };
  }, [board, games]);
}

function Move({ mv, rank, hasPrev }) {
  if (!hasPrev || !mv) return <span className="mv new">NY</span>;
  const d = mv.prevRank - rank;
  if (d > 0) return <span className="mv up">▲{d}</span>;
  if (d < 0) return <span className="mv dn">▼{-d}</span>;
  return <span className="mv same">–</span>;
}

function RankRow({ s, rank, mv, hasPrev, minGames, dim }) {
  const missing = minGames - Number(s.played);
  return (
    <div className={"card" + (dim ? " dim" : "")}>
      <div className="row">
        <div className={"rk g" + (dim ? 0 : rank)}>{dim ? "–" : medal(rank)}</div>
        {!dim && <Move mv={mv} rank={rank} hasPrev={hasPrev} />}
        <div className="ava">
          {s.photo?.[0] ? <img src={s.photo[0]} alt="" /> : <span>{s.emoji}</span>}
        </div>
        <div>
          <div className="nm">{s.name}</div>
          <div className="sub">
            {Number(s.played)} runder · {Number(s.wins)} seire · {fmt(Number(s.winPct) * 100, 0)}% 🏆
            {dim && missing > 0 && <> · {missing} igjen til offisiell</>}
          </div>
        </div>
        <div className="stat">
          <b>{fmt(s.avgPoints)}</b>
          <div className="sub">snitt</div>
        </div>
      </div>
    </div>
  );
}

function Ranking({ board, games, minGames, actor, guest, onMinChanged }) {
  const { map, lastDate, hasPrev } = useMovement(board, games, minGames);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(minGames);
  const [busy, setBusy] = useState(false);

  useEffect(() => setVal(minGames), [minGames]);

  const official = board.filter((s) => Number(s.played) >= minGames);
  const unofficial = board.filter((s) => Number(s.played) < minGames);

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

  if (!board.length) return <div className="empty">Ingen runder spilt ennå.<br />Trykk «Ny runde» og kom i gang 🏓</div>;

  return (
    <>
      <div className="minbar">
        <span className="sub">
          Krav for offisiell ranking: <b>{minGames}</b> {minGames === 1 ? "runde" : "runder"}
        </span>
        {!guest && !editing && (
          <button className="pill" onClick={() => setEditing(true)}>Endre</button>
        )}
        {editing && (
          <span className="minedit">
            <input type="number" min="1" max="50" value={val} onChange={(e) => setVal(e.target.value)} />
            <button className="pill on" disabled={busy} onClick={saveMin}>{busy ? "…" : "Lagre"}</button>
            <button className="pill" onClick={() => { setEditing(false); setVal(minGames); }}>Avbryt</button>
          </span>
        )}
      </div>

      {hasPrev && lastDate && (
        <p className="hint">
          Pilene viser endring etter runden {lastDate.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      )}

      {official.length === 0 && (
        <div className="empty">Ingen har spilt {minGames} runder ennå 🤷</div>
      )}
      {official.map((s, i) => (
        <RankRow
          key={String(s.playerId)}
          s={s}
          rank={i + 1}
          mv={map[String(s.playerId)]}
          hasPrev={hasPrev}
          minGames={minGames}
        />
      ))}

      {unofficial.length > 0 && (
        <>
          <div className="sectionhead">
            Uoffisiell · under {minGames} {minGames === 1 ? "runde" : "runder"}
          </div>
          {unofficial.map((s) => (
            <RankRow key={String(s.playerId)} s={s} rank={0} minGames={minGames} dim />
          ))}
        </>
      )}
    </>
  );
}

function NewGame({ players, actor, board, minGames, onSaved, guest }) {
  const [sel, setSel] = useState([]);
  const [note, setNote] = useState("");
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Rangering per spiller slik den står nå. Offisielle beholder plassnummeret
  // sitt; uoffisielle sorteres etter dem, men fortsatt på snitt.
  const rankInfo = useMemo(() => {
    const info = {};
    const official = board.filter((s) => Number(s.played) >= minGames);
    const rest = board.filter((s) => Number(s.played) < minGames);
    official.forEach((s, i) => {
      info[String(s.playerId)] = { rank: i + 1, official: true, avg: Number(s.avgPoints), played: Number(s.played) };
    });
    rest.forEach((s) => {
      info[String(s.playerId)] = { rank: null, official: false, avg: Number(s.avgPoints), played: Number(s.played) };
    });
    return info;
  }, [board, minGames]);

  // Beste rangering først. Uoffisielle og helt nye havner nederst.
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
      [a[i], a[j]] = [a[j], a[i]];
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
        <p className="hint">Hvem er med i denne pausen? Trykk i den rekkefølgen du vil — du sorterer i neste steg.</p>
        <div className="grid">
          {players.map((p) => {
            const i = sel.indexOf(String(p.id));
            return (
              <div key={String(p.id)} className={"pick" + (i >= 0 ? " on" : "")} onClick={() => toggle(String(p.id))}>
                {i >= 0 && <div className="badge">{i + 1}</div>}
                <div className="ava big">{p.photo?.[0] ? <img src={p.photo[0]} alt="" /> : <span>{p.emoji}</span>}</div>
                <div className="nm2">{p.name}</div>
              </div>
            );
          })}
        </div>
        <div style={{ height: 14 }} />
        <button className="btn" disabled={sel.length < 2} onClick={() => { setSel(byRanking(sel)); setStep(2); }}>
          {sel.length < 2 ? "Velg minst 2 spillere" : `Videre med ${sel.length} spillere →`}
        </button>
      </>
    );
  }

  return (
    <>
      <p className="hint">
        Startet i rekkefølge etter dagens ranking — juster med ↑↓ etter hvordan det faktisk gikk.
      </p>
      <div className="ord">
        {sel.map((id, i) => {
          const p = byId[id];
          const ri = rankInfo[id];
          return (
            <div className="ordrow" key={id}>
              <div className="pos">{medal(i + 1)}</div>
              <div className="ava">{p?.photo?.[0] ? <img src={p.photo[0]} alt="" /> : <span>{p?.emoji}</span>}</div>
              <div>
                <div className="nm">
                  {p?.name}{" "}
                  {ri?.official ? (
                    <span className="rkchip">#{ri.rank}</span>
                  ) : (
                    <span className="rkchip off">uoff.</span>
                  )}
                </div>
                <div className="sub">
                  {POINTS[Math.min(sel.length, 13)]?.[i] ?? 0} poeng
                  {ri ? ` · snitt ${fmt(ri.avg)}` : ""}
                </div>
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
      <div style={{ height: 12 }} />
      <input placeholder="Merknad (valgfritt) — f.eks. «psykologisk spill fra Ola» 😏" value={note} onChange={(e) => setNote(e.target.value)} />
      <div style={{ height: 12 }} />
      <button className="btn" disabled={saving} onClick={save}>{saving ? "Lagrer…" : "Lagre runde 🏓"}</button>
      <div style={{ height: 8 }} />
      <button className="btn ghost" onClick={() => setStep(1)}>← Tilbake</button>
    </>
  );
}

function History({ games, players }) {
  const byId = useMemo(() => Object.fromEntries(players.map((p) => [String(p.id), p])), [players]);
  if (!games.length) return <div className="empty">Ingen runder ennå 🤷</div>;
  return (
    <>
      {games.map((g) => {
        const d = new Date(Number(g.playedAt / 1000000n));
        const sorted = [...g.results].sort((a, b) => Number(a.placement - b.placement));
        return (
          <div className="card" key={String(g.id)}>
            <div className="sub" style={{ marginBottom: 8 }}>
              {d.toLocaleDateString("nb-NO", { weekday: "short", day: "numeric", month: "short" })} · {d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}
            </div>
            {sorted.map((r) => (
              <div className="row" key={String(r.playerId)} style={{ padding: "4px 0" }}>
                <div className="rk">{medal(Number(r.placement))}</div>
                <div className="nm" style={{ fontSize: 14 }}>
                  {byId[String(r.playerId)]?.emoji} {byId[String(r.playerId)]?.name ?? "?"}
                </div>
                <div className="stat"><b style={{ fontSize: 15 }}>{Number(r.points)}p</b></div>
              </div>
            ))}
            {g.note && <div className="sub" style={{ marginTop: 8, fontStyle: "italic" }}>💬 {g.note}</div>}
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
            <div className="ava">{p.photo?.[0] ? <img src={p.photo[0]} alt="" /> : <span>{p.emoji}</span>}</div>
            <div className="nm">{p.name}</div>
            {!guest && (
              <label className="pill" style={{ marginLeft: "auto" }}>
                📸 Bilde
                <input type="file" accept="image/*" style={{ display: "none" }}
                  onChange={(e) => e.target.files?.[0] && pickPhoto(p.id, e.target.files[0])} />
              </label>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
