import React, { useEffect, useMemo, useState } from "react";
import { getAuthClient, makeActor, login as iiLogin, logout as iiLogout } from "./auth.js";

const EMOJIS = ["🏓","🔥","🐉","🦊","🐼","🦁","🚀","🥷","🤖","🐝","🦄","🍕","👑","⚡","🐙","🦖"];

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
    const [b, p, g] = await Promise.all([a.standings(), a.listPlayers(), a.listGames()]);
    setBoard(b);
    setPlayers(p.filter((x) => x.active));
    setGames([...g].sort((x, y) => Number(y.playedAt - x.playedAt)));
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

      {tab === "rank" && <Ranking board={board} />}
      {tab === "new" && <NewGame players={players} actor={actor} onSaved={() => { refresh(); setTab("rank"); flash("Runde lagret! 🎉"); }} guest={principal === "guest"} />}
      {tab === "hist" && <History games={games} players={players} />}
      {tab === "ppl" && <People players={players} actor={actor} onChange={() => refresh()} flash={flash} guest={principal === "guest"} />}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Ranking({ board }) {
  if (!board.length) return <div className="empty">Ingen runder spilt ennå.<br />Trykk «Ny runde» og kom i gang 🏓</div>;
  return (
    <>
      {board.map((s) => (
        <div className="card" key={String(s.playerId)}>
          <div className="row">
            <div className={"rk g" + Number(s.rank)}>{medal(Number(s.rank))}</div>
            <div className="ava">
              {s.photo?.[0] ? <img src={s.photo[0]} alt="" /> : <span>{s.emoji}</span>}
            </div>
            <div>
              <div className="nm">{s.name}</div>
              <div className="sub">
                {Number(s.played)} runder · {Number(s.wins)} seire · {fmt(Number(s.winPct) * 100, 0)}% 🏆
              </div>
            </div>
            <div className="stat">
              <b>{fmt(s.avgPoints)}</b>
              <div className="sub">snitt</div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function NewGame({ players, actor, onSaved, guest }) {
  const [sel, setSel] = useState([]);
  const [note, setNote] = useState("");
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

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
        <button className="btn" disabled={sel.length < 2} onClick={() => setStep(2)}>
          {sel.length < 2 ? "Velg minst 2 spillere" : `Videre med ${sel.length} spillere →`}
        </button>
      </>
    );
  }

  return (
    <>
      <p className="hint">Sett rekkefølgen — 1. plass øverst. Vinneren får {sel.length} poeng, siste får 1.</p>
      <div className="ord">
        {sel.map((id, i) => {
          const p = byId[id];
          return (
            <div className="ordrow" key={id}>
              <div className="pos">{medal(i + 1)}</div>
              <div className="ava">{p?.photo?.[0] ? <img src={p.photo[0]} alt="" /> : <span>{p?.emoji}</span>}</div>
              <div>
                <div className="nm">{p?.name}</div>
                <div className="sub">{sel.length - i} poeng</div>
              </div>
              <div className="arrows">
                <button onClick={() => move(i, -1)}>↑</button>
                <button onClick={() => move(i, 1)}>↓</button>
              </div>
            </div>
          );
        })}
      </div>
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
