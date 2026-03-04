// ══════════════════════════════════════════════════════════════════════
//  GHAR.SYS  v9.0  |  Hamro Ghar Ko Complete App
//  ─────────────────────────────────────────────────────────────────────
//  ⚠️  SUPABASE SETUP — Run this SQL ONCE in your Supabase SQL Editor:
//
//  CREATE TABLE IF NOT EXISTS grocery_items (
//    id bigserial primary key, name text not null,
//    checked boolean default false, checked_by text,
//    created_by text, created_at timestamptz default now()
//  );
//  CREATE TABLE IF NOT EXISTS task_notes (
//    id bigserial primary key, task_id text, date text,
//    content text, author text, created_at timestamptz default now()
//  );
//  CREATE TABLE IF NOT EXISTS settlements (
//    id bigserial primary key, label text,
//    paid jsonb, shares jsonb, balances jsonb, total numeric,
//    period_start text, period_end text,
//    settled_by text, settled_at timestamptz default now()
//  );
//  -- Enable Realtime for grocery_items, task_notes, settlements in dashboard
// ══════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from "react";

/* ─── SUPABASE ────────────────────────────────────────────────────── */
const SB = "https://sddmujczlutzvfkwngsn.supabase.co";
const SK = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkZG11amN6bHV0enZma3duZ3NuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0OTQ5NDEsImV4cCI6MjA4ODA3MDk0MX0.dtAxUkKsqe-_rLD187qNiBpG0pxXlGOeeaC1e6EfqHw";
const AH = { apikey: SK, Authorization: `Bearer ${SK}`, "Content-Type": "application/json" };

const db = {
  get: async (t, f = {}) => {
    let u = `${SB}/rest/v1/${t}?select=*`;
    for (const [k, v] of Object.entries(f)) u += `&${k}=eq.${encodeURIComponent(v)}`;
    try { return await (await fetch(u, { headers: AH })).json(); } catch { return []; }
  },
  upsert: async (t, d) => {
    try {
      return await (await fetch(`${SB}/rest/v1/${t}`, {
        method: "POST", headers: { ...AH, Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(d)
      })).json();
    } catch { return null; }
  },
  patch: async (t, f, d) => {
    let u = `${SB}/rest/v1/${t}?`;
    for (const [k, v] of Object.entries(f)) u += `${k}=eq.${v}&`;
    try { await fetch(u, { method: "PATCH", headers: AH, body: JSON.stringify(d) }); } catch {}
  },
  del: async (t, id) => { try { await fetch(`${SB}/rest/v1/${t}?id=eq.${id}`, { method: "DELETE", headers: AH }); } catch {} },
  sub: (t, cb) => {
    try {
      const ws = new WebSocket(`${SB}/realtime/v1/websocket?apikey=${SK}&vsn=1.0.0`);
      ws.onopen = () => ws.send(JSON.stringify({ topic: `realtime:public:${t}`, event: "phx_join", payload: {}, ref: "1" }));
      ws.onmessage = e => { try { const m = JSON.parse(e.data); if (["INSERT","UPDATE","DELETE"].includes(m.event)) cb(m); } catch {} };
      return ws;
    } catch { return { close: () => {} }; }
  }
};

/* ─── CONSTANTS ───────────────────────────────────────────────────── */
const MEMBERS = ["Nitesh", "Subodh", "Bishal", "Bikram"];
const MC = {
  Nitesh: { bg: "#e11d48", light: "#ffe4e6", text: "#e11d48", glow: "#e11d4822" },
  Subodh: { bg: "#7c3aed", light: "#ede9fe", text: "#7c3aed", glow: "#7c3aed22" },
  Bishal: { bg: "#0369a1", light: "#e0f2fe", text: "#0369a1", glow: "#0369a122" },
  Bikram: { bg: "#b45309", light: "#fef3c7", text: "#b45309", glow: "#b4530922" },
  Admin:  { bg: "#374151", light: "#f3f4f6", text: "#374151", glow: "#37415122" },
};

const DTASKS = [
  { id: "khana",     label: "Khana Pakaaune", icon: "🍳" },
  { id: "bhada",     label: "Bhada Maajne",   icon: "🍽️" },
  { id: "kitchen",   label: "Kitchen Saffa",  icon: "🧹" },
  { id: "groceries", label: "Groceries Jane", icon: "🛒", isGrocery: true },
];
const WTASKS = [
  { id: "room1_mil", label: "Room 1 Milaaune", icon: "🛏️" },
  { id: "room2_mil", label: "Room 2 Milaaune", icon: "🛏️" },
  { id: "room1_swp", label: "Room 1 Sweep",    icon: "🧺" },
  { id: "room2_swp", label: "Room 2 Sweep",    icon: "🧺" },
];
const CATS = ["Groceries", "Special", "Electricity"];
const CI = { Groceries: "🛒", Special: "✨", Electricity: "⚡" };
const CC = { Groceries: "#16a34a", Special: "#db2777", Electricity: "#d97706" };
const DPERMS = Object.fromEntries(MEMBERS.map(m => [m, { aaja: true, expenses: true, report: true, markOthers: false }]));
const DP = { Nitesh: "1234", Subodh: "1234", Bishal: "1234", Bikram: "1234", Admin: "0000" };

const LS = {
  g: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  s: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

const today  = () => new Date().toISOString().split("T")[0];
const wkSt   = d  => { const dt = new Date(d), day = dt.getDay(); dt.setDate(dt.getDate() - day + (day === 0 ? -6 : 1)); return dt.toISOString().split("T")[0]; };
const fmtD   = d  => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const fmtDS  = d  => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const fmtTS  = ts => new Date(ts).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const fmt$   = v  => `£${Number(v || 0).toFixed(2)}`;
const parseNote = raw => { if (!raw) return { text: "", author: "", ts: "" }; try { return { text: "", author: "", ts: "", ...JSON.parse(raw) }; } catch { return { text: raw, author: "", ts: "" }; } };

/* ─── CSS ─────────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Playfair+Display:wght@700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#f0f9ff;overflow-x:hidden;font-family:'Nunito',sans-serif;}
::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-thumb{background:#94a3b8;border-radius:4px;}
@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes popIn{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}
@keyframes slideIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
@keyframes sparkFly{0%{opacity:1;transform:translate(-50%,-50%) rotate(var(--a)) translateY(0)}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--a)) translateY(-38px)}}
@keyframes cloudDrift{from{transform:translateX(-18px)}to{transform:translateX(18px)}}
@keyframes barGrow{from{width:0%}to{width:var(--tw)}}
@keyframes countUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes overlayIn{from{opacity:0}to{opacity:1}}
@keyframes sheetUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeUp .34s cubic-bezier(.34,1.3,.64,1) both;}
.fu1{animation:fadeUp .34s .06s cubic-bezier(.34,1.3,.64,1) both;}
.fu2{animation:fadeUp .34s .12s cubic-bezier(.34,1.3,.64,1) both;}
.fu3{animation:fadeUp .34s .18s cubic-bezier(.34,1.3,.64,1) both;}
.fu4{animation:fadeUp .34s .24s cubic-bezier(.34,1.3,.64,1) both;}
.pi{animation:popIn .26s cubic-bezier(.34,1.4,.64,1) both;}
.sl{animation:slideIn .26s cubic-bezier(.34,1.2,.64,1) both;}
.shake{animation:shake .32s ease;}
.btn{transition:transform .14s,box-shadow .16s,background .15s,color .15s,border-color .15s;cursor:pointer;border:none;outline:none;font-family:'Nunito',sans-serif;}
.btn:hover:not(:disabled){transform:translateY(-2px);}
.btn:active:not(:disabled){transform:scale(.93);}
.card{background:white;border:1.5px solid #e2e8f0;border-radius:18px;box-shadow:0 2px 12px rgba(0,0,0,.055);}
.overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(4px);z-index:999;animation:overlayIn .2s ease;display:flex;align-items:flex-end;justify-content:center;}
.sheet{background:white;border-radius:22px 22px 0 0;width:100%;max-width:500px;max-height:88vh;overflow-y:auto;animation:sheetUp .3s cubic-bezier(.34,1.1,.64,1);padding:22px 20px 34px;}
.stab{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px;}
.stab::-webkit-scrollbar{display:none;}
input,textarea,select{font-family:'Nunito',sans-serif;background:white;border:1.5px solid #e2e8f0;border-radius:11px;color:#1e293b;outline:none;transition:border .18s,box-shadow .18s;}
input:focus,textarea:focus,select:focus{border-color:#7c3aed;box-shadow:0 0 0 3px #7c3aed18;}
input::placeholder,textarea::placeholder{color:#94a3b8;}
.tag{display:inline-flex;align-items:center;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;}
`;

/* ─── MOUNTAIN SVG ────────────────────────────────────────────────── */
const Mtn = () => (
  <svg viewBox="0 0 500 120" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "100%" }}>
    <defs><linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#bfdbfe"/><stop offset="100%" stopColor="#e0f2fe"/></linearGradient></defs>
    <rect width="500" height="120" fill="url(#sky2)"/>
    <polygon points="0,90 60,35 120,80 180,25 240,70 300,20 360,65 420,18 500,60 500,120 0,120" fill="#cbd5e1" opacity="0.45"/>
    <polygon points="0,100 80,50 160,85 240,40 320,80 400,35 500,75 500,120 0,120" fill="#e2e8f0" opacity="0.7"/>
    <polygon points="0,110 100,70 200,100 300,65 400,95 500,72 500,120 0,120" fill="#f1f5f9"/>
    <polygon points="180,25 190,38 170,38" fill="white" opacity="0.85"/>
    <polygon points="300,20 312,35 288,35" fill="white" opacity="0.85"/>
    <polygon points="420,18 432,33 408,33" fill="white" opacity="0.85"/>
    {[30,70,110,155,205,255,310,360,430,470].map((x,i) => (
      <g key={i} transform={`translate(${x},${100+(i%3)*4})`} opacity="0.5">
        <polygon points="0,-12 6,0 -6,0" fill="#4ade80"/><polygon points="0,-8 5,4 -5,4" fill="#22c55e"/>
        <rect x="-1.5" y="4" width="3" height="4" fill="#92400e"/>
      </g>
    ))}
    <circle cx="440" cy="28" r="14" fill="#fde68a" opacity="0.8"/><circle cx="440" cy="28" r="10" fill="#fbbf24" opacity="0.9"/>
  </svg>
);

/* ─── SPARKS ──────────────────────────────────────────────────────── */
function Sparks({ x, y, color, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 880); return () => clearTimeout(t); }, []);
  return <div style={{ position: "fixed", left: x, top: y, pointerEvents: "none", zIndex: 9999 }}>
    {[...Array(10)].map((_, i) => (
      <div key={i} style={{ position:"absolute", width:7, height:7, borderRadius:"50%", background:color,
        animation:"sparkFly .85s ease-out forwards", "--a":`${i*36}deg` }}/>
    ))}
  </div>;
}

/* ─── LOADING ─────────────────────────────────────────────────────── */
const Loading = () => (
  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"55vh", gap:14 }}>
    <div style={{ width:38,height:38,border:"4px solid #e2e8f0",borderTop:"4px solid #7c3aed",borderRadius:"50%",animation:"spin .8s linear infinite" }}/>
    <div style={{ fontSize:13,color:"#94a3b8",fontWeight:700 }}>Data load hudai cha...</div>
  </div>
);

/* ─── MODAL SHEET ─────────────────────────────────────────────────── */
function Modal({ onClose, children, title }) {
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div style={{ fontSize:16,fontWeight:900,color:"#1e293b" }}>{title}</div>
          <button className="btn" onClick={onClose}
            style={{ padding:"6px 12px",borderRadius:9,background:"#f1f5f9",border:"1.5px solid #e2e8f0",color:"#64748b",fontSize:13,fontWeight:700 }}>✕ Banda</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─── DIVIDER ─────────────────────────────────────────────────────── */
const Divider = ({ label }) => (
  <div style={{ display:"flex", alignItems:"center", gap:10, margin:"16px 0 10px" }}>
    <div style={{ flex:1, height:1, background:"#e2e8f0" }}/>
    <div style={{ fontSize:10,color:"#94a3b8",letterSpacing:3,fontWeight:700 }}>{label}</div>
    <div style={{ flex:1, height:1, background:"#e2e8f0" }}/>
  </div>
);

/* ─── SUB TABS ────────────────────────────────────────────────────── */
function SubTabs({ tabs, active, onChange, color = "#7c3aed", colorLight = "#f5f3ff" }) {
  return (
    <div className="stab" style={{ marginBottom:14 }}>
      {tabs.map(t => {
        const on = active === t.id;
        return <button key={t.id} className="btn" onClick={() => onChange(t.id)}
          style={{ padding:"7px 14px", borderRadius:20, whiteSpace:"nowrap", fontSize:12, fontWeight:800,
            background: on ? color : "white", color: on ? "white" : "#64748b",
            border: `1.5px solid ${on ? color : "#e2e8f0"}`,
            boxShadow: on ? `0 3px 10px ${color}33` : "0 1px 4px rgba(0,0,0,0.05)",
            transition:"all .2s cubic-bezier(.34,1.2,.64,1)" }}>
          {t.icon} {t.label}
        </button>;
      })}
    </div>
  );
}

/* ─── BAR CHART ───────────────────────────────────────────────────── */
function BarChart({ data, colorFn, unit = "" }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
    {data.map((d, i) => {
      const pct = Math.round((d.value / max) * 100);
      const col = colorFn(d.key);
      return <div key={d.key} style={{ animation:`fadeUp .36s ${i*.07}s both` }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
          <span style={{ fontSize:13,color:"#374151",fontWeight:700 }}>{d.label}</span>
          <span style={{ fontSize:13,color:col,fontWeight:800 }}>{unit}{typeof d.value === "number" ? (d.value % 1 === 0 ? d.value : d.value.toFixed(2)) : d.value}</span>
        </div>
        <div style={{ height:9, background:"#f1f5f9", borderRadius:8, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${pct}%`, background:col, borderRadius:8,
            transition:"width 1s cubic-bezier(.34,1.1,.64,1)", boxShadow:`0 0 8px ${col}55` }}/>
        </div>
      </div>;
    })}
  </div>;
}

/* ─── RING ────────────────────────────────────────────────────────── */
function Ring({ value, max, color, label, sub }) {
  const r = 34, circ = 2 * Math.PI * r, off = circ - (value / Math.max(max, 1)) * circ;
  return <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
    <div style={{ position:"relative", width:82, height:82 }}>
      <svg width={82} height={82} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={41} cy={41} r={r} fill="none" stroke="#f1f5f9" strokeWidth={9}/>
        <circle cx={41} cy={41} r={r} fill="none" stroke={color} strokeWidth={9}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
          style={{ transition:"stroke-dashoffset 1.1s cubic-bezier(.34,1,.64,1)", filter:`drop-shadow(0 0 5px ${color}88)` }}/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:20, fontWeight:900, color }}>{value}</div>
    </div>
    <div style={{ fontSize:12,color:"#374151",fontWeight:700 }}>{label}</div>
    {sub && <div style={{ fontSize:11,color:"#94a3b8" }}>{sub}</div>}
  </div>;
}

/* ─── MEMBER CHIP ─────────────────────────────────────────────────── */
const Chip = ({ m, active, onClick, small }) => {
  const mc = MC[m];
  return <button className="btn" onClick={onClick}
    style={{ padding: small ? "5px 10px" : "7px 13px", borderRadius:20, fontSize: small ? 11 : 12, fontWeight:700,
      background: active ? mc.bg : mc.light, color: active ? "white" : mc.text,
      border: `1.5px solid ${active ? mc.bg : mc.bg + "44"}`,
      boxShadow: active ? `0 3px 10px ${mc.glow}` : "",
      transform: active ? "scale(1.04)" : "scale(1)", transition:"all .18s cubic-bezier(.34,1.2,.64,1)" }}>
    {active ? "✓ " : ""}{m}
  </button>;
};

/* ─── LOGIN ───────────────────────────────────────────────────────── */
function Login({ onLogin, pins }) {
  const [sel, setSel] = useState(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShk] = useState(false);

  const tryLogin = () => {
    const correct = pins[sel] || DP[sel];
    if (correct === pin) { onLogin(sel); }
    else { setShk(true); setErr("Galat PIN! 🚫"); setPin(""); setTimeout(() => { setShk(false); setErr(""); }, 600); }
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(180deg,#e0f2fe 0%,#bfdbfe 40%,#dbeafe 100%)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:20, position:"relative", overflow:"hidden" }}>
      <style>{CSS}</style>
      <div style={{ position:"fixed", bottom:0, left:0, right:0, height:200, zIndex:0 }}><Mtn/></div>
      {[{ x:"10%",y:"10%",s:1 },{ x:"58%",y:"5%",s:.72 },{ x:"80%",y:"16%",s:.85 }].map((c,i) => (
        <div key={i} style={{ position:"fixed", left:c.x, top:c.y, transform:`scale(${c.s})`,
          animation:`cloudDrift ${6+i*2}s ease-in-out infinite alternate`, pointerEvents:"none", zIndex:0, opacity:.7 }}>
          <svg width="90" height="40" viewBox="0 0 90 40">
            <ellipse cx="45" cy="28" rx="40" ry="14" fill="white" opacity="0.8"/>
            <ellipse cx="30" cy="22" rx="22" ry="16" fill="white" opacity="0.8"/>
            <ellipse cx="58" cy="20" rx="18" ry="14" fill="white" opacity="0.8"/>
          </svg>
        </div>
      ))}
      <div className="fu" style={{ width:"100%", maxWidth:360, position:"relative", zIndex:1 }}>
        <div style={{ textAlign:"center", marginBottom:26 }}>
          <div style={{ fontSize:46, animation:"float 3s ease-in-out infinite" }}>🏔️</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:36, fontWeight:700, color:"#1e3a5f", letterSpacing:2 }}>GHAR.SYS</div>
          <div style={{ fontSize:11, color:"#64748b", letterSpacing:4, marginTop:2 }}>HAMRO GHAR — v9.0</div>
          <div style={{ fontSize:11, color:"#22c55e", marginTop:6, fontWeight:700 }}>
            <span style={{ width:6,height:6,background:"#22c55e",borderRadius:"50%",display:"inline-block",marginRight:4,animation:"pulse 1.5s infinite" }}/>
            LIVE — Real-time sync ON
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, marginBottom:18 }}>
          {[...MEMBERS, "Admin"].map(m => {
            const c = MC[m]; const active = sel === m;
            return <button key={m} className="btn" onClick={() => { setSel(m); setPin(""); setErr(""); }}
              style={{ padding:"13px 8px", borderRadius:14, background: active ? c.bg : "white",
                color: active ? "white" : c.text, border:`2px solid ${active ? c.bg : c.bg+"55"}`,
                fontSize:14, fontWeight:800, boxShadow: active ? `0 6px 20px ${c.glow}` : "0 2px 8px rgba(0,0,0,0.06)" }}>
              {m === "Admin" ? "⬡ ADMIN" : m.toUpperCase()}
            </button>;
          })}
        </div>
        {sel && <div className={`card pi ${shake ? "shake" : ""}`} style={{ padding:20 }}>
          <div style={{ display:"flex", justifyContent:"center", gap:14, marginBottom:16 }}>
            {[0,1,2,3].map(i => { const c = MC[sel]; const on = i < pin.length;
              return <div key={i} style={{ width:15,height:15,borderRadius:"50%",background:on ? c.bg : "#e2e8f0",
                boxShadow: on ? `0 0 10px ${c.glow}` : "", transform:on ? "scale(1.2)" : "scale(1)", transition:"all .2s cubic-bezier(.34,1.5,.64,1)" }}/>;
            })}
          </div>
          {err && <div style={{ textAlign:"center", color:"#ef4444", fontSize:13, marginBottom:10, fontWeight:700 }}>{err}</div>}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:7, marginBottom:11 }}>
            {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i) => (
              <button key={i} className="btn" onClick={() => { if(k==="⌫") setPin(p=>p.slice(0,-1)); else if(k!=="") setPin(p=>p.length<4?p+k:p); }}
                style={{ padding:"14px 0", borderRadius:11,
                  background:k==="⌫"?"#fee2e2":k===""?"transparent":"#f8fafc",
                  border:k===""?"none":`1.5px solid ${k==="⌫"?"#fca5a5":"#e2e8f0"}`,
                  color:k==="⌫"?"#ef4444":"#1e293b", fontSize:18, fontWeight:800, cursor:k===""?"default":"pointer" }}>
                {k}
              </button>
            ))}
          </div>
          <button className="btn" onClick={tryLogin} disabled={pin.length!==4}
            style={{ width:"100%", padding:"13px 0", borderRadius:12,
              background:pin.length===4?MC[sel].bg:"#f1f5f9",
              color:pin.length===4?"white":"#94a3b8", fontSize:15, fontWeight:800,
              boxShadow:pin.length===4?`0 6px 20px ${MC[sel].glow}`:"", transition:"all .2s" }}>
            BHITRA JAAUM →
          </button>
        </div>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  MAIN APP                                                           */
/* ═══════════════════════════════════════════════════════════════════ */
export default function App() {
  const [pins, setPins]         = useState(() => LS.g("g9_pins", DP));
  const [perms, setPerms]       = useState(() => LS.g("g9_perms", DPERMS));
  const [user, setUser]         = useState(() => LS.g("g9_user", null));
  const [tab, setTab]           = useState("aaja");
  const [tasks, setTasks]       = useState({});
  const [bills, setBills]       = useState([]);
  const [noteRaw, setNoteRaw]   = useState("");
  const [groceryItems, setGrocery] = useState([]);
  const [taskNotes, setTNotes]  = useState([]);
  const [settlements, setSettl] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [online, setOnline]     = useState(true);
  const [sparks, setSparks]     = useState([]);

  useEffect(() => { LS.s("g9_perms", perms); }, [perms]);
  useEffect(() => { LS.s("g9_user", user); }, [user]);
  useEffect(() => { LS.s("g9_pins", pins); }, [pins]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rawTasks, rawBills, rawNotes, rawGrocery, rawTNotes, rawSettl] = await Promise.all([
        db.get("tasks"), db.get("bills"), db.get("notes"),
        db.get("grocery_items"), db.get("task_notes"), db.get("settlements")
      ]);
      const tm = {};
      (rawTasks || []).forEach(r => { if (!tm[r.date]) tm[r.date] = {}; tm[r.date][`${r.task_id}_${r.member}`] = r.done_by || null; });
      setTasks(tm);
      setBills((rawBills || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
      setNoteRaw(rawNotes?.[0]?.content || "");
      setGrocery(rawGrocery || []);
      setTNotes(rawTNotes || []);
      setSettl(rawSettl || []);
      setOnline(true);
    } catch { setOnline(false); }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const ws = [
      db.sub("tasks", () => loadAll()),
      db.sub("bills", () => loadAll()),
      db.sub("notes", () => loadAll()),
      db.sub("grocery_items", () => loadAll()),
      db.sub("task_notes", () => loadAll()),
    ];
    return () => ws.forEach(w => w.close());
  }, [loadAll]);

  const isAdmin = user === "Admin";
  const up = perms[user] || {};
  const spark = (e, color) => {
    const r = e.currentTarget.getBoundingClientRect(), id = Date.now() + Math.random();
    setSparks(p => [...p, { id, x: r.left + r.width/2, y: r.top + r.height/2, color }]);
    setTimeout(() => setSparks(p => p.filter(s => s.id !== id)), 900);
  };

  const toggleTask = async (date, taskId, member, e) => {
    const key = `${taskId}_${member}`, curr = tasks[date]?.[key];
    if (!curr && e) spark(e, MC[member].bg);
    setTasks(p => ({ ...p, [date]: { ...p[date], [key]: curr ? null : member } }));
    await db.upsert("tasks", { date, task_id: taskId, member, done_by: curr ? null : member });
  };

  const saveNote = async (text) => {
    const val = JSON.stringify({ text, author: user, ts: new Date().toISOString() });
    setNoteRaw(val);
    await db.patch("notes", { id: 1 }, { content: val });
  };

  const addBill = async bill => {
    const res = await db.upsert("bills", { ...bill, created_at: new Date().toISOString() });
    if (res?.[0]) setBills(p => [...p, res[0]]);
    else loadAll();
  };

  const deleteBill = async id => { setBills(p => p.filter(b => b.id !== id)); await db.del("bills", id); };
  const updateBill = async (id, data) => { await db.patch("bills", { id }, data); loadAll(); };

  const addGroceryItem = async name => {
    const res = await db.upsert("grocery_items", { name, checked: false, created_by: user, created_at: new Date().toISOString() });
    if (res?.[0]) setGrocery(p => [...p, res[0]]);
    else loadAll();
  };

  const toggleGrocery = async (item) => {
    if (item.checked && !isAdmin) return;
    const upd = { checked: !item.checked, checked_by: !item.checked ? user : null };
    setGrocery(p => p.map(g => g.id === item.id ? { ...g, ...upd } : g));
    await db.patch("grocery_items", { id: item.id }, upd);
  };

  const deleteGroceryItem = async id => {
    setGrocery(p => p.filter(g => g.id !== id));
    await db.del("grocery_items", id);
  };

  const addTaskNote = async (taskId, date, content) => {
    const res = await db.upsert("task_notes", { task_id: taskId, date, content, author: user, created_at: new Date().toISOString() });
    if (res?.[0]) setTNotes(p => [...p, res[0]]);
    else loadAll();
  };

  const addSettlement = async (sData) => {
    const res = await db.upsert("settlements", { ...sData, settled_by: user, settled_at: new Date().toISOString() });
    if (res?.[0]) setSettl(p => [...p, res[0]]);
    else loadAll();
  };

  const login = u => { setUser(u); setTab("aaja"); };
  const logout = () => { setUser(null); LS.s("g9_user", null); };

  if (!user) return <Login onLogin={login} pins={pins}/>;

  const uc = MC[user] || MC.Admin;
  const mainTabs = [
    { id: "aaja",     label: "Aaja",    icon: "🌅", show: isAdmin || up.aaja },
    { id: "expenses", label: "Kharcha", icon: "💷", show: isAdmin || up.expenses },
    { id: "report",   label: "Report",  icon: "📊", show: isAdmin || up.report },
    { id: "admin",    label: "Admin",   icon: "⬡",  show: isAdmin },
  ].filter(t => t.show);

  const noteData = parseNote(noteRaw);

  return (
    <div style={{ minHeight:"100vh", fontFamily:"'Nunito',sans-serif", background:"linear-gradient(180deg,#f0f9ff 0%,#e8f4fd 100%)" }}>
      <style>{CSS}</style>
      {sparks.map(s => <Sparks key={s.id} x={s.x} y={s.y} color={s.color} onDone={() => setSparks(p => p.filter(x => x.id !== s.id))}/>)}

      {/* Header */}
      <div style={{ position:"relative", height:128, overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg,#bfdbfe 0%,#dbeafe 60%,#e0f2fe 100%)" }}/>
        <Mtn/>
        <div style={{ position:"absolute", top:14, left:0, right:0, padding:"0 18px", display:"flex", justifyContent:"space-between", alignItems:"flex-start", zIndex:2 }}>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:700, color:"#1e3a5f", textShadow:"0 1px 8px rgba(255,255,255,0.8)" }}>🏔️ GHAR.SYS</div>
            <div style={{ fontSize:10, color:"#3b82f6", letterSpacing:3, fontWeight:700 }}>SWAGAT {user.toUpperCase()} 👋</div>
            <div style={{ fontSize:10, color:online?"#22c55e":"#ef4444", fontWeight:700, marginTop:2 }}>
              <span style={{ width:6,height:6,background:online?"#22c55e":"#ef4444",borderRadius:"50%",display:"inline-block",marginRight:4,animation:online?"pulse 1.5s infinite":""}}/>
              {online ? "LIVE — Real-time ON" : "Offline..."}
            </div>
          </div>
          <button className="btn" onClick={logout}
            style={{ padding:"8px 13px", borderRadius:10, background:"rgba(255,255,255,0.75)", border:"1.5px solid #fca5a5", color:"#ef4444", fontSize:12, fontWeight:700, backdropFilter:"blur(8px)" }}>
            LOGOUT
          </button>
        </div>
      </div>

      <div style={{ maxWidth:500, margin:"0 auto", padding:"0 15px 100px" }}>
        {/* Main Tabs */}
        <div style={{ display:"flex", gap:7, padding:"12px 0 4px", overflowX:"auto", scrollbarWidth:"none" }}>
          {mainTabs.map(t => {
            const active = tab === t.id;
            return <button key={t.id} className="btn fu" onClick={() => setTab(t.id)}
              style={{ padding:"9px 16px", borderRadius:12, whiteSpace:"nowrap",
                background: active ? uc.bg : "white", color: active ? "white" : uc.text,
                border:`1.5px solid ${active ? uc.bg : uc.bg+"44"}`, fontSize:13, fontWeight:800,
                boxShadow: active ? `0 4px 14px ${uc.glow}` : "0 1px 5px rgba(0,0,0,0.06)" }}>
              {t.icon} {t.label}
            </button>;
          })}
        </div>

        {loading ? <Loading/> : <>
          {tab === "aaja"     && <AajaTab tasks={tasks} toggleTask={toggleTask} user={user} isAdmin={isAdmin} perms={perms}
              noteData={noteData} saveNote={saveNote} groceryItems={groceryItems} addGroceryItem={addGroceryItem}
              toggleGrocery={toggleGrocery} deleteGroceryItem={deleteGroceryItem}
              taskNotes={taskNotes} addTaskNote={addTaskNote}/>}
          {tab === "expenses" && <KharchaTab bills={bills} addBill={addBill} deleteBill={deleteBill} updateBill={updateBill}
              user={user} isAdmin={isAdmin} spark={spark}/>}
          {tab === "report"   && <ReportTab tasks={tasks} bills={bills} settlements={settlements} addSettlement={addSettlement} user={user} isAdmin={isAdmin}/>}
          {tab === "admin"    && isAdmin && <AdminTab perms={perms} setPerms={setPerms} pins={pins} setPins={setPins}
              bills={bills} tasks={tasks} toggleTask={toggleTask} deleteBill={deleteBill} updateBill={updateBill}
              groceryItems={groceryItems} deleteGroceryItem={deleteGroceryItem} user={user}/>}
        </>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  AAJA TAB                                                           */
/* ═══════════════════════════════════════════════════════════════════ */
function AajaTab({ tasks, toggleTask, user, isAdmin, perms, noteData, saveNote, groceryItems, addGroceryItem, toggleGrocery, deleteGroceryItem, taskNotes, addTaskNote }) {
  const [selDate, setSelDate]     = useState(today());
  const [groceryOpen, setGrocery] = useState(false);
  const [weeklyTask, setWeekly]   = useState(null);
  const [noteTask, setNoteTask]   = useState(null);

  const td = tasks[selDate] || {};
  const isToday = selDate === today();
  const canMark = m => isAdmin || m === user || !!perms[user]?.markOthers;

  const pendingGrocery = groceryItems.filter(g => !g.checked).length;

  return (
    <div>
      {/* Notes FIRST with author */}
      <div className="card fu" style={{ padding:16, marginBottom:14, border:"1.5px solid #fde68a", background:"#fffbeb" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <div style={{ fontSize:10, color:"#d97706", letterSpacing:3, fontWeight:700 }}>📝 NOTES & REMINDERS</div>
          {noteData.author && <div style={{ fontSize:11, color:"#92400e", fontWeight:700 }}>
            by {noteData.author} · {noteData.ts ? fmtTS(noteData.ts) : ""}
          </div>}
        </div>
        <textarea value={noteData.text} onChange={e => saveNote(e.target.value)}
          placeholder="Kei note garna xa? Kei kinnae xa, remind garna xa..."
          rows={3} style={{ width:"100%", padding:"10px 12px", fontSize:13, resize:"none", lineHeight:1.7,
            color:"#374151", background:"transparent", border:"1.5px solid #fcd34d", borderRadius:10 }}/>
      </div>

      {/* Grocery List Quick View */}
      {groceryItems.length > 0 && (
        <div className="card fu1" style={{ padding:"12px 16px", marginBottom:14, border:"1.5px solid #bbf7d0", background:"#f0fdf4",
          display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}
          onClick={() => setGrocery(true)}>
          <div style={{ fontSize:14, fontWeight:800, color:"#16a34a" }}>🛒 Grocery List</div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {pendingGrocery > 0 && <span style={{ padding:"3px 9px", borderRadius:20, background:"#dcfce7", color:"#16a34a", fontSize:12, fontWeight:700 }}>{pendingGrocery} baki</span>}
            <span style={{ fontSize:12, color:"#94a3b8", fontWeight:700 }}>{groceryItems.filter(g=>g.checked).length}/{groceryItems.length} ✓ →</span>
          </div>
        </div>
      )}

      {/* Date Selector */}
      <div className="card fu1" style={{ padding:"11px 14px", marginBottom:13, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#374151" }}>
          {isToday ? "📅 Aaja — " : isAdmin ? "✏️ " : ""}{fmtDS(selDate)}
          {!isToday && <span style={{ fontSize:11, color:"#94a3b8", marginLeft:6 }}>(past)</span>}
        </div>
        <div style={{ display:"flex", gap:7, alignItems:"center" }}>
          {isAdmin && <input type="date" value={selDate} max={today()} onChange={e => setSelDate(e.target.value)}
            style={{ padding:"7px 10px", fontSize:12, borderRadius:10, border:"1.5px solid #e2e8f0", cursor:"pointer" }}/>}
          {!isToday && <button className="btn" onClick={() => setSelDate(today())}
            style={{ padding:"6px 12px", borderRadius:9, background:"#eff6ff", border:"1.5px solid #93c5fd", color:"#1d4ed8", fontSize:11, fontWeight:700 }}>Aaja →</button>}
        </div>
      </div>

      <Divider label="DAILY KAAM"/>
      {DTASKS.map((t, i) => (
        <TaskCard key={t.id} task={t} td={td} date={selDate} canMark={canMark} toggleTask={toggleTask}
          delay={i*.06} isAdmin={isAdmin}
          onGroceryOpen={() => setGrocery(true)}
          onNoteOpen={() => setNoteTask(t)}
          taskNotes={taskNotes.filter(n => n.task_id === t.id && n.date === selDate)}/>
      ))}

      <Divider label="WEEKLY KAAM"/>
      {WTASKS.map((t, i) => (
        <TaskCard key={t.id} task={t} td={td} date={selDate} canMark={canMark} toggleTask={toggleTask}
          delay={i*.06} isAdmin={isAdmin} isWeekly
          onWeeklyOpen={() => setWeekly(t)}
          onNoteOpen={() => setNoteTask(t)}
          taskNotes={taskNotes.filter(n => n.task_id === t.id && n.date === selDate)}/>
      ))}

      {/* Grocery Modal */}
      {groceryOpen && (
        <Modal title="🛒 Grocery List" onClose={() => setGrocery(false)}>
          <GroceryList items={groceryItems} onAdd={addGroceryItem} onToggle={toggleGrocery} onDelete={deleteGroceryItem} isAdmin={isAdmin} user={user}/>
        </Modal>
      )}

      {/* Weekly Task Modal */}
      {weeklyTask && (
        <Modal title={`${weeklyTask.icon} ${weeklyTask.label}`} onClose={() => setWeekly(null)}>
          <div style={{ marginBottom:14, color:"#64748b", fontSize:13 }}>Kasle garyo yo hapta?</div>
          <div style={{ display:"flex", gap:9, flexWrap:"wrap" }}>
            {MEMBERS.map(m => {
              const mDone = td[`${weeklyTask.id}_${m}`];
              return canMark(m) ? (
                <button key={m} className="btn" onClick={e => { toggleTask(selDate, weeklyTask.id, m, e); setWeekly(null); }}
                  style={{ padding:"12px 18px", borderRadius:12, fontSize:14, fontWeight:800,
                    background: mDone ? MC[m].bg : MC[m].light, color: mDone ? "white" : MC[m].text,
                    border:`1.5px solid ${mDone ? MC[m].bg : MC[m].bg+"44"}`,
                    boxShadow: mDone ? `0 4px 14px ${MC[m].glow}` : "" }}>
                  {mDone ? "✓ " : ""}{m}
                </button>
              ) : (
                <div key={m} style={{ padding:"12px 18px", borderRadius:12, fontSize:14, fontWeight:800,
                  background: mDone ? MC[m].bg : "#f1f5f9", color: mDone ? "white" : "#94a3b8",
                  border:"1.5px solid #e2e8f0", opacity:.6 }}>
                  {mDone ? "✓ " : ""}{m}
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {/* Task Note Modal */}
      {noteTask && (
        <Modal title={`📝 ${noteTask.icon} ${noteTask.label} — Notes`} onClose={() => setNoteTask(null)}>
          <TaskNotePanel taskId={noteTask.id} date={selDate} notes={taskNotes.filter(n => n.task_id === noteTask.id && n.date === selDate)} onAdd={addTaskNote} user={user}/>
        </Modal>
      )}
    </div>
  );
}

/* ─── TASK CARD ───────────────────────────────────────────────────── */
function TaskCard({ task, td, date, canMark, toggleTask, delay, isAdmin, isWeekly, onGroceryOpen, onWeeklyOpen, onNoteOpen, taskNotes }) {
  const done = MEMBERS.find(m => td[`${task.id}_${m}`]);
  const dc = done ? MC[done] : null;
  const hasNotes = taskNotes?.length > 0;

  const handleClick = (m, e) => {
    if (!canMark(m)) return;
    if (task.isGrocery) { onGroceryOpen?.(); return; }
    if (isWeekly) { onWeeklyOpen?.(); return; }
    toggleTask(date, task.id, m, e);
  };

  return (
    <div className="card" style={{ marginBottom:10, padding:"13px 15px",
      border:`1.5px solid ${done ? dc.bg+"44" : "#f1f5f9"}`,
      boxShadow: done ? `0 4px 16px ${dc.glow}` : "0 2px 8px rgba(0,0,0,0.04)",
      animation:`fadeUp .36s ${delay}s both` }}>
      <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:10 }}>
        <span style={{ fontSize:21, display:"inline-block", animation: done ? "float 3s ease-in-out infinite" : "" }}>{task.icon}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:800, color: done ? dc.bg : "#374151" }}>{task.label}</div>
          {done && <div style={{ fontSize:11, color:dc.bg, fontWeight:700, marginTop:1 }}>✅ {done} le garyo!</div>}
          {isWeekly && !done && <div style={{ fontSize:11, color:"#94a3b8", marginTop:1 }}>↗ Click gara mark garna</div>}
        </div>
        <button className="btn" onClick={onNoteOpen}
          style={{ padding:"5px 9px", borderRadius:9, background: hasNotes ? "#fef3c7" : "#f8fafc",
            border:`1.5px solid ${hasNotes ? "#fcd34d" : "#e2e8f0"}`, fontSize:13,
            color: hasNotes ? "#d97706" : "#cbd5e1" }}>
          📝{hasNotes ? ` ${taskNotes.length}` : ""}
        </button>
      </div>
      {!isWeekly && (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {MEMBERS.map(m => {
            const mDone = td[`${task.id}_${m}`]; const mc = MC[m]; const can = canMark(m);
            return <button key={m} className="btn" onClick={e => handleClick(m, e)}
              style={{ padding:"6px 11px", borderRadius:9,
                background: mDone ? mc.bg : mc.light, color: mDone ? "white" : mc.text,
                border:`1.5px solid ${mDone ? mc.bg : mc.bg+"44"}`, fontSize:12, fontWeight:700,
                boxShadow: mDone ? `0 3px 10px ${mc.glow}` : "",
                opacity: can ? 1 : .4, cursor: can ? "pointer" : "not-allowed",
                transform: mDone ? "scale(1.04)" : "scale(1)", transition:"all .18s" }}>
              {mDone ? "✓ " : ""}{m}
            </button>;
          })}
          {task.isGrocery && <button className="btn" onClick={onGroceryOpen}
            style={{ padding:"6px 11px", borderRadius:9, background:"#dcfce7", border:"1.5px solid #86efac",
              color:"#16a34a", fontSize:12, fontWeight:700 }}>🛒 List Herna</button>}
        </div>
      )}
      {isWeekly && (
        <button className="btn" onClick={onWeeklyOpen}
          style={{ width:"100%", padding:"9px", borderRadius:10, background: done ? dc.light : "#f8fafc",
            border:`1.5px solid ${done ? dc.bg+"44" : "#e2e8f0"}`, color: done ? dc.text : "#64748b", fontSize:13, fontWeight:700 }}>
          {done ? `✓ ${done} le garyo — Badla Garne?` : "Kasle Garyo? Click Gara →"}
        </button>
      )}
    </div>
  );
}

/* ─── GROCERY LIST ────────────────────────────────────────────────── */
function GroceryList({ items, onAdd, onToggle, onDelete, isAdmin }) {
  const [newItem, setNewItem] = useState("");
  const inputRef = useRef(null);
  const unchecked = items.filter(g => !g.checked);
  const checked   = items.filter(g => g.checked);

  const handleAdd = async () => {
    const name = newItem.trim();
    if (!name) return;
    setNewItem("");
    await onAdd(name);
    inputRef.current?.focus();
  };

  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:18 }}>
        <input ref={inputRef} value={newItem} onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          placeholder="Naya item thap... (Enter)" style={{ flex:1, padding:"11px 13px", fontSize:13 }}/>
        <button className="btn" onClick={handleAdd}
          style={{ padding:"11px 16px", borderRadius:11, background:"#16a34a", color:"white", fontSize:13, fontWeight:700, boxShadow:"0 4px 12px #16a34a33" }}>
          + Thap
        </button>
      </div>
      {unchecked.length === 0 && checked.length === 0 && (
        <div style={{ textAlign:"center", color:"#94a3b8", fontSize:13, padding:30 }}>Grocery list khali xa 🛒</div>
      )}
      {unchecked.map(g => (
        <div key={g.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 13px", borderRadius:12, marginBottom:7, background:"#f8fafc", border:"1.5px solid #e2e8f0" }}>
          <button className="btn" onClick={() => onToggle(g)}
            style={{ width:24, height:24, borderRadius:6, border:"2px solid #16a34a", background:"white", cursor:"pointer", flexShrink:0 }}/>
          <span style={{ flex:1, fontSize:14, fontWeight:700, color:"#1e293b" }}>{g.name}</span>
          {g.created_by && <span style={{ fontSize:11, color:"#94a3b8" }}>by {g.created_by}</span>}
          {isAdmin && <button className="btn" onClick={() => onDelete(g.id)}
            style={{ padding:"3px 7px", borderRadius:7, background:"#fee2e2", border:"1px solid #fca5a5", color:"#ef4444", fontSize:11 }}>✕</button>}
        </div>
      ))}
      {checked.length > 0 && <div style={{ marginTop:14 }}>
        <div style={{ fontSize:10, color:"#94a3b8", letterSpacing:3, fontWeight:700, marginBottom:8 }}>KINI SAKYO ✓</div>
        {checked.map(g => (
          <div key={g.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 13px", borderRadius:12, marginBottom:6, background:"#f0fdf4", border:"1.5px solid #bbf7d0", opacity:.8 }}>
            <button className="btn" onClick={() => onToggle(g)} disabled={!isAdmin}
              style={{ width:24, height:24, borderRadius:6, border:"2px solid #16a34a", background:"#16a34a", cursor:isAdmin?"pointer":"default", flexShrink:0, fontSize:14 }}>✓</button>
            <span style={{ flex:1, fontSize:13, color:"#64748b", textDecoration:"line-through" }}>{g.name}</span>
            {g.checked_by && <span style={{ fontSize:11, color:"#16a34a", fontWeight:700 }}>{g.checked_by}</span>}
            {isAdmin && <button className="btn" onClick={() => onDelete(g.id)}
              style={{ padding:"3px 7px", borderRadius:7, background:"#fee2e2", border:"1px solid #fca5a5", color:"#ef4444", fontSize:11 }}>✕</button>}
          </div>
        ))}
        {!isAdmin && <div style={{ fontSize:11, color:"#94a3b8", textAlign:"center", marginTop:6 }}>🔒 Checked items admin le matra hataauna sakcha</div>}
      </div>}
    </div>
  );
}

/* ─── TASK NOTE PANEL ─────────────────────────────────────────────── */
function TaskNotePanel({ taskId, date, notes, onAdd, user }) {
  const [text, setText] = useState("");
  const handleAdd = async () => { if (!text.trim()) return; await onAdd(taskId, date, text.trim()); setText(""); };
  return (
    <div>
      {notes.length === 0 && <div style={{ color:"#94a3b8", fontSize:13, textAlign:"center", padding:"20px 0" }}>Kei note xaina abhi</div>}
      {notes.map(n => (
        <div key={n.id} style={{ padding:"11px 13px", borderRadius:12, background:"#fffbeb", border:"1.5px solid #fde68a", marginBottom:9 }}>
          <div style={{ fontSize:13, color:"#374151", lineHeight:1.6, marginBottom:5 }}>{n.content}</div>
          <div style={{ fontSize:11, color:"#d97706", fontWeight:700 }}>{n.author} · {fmtTS(n.created_at)}</div>
        </div>
      ))}
      <div style={{ marginTop:14, display:"flex", gap:8 }}>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Naya note thap..."
          rows={2} style={{ flex:1, padding:"10px 12px", fontSize:13, resize:"none" }}/>
        <button className="btn" onClick={handleAdd}
          style={{ padding:"10px 14px", borderRadius:11, background:"#d97706", color:"white", fontSize:13, fontWeight:700, alignSelf:"flex-end" }}>
          Thap
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  KHARCHA TAB                                                        */
/* ═══════════════════════════════════════════════════════════════════ */
function KharchaTab({ bills, addBill, deleteBill, updateBill, user, isAdmin, spark }) {
  const [sub, setSub] = useState("groceries");
  const subTabs = [
    { id: "groceries",   icon: "🛒", label: "Groceries" },
    { id: "electricity", icon: "⚡", label: "Electricity" },
    { id: "special",     icon: "✨", label: "Special" },
    { id: "history",     icon: "📋", label: "Sabai Bills" },
  ];

  const filteredBills = sub === "history" ? bills : bills.filter(b => b.cat === (sub === "groceries" ? "Groceries" : sub === "electricity" ? "Electricity" : "Special"));

  return (
    <div>
      <SubTabs tabs={subTabs} active={sub} onChange={setSub} color="#0369a1" colorLight="#e0f2fe"/>
      {sub === "groceries"   && <GroceriesForm bills={filteredBills} allBills={bills} addBill={addBill} deleteBill={deleteBill} user={user} isAdmin={isAdmin} spark={spark}/>}
      {sub === "electricity" && <ElectricitySection bills={filteredBills} allBills={bills} addBill={addBill} deleteBill={deleteBill} user={user} isAdmin={isAdmin}/>}
      {sub === "special"     && <SpecialSection bills={filteredBills} allBills={bills} addBill={addBill} deleteBill={deleteBill} user={user} isAdmin={isAdmin} spark={spark}/>}
      {sub === "history"     && <BillHistory bills={bills} allBills={bills} deleteBill={deleteBill} isAdmin={isAdmin}/>}
    </div>
  );
}

/* ─── GROCERIES FORM ──────────────────────────────────────────────── */
function GroceriesForm({ bills, allBills, addBill, deleteBill, user, isAdmin, spark }) {
  const [items, setItems]       = useState([{ name: "", amount: "" }]);
  const [paidBy, setPaid]       = useState(user !== "Admin" ? user : MEMBERS[0]);
  const [splits, setSplits]     = useState({});
  const [splitMode, setSplitMode] = useState(false);
  const [contribMode, setContribMode] = useState(false);
  const [contribs, setContribs] = useState([{ member: user !== "Admin" ? user : MEMBERS[0], amount: "" }]);
  const [note, setNote]         = useState("");
  const [saving, setSaving]     = useState(false);

  const total       = items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
  const splitTotal  = Object.values(splits).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const contribTotal = contribs.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);

  const submit = async e => {
    if (!items.some(it => it.name && it.amount)) return;
    setSaving(true);
    if (contribMode) {
      // Save separate bill per contributor
      const validContribs = contribs.filter(c => parseFloat(c.amount) > 0);
      for (const c of validContribs) {
        await addBill({
          cat: "Groceries", items: items.filter(it => it.name && it.amount),
          total: parseFloat(c.amount), paid_by: c.member,
          splits: {}, note: note || `Jamma: £${total.toFixed(2)}`, date: today(), added_by: user
        });
      }
      spark(e, MC[validContribs[0]?.member || paidBy].bg);
    } else {
      await addBill({
        cat: "Groceries", items: items.filter(it => it.name && it.amount), total, paid_by: paidBy,
        splits: splitMode ? splits : {}, note, date: today(), added_by: user
      });
      spark(e, MC[paidBy].bg);
    }
    setItems([{ name: "", amount: "" }]); setNote(""); setSplits({}); setSplitMode(false);
    setContribs([{ member: user !== "Admin" ? user : MEMBERS[0], amount: "" }]); setContribMode(false);
    setSaving(false);
  };

  return (
    <div>
      <div className="card fu" style={{ padding:18, marginBottom:14 }}>
        <div style={{ fontSize:11, color:"#16a34a", letterSpacing:3, marginBottom:14, fontWeight:700 }}>🛒 NAYA GROCERY BILL</div>

        {/* Items */}
        <div style={{ fontSize:10, color:"#64748b", letterSpacing:2, marginBottom:8, fontWeight:700 }}>ITEMS</div>
        {items.map((it, i) => (
          <div key={i} style={{ display:"flex", gap:7, marginBottom:7, alignItems:"center" }}>
            <input value={it.name} onChange={e => setItems(p => p.map((x,j) => j===i?{...x,name:e.target.value}:x))} placeholder="Item naam..."
              style={{ flex:2, padding:"9px 12px", fontSize:13 }}/>
            <div style={{ flex:1, display:"flex", alignItems:"center", background:"white", border:"1.5px solid #e2e8f0", borderRadius:11, overflow:"hidden" }}>
              <span style={{ padding:"0 7px", color:"#94a3b8", fontSize:13, fontWeight:700 }}>£</span>
              <input value={it.amount} onChange={e => setItems(p => p.map((x,j) => j===i?{...x,amount:e.target.value}:x))} type="number" placeholder="0.00"
                style={{ flex:1, padding:"9px 4px", border:"none", borderRadius:0, fontSize:13, background:"transparent" }}/>
            </div>
            {items.length > 1 && <button className="btn" onClick={() => setItems(p => p.filter((_,j) => j!==i))}
              style={{ padding:"9px 11px", borderRadius:9, background:"#fee2e2", border:"1.5px solid #fca5a5", color:"#ef4444" }}>✕</button>}
          </div>
        ))}
        <button className="btn" onClick={() => setItems(p => [...p, { name:"", amount:"" }])}
          style={{ width:"100%", padding:"8px", borderRadius:10, background:"#f8fafc", border:"1.5px dashed #cbd5e1", color:"#94a3b8", fontSize:12, fontWeight:700, marginBottom:12 }}>
          + Item Thap
        </button>

        {/* Payment mode toggle */}
        <div style={{ display:"flex", gap:7, marginBottom:12 }}>
          <button className="btn" onClick={() => { setContribMode(false); setSplitMode(false); }}
            style={{ flex:1, padding:"8px", borderRadius:10, fontSize:12, fontWeight:700,
              background:!contribMode&&!splitMode?"#dcfce7":"#f8fafc",
              color:!contribMode&&!splitMode?"#16a34a":"#94a3b8",
              border:`1.5px solid ${!contribMode&&!splitMode?"#86efac":"#e2e8f0"}` }}>
            1 janale tiryo
          </button>
          <button className="btn" onClick={() => { setContribMode(false); setSplitMode(true); }}
            style={{ flex:1, padding:"8px", borderRadius:10, fontSize:12, fontWeight:700,
              background:!contribMode&&splitMode?"#eff6ff":"#f8fafc",
              color:!contribMode&&splitMode?"#1d4ed8":"#94a3b8",
              border:`1.5px solid ${!contribMode&&splitMode?"#93c5fd":"#e2e8f0"}` }}>
            🔀 Split Garne
          </button>
          <button className="btn" onClick={() => { setContribMode(true); setSplitMode(false); }}
            style={{ flex:1, padding:"8px", borderRadius:10, fontSize:12, fontWeight:700,
              background:contribMode?"#fef3c7":"#f8fafc",
              color:contribMode?"#d97706":"#94a3b8",
              border:`1.5px solid ${contribMode?"#fcd34d":"#e2e8f0"}` }}>
            👥 Multiple
          </button>
        </div>

        {/* Single payer */}
        {!contribMode && !splitMode && <>
          <div style={{ fontSize:10, color:"#64748b", letterSpacing:2, marginBottom:7, fontWeight:700 }}>KASLE TIRYO?</div>
          <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:12 }}>
            {MEMBERS.map(m => <Chip key={m} m={m} active={paidBy===m} onClick={() => setPaid(m)}/>)}
          </div>
        </>}

        {/* Split mode */}
        {splitMode && !contribMode && <>
          <div style={{ fontSize:10, color:"#64748b", letterSpacing:2, marginBottom:7, fontWeight:700 }}>KASLE TIRYO?</div>
          <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:10 }}>
            {MEMBERS.map(m => <Chip key={m} m={m} active={paidBy===m} onClick={() => setPaid(m)}/>)}
          </div>
          <div style={{ padding:13, background:"#f0f9ff", borderRadius:12, border:"1.5px solid #bae6fd", marginBottom:12 }}>
            <div style={{ fontSize:10, color:"#0369a1", letterSpacing:2, marginBottom:9, fontWeight:700 }}>KASLE KATI SHARE GARCHA?</div>
            {MEMBERS.map(m => (
              <div key={m} style={{ display:"flex", alignItems:"center", gap:9, marginBottom:7 }}>
                <div style={{ width:55, fontSize:12, color:MC[m].text, fontWeight:700 }}>{m}</div>
                <div style={{ flex:1, display:"flex", alignItems:"center", background:"white", border:"1.5px solid #e2e8f0", borderRadius:9, overflow:"hidden" }}>
                  <span style={{ padding:"0 7px", color:"#94a3b8", fontSize:13 }}>£</span>
                  <input value={splits[m]||""} onChange={e => setSplits(p => ({...p,[m]:e.target.value}))} type="number" placeholder="0.00"
                    style={{ flex:1, padding:"8px 4px", border:"none", borderRadius:0, fontSize:13, background:"transparent" }}/>
                </div>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, fontWeight:700, marginTop:6,
              color:Math.abs(splitTotal-total)<.01&&splitTotal>0?"#16a34a":"#64748b" }}>
              <span>Split: {fmt$(splitTotal)}</span><span>Total: {fmt$(total)}</span>
            </div>
            {Math.abs(splitTotal-total)>.01&&splitTotal>0&&<div style={{ fontSize:11,color:"#ef4444",marginTop:4 }}>⚠️ Match garena!</div>}
          </div>
        </>}

        {/* Multiple contributors */}
        {contribMode && (
          <div style={{ padding:13, background:"#fffbeb", borderRadius:12, border:"1.5px solid #fcd34d", marginBottom:12 }}>
            <div style={{ fontSize:10, color:"#d97706", letterSpacing:2, marginBottom:9, fontWeight:700 }}>KASLE KATI CONTRIBUTE GARYO? (Optional)</div>
            {contribs.map((c, i) => (
              <div key={i} style={{ display:"flex", gap:8, marginBottom:8, alignItems:"center" }}>
                <select value={c.member} onChange={e => setContribs(p => p.map((x,j) => j===i?{...x,member:e.target.value}:x))}
                  style={{ flex:1, padding:"9px 11px", fontSize:13 }}>
                  {MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <div style={{ flex:1, display:"flex", alignItems:"center", background:"white", border:"1.5px solid #e2e8f0", borderRadius:11, overflow:"hidden" }}>
                  <span style={{ padding:"0 7px", color:"#d97706", fontWeight:700 }}>£</span>
                  <input value={c.amount} onChange={e => setContribs(p => p.map((x,j) => j===i?{...x,amount:e.target.value}:x))} type="number" placeholder="0.00"
                    style={{ flex:1, padding:"9px 4px", border:"none", borderRadius:0, fontSize:13, background:"transparent" }}/>
                </div>
                {contribs.length > 1 && <button className="btn" onClick={() => setContribs(p => p.filter((_,j) => j!==i))}
                  style={{ padding:"9px 11px", borderRadius:9, background:"#fee2e2", border:"1.5px solid #fca5a5", color:"#ef4444" }}>✕</button>}
              </div>
            ))}
            <button className="btn" onClick={() => setContribs(p => [...p, { member:MEMBERS[0], amount:"" }])}
              style={{ width:"100%", padding:"7px", borderRadius:9, background:"#fffbeb", border:"1.5px dashed #fcd34d", color:"#d97706", fontSize:12, fontWeight:700, marginTop:3 }}>
              + Contributor Thap
            </button>
            {contribTotal > 0 && <div style={{ fontSize:12, fontWeight:700, marginTop:8, color:Math.abs(contribTotal-total)<.01?"#16a34a":"#94a3b8" }}>
              Contributed: {fmt$(contribTotal)} / Total: {fmt$(total)} {Math.abs(contribTotal-total)>.01&&contribTotal>0?"⚠️ Match garena!":""}
            </div>}
          </div>
        )}

        <input value={note} onChange={e => setNote(e.target.value)} placeholder="📝 Note (optional)..."
          style={{ width:"100%", padding:"9px 12px", fontSize:13, marginBottom:13 }}/>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:22, fontWeight:900, color:"#1e293b" }}>£<span style={{ color:CC.Groceries }}>{total.toFixed(2)}</span></div>
          <button className="btn" onClick={submit} disabled={saving||!items.some(it=>it.name&&it.amount)}
            style={{ padding:"12px 20px", borderRadius:12, background:`linear-gradient(135deg,${MC[paidBy].bg},${MC[paidBy].bg}bb)`,
              color:"white", fontSize:14, fontWeight:800, boxShadow:`0 6px 20px ${MC[paidBy].glow}`, opacity:saving||!items.some(it=>it.name&&it.amount)?.7:1 }}>
            {saving?"Saving...":"SAVE ✓"}
          </button>
        </div>
      </div>
      {bills.length > 0 && <BillList bills={bills} allBills={allBills} deleteBill={deleteBill} isAdmin={isAdmin}/>}
    </div>
  );
}

/* ─── ELECTRICITY SECTION ─────────────────────────────────────────── */
function ElectricitySection({ bills, allBills, addBill, deleteBill, user, isAdmin }) {
  const [entries, setEntries] = useState([{ member: user !== "Admin" ? user : MEMBERS[0], amount: "" }]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const total = entries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  const submit = async () => {
    if (!entries.some(e => e.amount)) return;
    setSaving(true);
    const validEntries = entries.filter(e => parseFloat(e.amount) > 0);
    for (const entry of validEntries) {
      await addBill({
        cat: "Electricity", items: [], total: parseFloat(entry.amount),
        paid_by: entry.member, splits: {}, note: note || "", date: today(), added_by: user
      });
    }
    setEntries([{ member: user !== "Admin" ? user : MEMBERS[0], amount: "" }]);
    setNote(""); setSaving(false);
  };

  return (
    <div>
      <div className="card fu" style={{ padding:18, marginBottom:14, border:"1.5px solid #fde68a", background:"#fffbeb" }}>
        <div style={{ fontSize:11, color:"#d97706", letterSpacing:3, marginBottom:14, fontWeight:700 }}>⚡ ELECTRICITY CONTRIBUTION</div>
        <div style={{ fontSize:10, color:"#92400e", letterSpacing:2, marginBottom:9, fontWeight:700 }}>KASLE KATI HALYO?</div>
        {entries.map((en, i) => (
          <div key={i} style={{ display:"flex", gap:8, marginBottom:9, alignItems:"center" }}>
            <select value={en.member} onChange={e => setEntries(p => p.map((x,j) => j===i?{...x,member:e.target.value}:x))}
              style={{ flex:1, padding:"9px 12px", fontSize:13 }}>
              {MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <div style={{ flex:1, display:"flex", alignItems:"center", background:"white", border:"1.5px solid #e2e8f0", borderRadius:11, overflow:"hidden" }}>
              <span style={{ padding:"0 7px", color:"#d97706", fontSize:13, fontWeight:700 }}>£</span>
              <input value={en.amount} onChange={e => setEntries(p => p.map((x,j) => j===i?{...x,amount:e.target.value}:x))} type="number" placeholder="0.00"
                style={{ flex:1, padding:"9px 4px", border:"none", borderRadius:0, fontSize:13, background:"transparent" }}/>
            </div>
            {entries.length > 1 && <button className="btn" onClick={() => setEntries(p => p.filter((_,j) => j!==i))}
              style={{ padding:"9px 11px", borderRadius:9, background:"#fee2e2", border:"1.5px solid #fca5a5", color:"#ef4444" }}>✕</button>}
          </div>
        ))}
        <button className="btn" onClick={() => setEntries(p => [...p, { member:MEMBERS[0], amount:"" }])}
          style={{ width:"100%", padding:"8px", borderRadius:10, background:"#fffbeb", border:"1.5px dashed #fcd34d", color:"#d97706", fontSize:12, fontWeight:700, marginBottom:10 }}>
          + Aru Contributor Thap
        </button>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="📝 Note (e.g. February bill)..."
          style={{ width:"100%", padding:"9px 12px", fontSize:13, marginBottom:13 }}/>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:20, fontWeight:900, color:"#d97706" }}>£{total.toFixed(2)}</div>
          <button className="btn" onClick={submit} disabled={saving||total===0}
            style={{ padding:"12px 20px", borderRadius:12, background:"linear-gradient(135deg,#d97706,#b45309)",
              color:"white", fontSize:14, fontWeight:800, boxShadow:"0 6px 20px #d9770633", opacity:saving||total===0?.6:1 }}>
            {saving?"Saving...":"SAVE ⚡"}
          </button>
        </div>
      </div>
      {/* Show electricity bills */}
      {bills.length > 0 && (
        <div>
          <Divider label="ELECTRICITY RECORDS"/>
          {[...bills].reverse().map(b => {
            const mc = MC[b.paid_by] || MC.Admin;
            const bNum = (allBills||bills).findIndex(x => x.id === b.id) + 1;
            return <div key={b.id} className="card" style={{ padding:"12px 14px", marginBottom:9, border:`1.5px solid #fde68a` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:4 }}>
                    <span style={{ padding:"2px 7px", borderRadius:8, background:"#1e293b", color:"white", fontSize:10, fontWeight:900 }}>#{bNum}</span>
                    <span style={{ padding:"3px 9px", borderRadius:20, background:mc.light, color:mc.text, fontSize:11, fontWeight:700 }}>{b.paid_by}</span>
                    <span style={{ fontSize:11, color:"#94a3b8" }}>{fmtD(b.date)}</span>
                  </div>
                  {b.note && <span style={{ fontSize:11, color:"#d97706" }}>· {b.note}</span>}
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontSize:17, fontWeight:900, color:"#d97706" }}>{fmt$(b.total)}</span>
                  {isAdmin && <button className="btn" onClick={() => deleteBill(b.id)}
                    style={{ padding:"3px 7px", borderRadius:7, background:"#fee2e2", border:"1px solid #fca5a5", color:"#ef4444", fontSize:11 }}>🗑️</button>}
                </div>
              </div>
            </div>;
          })}
        </div>
      )}
    </div>
  );
}

/* ─── SPECIAL SECTION ─────────────────────────────────────────────── */
function SpecialSection({ bills, allBills, addBill, deleteBill, user, isAdmin, spark }) {
  const [selMembers, setSelMembers] = useState([]);
  const [desc, setDesc] = useState("");
  const [totalAmt, setTotalAmt] = useState("");
  const [paidBy, setPaid] = useState(user !== "Admin" ? user : MEMBERS[0]);
  const [customSplits, setCustomSplits] = useState({});
  const [splitEqual, setSplitEqual] = useState(true);
  const [saving, setSaving] = useState(false);

  const total = parseFloat(totalAmt) || 0;
  const perPerson = selMembers.length > 0 ? total / selMembers.length : 0;
  const splitTotal = splitEqual ? total : Object.values(customSplits).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  const toggleMember = m => setSelMembers(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m]);

  const submit = async e => {
    if (!desc || !total || selMembers.length === 0) return;
    setSaving(true);
    const sp = splitEqual
      ? Object.fromEntries(selMembers.map(m => [m, perPerson.toFixed(2)]))
      : customSplits;
    await addBill({ cat:"Special", items:[{ name:desc, amount:totalAmt }], total,
      paid_by:paidBy, splits:sp, note:`Members: ${selMembers.join(", ")}`, date:today(), added_by:user });
    spark(e, MC[paidBy].bg);
    setDesc(""); setTotalAmt(""); setSelMembers([]); setCustomSplits({}); setSplitEqual(true);
    setSaving(false);
  };

  return (
    <div>
      <div className="card fu" style={{ padding:18, marginBottom:14, border:"1.5px solid #fbcfe8", background:"#fdf2f8" }}>
        <div style={{ fontSize:11, color:"#db2777", letterSpacing:3, marginBottom:14, fontWeight:700 }}>✨ SPECIAL / SHARED EXPENSE</div>
        <div style={{ fontSize:10, color:"#9d174d", letterSpacing:2, marginBottom:9, fontWeight:700 }}>KO KO INVOLVED XA?</div>
        <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:14 }}>
          {MEMBERS.map(m => <Chip key={m} m={m} active={selMembers.includes(m)} onClick={() => toggleMember(m)}/>)}
        </div>
        {selMembers.length > 0 && <>
          <div style={{ fontSize:10, color:"#9d174d", letterSpacing:2, marginBottom:9, fontWeight:700 }}>KASLE TIRYO?</div>
          <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:14 }}>
            {selMembers.map(m => <Chip key={m} m={m} active={paidBy===m} onClick={() => setPaid(m)} small/>)}
          </div>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Kaam ko description (e.g. Restaurant, Trip)..."
            style={{ width:"100%", padding:"9px 12px", fontSize:13, marginBottom:9 }}/>
          <div style={{ display:"flex", alignItems:"center", background:"white", border:"1.5px solid #e2e8f0", borderRadius:11, overflow:"hidden", marginBottom:12 }}>
            <span style={{ padding:"0 11px", color:"#db2777", fontSize:16, fontWeight:700 }}>£</span>
            <input value={totalAmt} onChange={e => setTotalAmt(e.target.value)} type="number" placeholder="Total amount..."
              style={{ flex:1, padding:"11px 4px", border:"none", borderRadius:0, fontSize:15, fontWeight:700, background:"transparent" }}/>
          </div>
          <button className="btn" onClick={() => setSplitEqual(p => !p)}
            style={{ width:"100%", padding:"8px", borderRadius:10, background:splitEqual?"#fdf2f8":"#fff",
              border:`1.5px solid ${splitEqual?"#fbcfe8":"#e2e8f0"}`, color:splitEqual?"#db2777":"#94a3b8",
              fontSize:12, fontWeight:700, marginBottom:splitEqual?0:10 }}>
            {splitEqual ? `✓ Equal Split — ${fmt$(perPerson)} each` : "Custom Split"}
          </button>
          {!splitEqual && selMembers.map(m => (
            <div key={m} style={{ display:"flex", alignItems:"center", gap:9, marginTop:7 }}>
              <div style={{ width:60, fontSize:12, color:MC[m].text, fontWeight:700 }}>{m}</div>
              <div style={{ flex:1, display:"flex", alignItems:"center", background:"white", border:"1.5px solid #e2e8f0", borderRadius:9, overflow:"hidden" }}>
                <span style={{ padding:"0 7px", color:"#94a3b8" }}>£</span>
                <input value={customSplits[m]||""} onChange={e => setCustomSplits(p => ({...p,[m]:e.target.value}))} type="number" placeholder="0.00"
                  style={{ flex:1, padding:"8px 4px", border:"none", borderRadius:0, fontSize:13, background:"transparent" }}/>
              </div>
            </div>
          ))}
          {!splitEqual && <div style={{ fontSize:12, fontWeight:700, marginTop:7, color:Math.abs(splitTotal-total)<.01&&splitTotal>0?"#16a34a":"#94a3b8" }}>
            Split: {fmt$(splitTotal)} / Total: {fmt$(total)}
          </div>}
          <button className="btn" onClick={submit} disabled={saving||!desc||!total||selMembers.length===0}
            style={{ width:"100%", padding:"12px", borderRadius:12, background:"linear-gradient(135deg,#db2777,#be185d)",
              color:"white", fontSize:14, fontWeight:800, boxShadow:"0 6px 20px #db277733", marginTop:14,
              opacity:saving||!desc||!total||selMembers.length===0?.6:1 }}>
            {saving?"Saving...":"SAVE ✨"}
          </button>
        </>}
        {selMembers.length === 0 && <div style={{ textAlign:"center", color:"#94a3b8", fontSize:13, padding:"10px 0" }}>Pahile members select gara</div>}
      </div>
      {bills.length > 0 && (
        <div>
          <Divider label="SPECIAL RECORDS"/>
          {[...bills].reverse().map(b => {
            const mc = MC[b.paid_by] || MC.Admin;
            const members = b.note?.replace("Members: ","")?.split(", ") || [];
            const bNum = (allBills||bills).findIndex(x => x.id === b.id) + 1;
            return <div key={b.id} className="card" style={{ padding:"13px 15px", marginBottom:9, border:"1.5px solid #fbcfe8" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                <div>
                  <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:5 }}>
                    <span style={{ padding:"2px 7px", borderRadius:8, background:"#1e293b", color:"white", fontSize:10, fontWeight:900 }}>#{bNum}</span>
                    <span style={{ fontSize:14, fontWeight:800, color:"#db2777" }}>{b.items?.[0]?.name || "Special"}</span>
                  </div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    <span style={{ padding:"2px 8px", borderRadius:20, background:mc.light, color:mc.text, fontSize:11, fontWeight:700 }}>Paid: {b.paid_by}</span>
                    {members.map(m => <span key={m} className="tag" style={{ background:MC[m]?.light||"#f1f5f9", color:MC[m]?.text||"#374151" }}>{m}</span>)}
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontSize:18, fontWeight:900, color:"#db2777" }}>{fmt$(b.total)}</span>
                  {isAdmin && <button className="btn" onClick={() => deleteBill(b.id)}
                    style={{ padding:"3px 7px", borderRadius:7, background:"#fee2e2", border:"1px solid #fca5a5", color:"#ef4444", fontSize:11 }}>🗑️</button>}
                </div>
              </div>
              {b.splits && Object.keys(b.splits).length > 0 && (
                <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginTop:6 }}>
                  {Object.entries(b.splits).map(([m, v]) => parseFloat(v)>0 && (
                    <span key={m} style={{ fontSize:11, color:MC[m]?.text||"#374151", fontWeight:700, background:MC[m]?.light||"#f1f5f9", padding:"2px 8px", borderRadius:20 }}>
                      {m}: {fmt$(v)}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ fontSize:11, color:"#94a3b8", marginTop:5 }}>{fmtD(b.date)}</div>
            </div>;
          })}
        </div>
      )}
    </div>
  );
}

/* ─── BILL LIST ───────────────────────────────────────────────────── */
function BillList({ bills, allBills, deleteBill, isAdmin }) {
  return (
    <div>
      {[...bills].reverse().map((b, bi) => {
        const mc = MC[b.paid_by] || MC.Admin;
        const bNum = (allBills||bills).findIndex(x => x.id === b.id) + 1;
        return <div key={b.id} className="card fu" style={{ padding:"13px 14px", marginBottom:9, border:`1.5px solid ${mc.bg}33` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:7 }}>
            <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
              <span style={{ padding:"2px 7px", borderRadius:8, background:"#1e293b", color:"white", fontSize:10, fontWeight:900 }}>#{bNum}</span>
              <span style={{ padding:"3px 9px", borderRadius:20, background:mc.light, color:mc.text, fontSize:11, fontWeight:700 }}>{b.paid_by}</span>
              <span style={{ fontSize:11, color:"#94a3b8" }}>{fmtD(b.date)}</span>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <span style={{ fontSize:17, fontWeight:900, color:mc.text }}>{fmt$(b.total)}</span>
              {isAdmin && <button className="btn" onClick={() => deleteBill(b.id)}
                style={{ padding:"3px 7px", borderRadius:7, background:"#fee2e2", border:"1px solid #fca5a5", color:"#ef4444", fontSize:11 }}>🗑️</button>}
            </div>
          </div>
          {(b.items||[]).map((it,i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#64748b", padding:"3px 0", borderBottom:"1px solid #f1f5f9" }}>
              <span>{it.name}</span><span>{fmt$(it.amount)}</span>
            </div>
          ))}
          {b.note && <div style={{ marginTop:6, fontSize:12, color:"#d97706", fontStyle:"italic" }}>📝 {b.note}</div>}
        </div>;
      })}
    </div>
  );
}

/* ─── BILL HISTORY ────────────────────────────────────────────────── */
function BillHistory({ bills, allBills, deleteBill, isAdmin }) {
  const [filter, setFilter] = useState("All");
  const filtered = filter === "All" ? bills : bills.filter(b => b.cat === filter || b.paid_by === filter);
  return (
    <div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:13 }}>
        {["All", ...CATS, ...MEMBERS].map(f => (
          <button key={f} className="btn" onClick={() => setFilter(f)}
            style={{ padding:"6px 11px", borderRadius:20, background:filter===f?"#1e293b":"white",
              color:filter===f?"white":"#64748b", border:`1.5px solid ${filter===f?"#1e293b":"#e2e8f0"}`, fontSize:11, fontWeight:700 }}>
            {f}
          </button>
        ))}
      </div>
      {filtered.length===0 && <div style={{ textAlign:"center", color:"#cbd5e1", padding:48, fontSize:14 }}>Kei bill xaina 📭</div>}
      <BillList bills={filtered} allBills={allBills||bills} deleteBill={deleteBill} isAdmin={isAdmin}/>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  REPORT TAB                                                         */
/* ═══════════════════════════════════════════════════════════════════ */
function ReportTab({ tasks, bills, settlements, addSettlement, user, isAdmin }) {
  const [range, setRange] = useState("weekly");
  const [sub, setSub] = useState("overview");

  const t = today(), wk = wkSt(t);
  const inRange = d => range === "weekly" ? wkSt(d) === wk : d.slice(0,7) === t.slice(0,7);

  const fBills = bills.filter(b => inRange(b.date));
  const allBillsForSettlement = bills.filter(b => !b.settled);

  const taskCounts = Object.fromEntries(MEMBERS.map(m => [m, 0]));
  Object.entries(tasks).forEach(([date, dt]) => {
    if (!inRange(date)) return;
    Object.values(dt).forEach(v => { if (v && taskCounts[v] !== undefined) taskCounts[v]++; });
  });
  const totalTasks = Object.values(taskCounts).reduce((s, v) => s + v, 0);
  const taskSorted = [...MEMBERS].sort((a, b) => taskCounts[b] - taskCounts[a]);
  const medals = ["🥇","🥈","🥉","4️⃣"];

  const spending = Object.fromEntries(MEMBERS.map(m => [m, 0]));
  const catSpend = Object.fromEntries(CATS.map(c => [c, 0]));
  fBills.forEach(b => { spending[b.paid_by] = (spending[b.paid_by]||0) + Number(b.total); catSpend[b.cat] = (catSpend[b.cat]||0) + Number(b.total); });
  const totalSpend = Object.values(spending).reduce((s, v) => s + v, 0);
  const avgSpend = totalSpend / MEMBERS.length;

  const subTabs = [
    { id:"overview",    icon:"🌟", label:"Overview" },
    { id:"kaam",        icon:"⚡", label:"Kaam" },
    { id:"kharcha",     icon:"💷", label:"Kharcha" },
    { id:"settlement",  icon:"🤝", label:"Settlement" },
    { id:"history",     icon:"📜", label:"History" },
    { id:"personal",    icon:"👤", label:"Personal" },
  ];

  return (
    <div>
      <div className="fu" style={{ display:"flex", gap:7, marginBottom:12 }}>
        {["weekly","monthly"].map(r => (
          <button key={r} className="btn" onClick={() => setRange(r)}
            style={{ padding:"8px 16px", borderRadius:11, background:range===r?"#1e293b":"white",
              color:range===r?"white":"#374151", border:`1.5px solid ${range===r?"#1e293b":"#e2e8f0"}`,
              fontSize:13, fontWeight:800, boxShadow:range===r?"0 3px 10px rgba(0,0,0,0.15)":"0 1px 4px rgba(0,0,0,0.05)" }}>
            {r.toUpperCase()}
          </button>
        ))}
      </div>
      <SubTabs tabs={subTabs} active={sub} onChange={setSub} color="#1e293b" colorLight="#f8fafc"/>

      {sub === "overview" && <OverviewSection taskCounts={taskCounts} taskSorted={taskSorted} totalTasks={totalTasks} medals={medals} spending={spending} totalSpend={totalSpend} avgSpend={avgSpend}/>}
      {sub === "kaam"     && <KaamSection tasks={tasks} taskCounts={taskCounts} taskSorted={taskSorted} totalTasks={totalTasks} medals={medals} inRange={inRange}/>}
      {sub === "kharcha"  && <KharchaSection fBills={fBills} spending={spending} catSpend={catSpend} totalSpend={totalSpend}/>}
      {sub === "settlement" && <SettlementSection bills={allBillsForSettlement} isAdmin={isAdmin} addSettlement={addSettlement} user={user}/>}
      {sub === "history"  && <HistorySection settlements={settlements}/>}
      {sub === "personal" && <PersonalSection bills={bills} tasks={tasks} user={user} inRange={inRange}/>}
    </div>
  );
}

/* ─── OVERVIEW SECTION ────────────────────────────────────────────── */
function OverviewSection({ taskCounts, taskSorted, totalTasks, medals, spending, totalSpend, avgSpend }) {
  const topWorker = taskSorted[0];
  const topSpender = [...MEMBERS].sort((a,b) => spending[b] - spending[a])[0];
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
        {[
          { icon:"💷", label:"Total Kharcha", value:fmt$(totalSpend), color:"#b45309", bg:"#fef3c7" },
          { icon:"👤", label:"Avg Per Person", value:fmt$(avgSpend), color:"#0369a1", bg:"#e0f2fe" },
          { icon:"⚡", label:"Total Kaam", value:totalTasks, color:"#7c3aed", bg:"#ede9fe" },
          { icon:"🏆", label:"Top Worker", value:topWorker, color:MC[topWorker]?.bg||"#374151", bg:MC[topWorker]?.light||"#f1f5f9" },
        ].map((s, i) => (
          <div key={i} className="card fu" style={{ padding:16, background:s.bg, border:`1.5px solid ${s.color}22`, animation:`fadeUp .36s ${i*.07}s both` }}>
            <div style={{ fontSize:22 }}>{s.icon}</div>
            <div style={{ fontSize:20, fontWeight:900, color:s.color, margin:"6px 0 3px" }}>{s.value}</div>
            <div style={{ fontSize:11, color:"#64748b", fontWeight:700 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div className="card fu1" style={{ padding:20, marginBottom:12 }}>
        <div style={{ fontSize:11, color:"#64748b", letterSpacing:3, marginBottom:14, fontWeight:700 }}>TASK RINGS</div>
        <div style={{ display:"flex", justifyContent:"space-around", flexWrap:"wrap", gap:12 }}>
          {taskSorted.map((m, i) => <Ring key={m} value={taskCounts[m]} max={Math.max(...Object.values(taskCounts),1)} color={MC[m].bg} label={m} sub={medals[i]}/>)}
        </div>
      </div>
      <div className="card fu2" style={{ padding:20 }}>
        <div style={{ fontSize:11, color:"#64748b", letterSpacing:3, marginBottom:14, fontWeight:700 }}>KHARCHA OVERVIEW</div>
        <BarChart data={[...MEMBERS].sort((a,b)=>spending[b]-spending[a]).map(m => ({ key:m, label:m, value:spending[m] }))} colorFn={k => MC[k].bg} unit="£"/>
      </div>
    </div>
  );
}

/* ─── KAAM SECTION ────────────────────────────────────────────────── */
function KaamSection({ tasks, taskCounts, taskSorted, totalTasks, medals, inRange }) {
  return (
    <div>
      <div className="card fu" style={{ padding:20, marginBottom:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
          <div style={{ fontSize:11, color:"#64748b", fontWeight:700, letterSpacing:2 }}>LEADERBOARD</div>
          <div style={{ fontSize:11, color:"#94a3b8" }}>Jamma: {totalTasks}</div>
        </div>
        <BarChart data={taskSorted.map(m => ({ key:m, label:`${medals[taskSorted.indexOf(m)]} ${m}`, value:taskCounts[m] }))} colorFn={k => MC[k].bg}/>
      </div>
      <div className="card fu1" style={{ padding:18 }}>
        <div style={{ fontSize:11, color:"#64748b", fontWeight:700, letterSpacing:2, marginBottom:14 }}>TASK BREAKDOWN</div>
        {[...DTASKS,...WTASKS].map(task => {
          const who = Object.fromEntries(MEMBERS.map(m => [m, 0]));
          Object.entries(tasks).forEach(([date, dt]) => {
            if (!inRange(date)) return;
            MEMBERS.forEach(m => { if (dt[`${task.id}_${m}`]) who[m]++; });
          });
          const tt = Object.values(who).reduce((s,v) => s+v, 0);
          return <div key={task.id} style={{ marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
              <span style={{ fontSize:13, color:"#374151", fontWeight:700 }}>{task.icon} {task.label}</span>
              <span style={{ fontSize:11, color:"#94a3b8" }}>{tt}x</span>
            </div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
              {MEMBERS.filter(m => who[m]>0).map(m => (
                <span key={m} className="tag" style={{ background:MC[m].light, color:MC[m].text }}>{m} {who[m]}</span>
              ))}
              {tt===0 && <span style={{ fontSize:11, color:"#cbd5e1" }}>Kasaile garena</span>}
            </div>
          </div>;
        })}
      </div>
    </div>
  );
}

/* ─── KHARCHA SECTION ─────────────────────────────────────────────── */
function KharchaSection({ fBills, spending, catSpend, totalSpend }) {
  return (
    <div>
      <div className="card fu" style={{ padding:20, marginBottom:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
          <div style={{ fontSize:11, color:"#64748b", fontWeight:700, letterSpacing:2 }}>KASLE KATI TIRYO</div>
          <div style={{ fontSize:18, fontWeight:900, color:"#b45309" }}>{fmt$(totalSpend)}</div>
        </div>
        <BarChart data={[...MEMBERS].sort((a,b)=>spending[b]-spending[a]).map(m => ({ key:m, label:m, value:spending[m] }))} colorFn={k => MC[k].bg} unit="£"/>
        <div style={{ marginTop:14, padding:"10px 13px", background:"#f8fafc", borderRadius:11 }}>
          <div style={{ fontSize:11, color:"#94a3b8", fontWeight:700, marginBottom:6 }}>IDEAL SPLIT ({fmt$(totalSpend/MEMBERS.length)} each)</div>
          <BarChart data={MEMBERS.map(m => ({ key:m, label:m, value:Math.max(0, spending[m] - totalSpend/MEMBERS.length) }))} colorFn={k => MC[k].bg} unit="£+"/>
        </div>
      </div>
      <div className="card fu1" style={{ padding:18, marginBottom:12 }}>
        <div style={{ fontSize:11, color:"#64748b", fontWeight:700, letterSpacing:2, marginBottom:14 }}>CATEGORY BREAKDOWN</div>
        <BarChart data={CATS.map(c => ({ key:c, label:`${CI[c]} ${c}`, value:catSpend[c]||0 }))} colorFn={k => CC[k]} unit="£"/>
      </div>
      {fBills.length > 0 && (
        <div className="card fu2" style={{ padding:18 }}>
          <div style={{ fontSize:11, color:"#64748b", fontWeight:700, letterSpacing:2, marginBottom:12 }}>RECENT BILLS</div>
          {[...fBills].reverse().slice(0,10).map(b => {
            const mc = MC[b.paid_by] || MC.Admin;
            return <div key={b.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #f1f5f9", alignItems:"center" }}>
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <span style={{ fontSize:12, color:mc.text, fontWeight:700 }}>{b.paid_by}</span>
                <span style={{ fontSize:11, color:"#94a3b8" }}>{CI[b.cat]}</span>
                <span style={{ fontSize:11, color:"#cbd5e1" }}>{fmtD(b.date)}</span>
              </div>
              <span style={{ fontSize:15, fontWeight:900, color:mc.text }}>{fmt$(b.total)}</span>
            </div>;
          })}
        </div>
      )}
    </div>
  );
}

/* ─── SETTLEMENT SECTION ──────────────────────────────────────────── */
function SettlementSection({ bills, isAdmin, addSettlement, user }) {
  const [partials, setPartials] = useState({});
  const [settling, setSettling] = useState(false);
  const [msg, setMsg] = useState("");

  // Calculate who paid how much and what their fair share is
  const paid = Object.fromEntries(MEMBERS.map(m => [m, 0]));
  const share = Object.fromEntries(MEMBERS.map(m => [m, 0]));

  bills.forEach(b => {
    paid[b.paid_by] = (paid[b.paid_by]||0) + Number(b.total);
    const hasSplits = b.splits && Object.keys(b.splits).filter(k => parseFloat(b.splits[k])>0).length > 0;
    if (hasSplits) {
      Object.entries(b.splits).forEach(([m, v]) => { share[m] = (share[m]||0) + parseFloat(v); });
    } else {
      const perPerson = Number(b.total) / MEMBERS.length;
      MEMBERS.forEach(m => { share[m] = (share[m]||0) + perPerson; });
    }
  });

  const balance = Object.fromEntries(MEMBERS.map(m => [m, paid[m] - share[m]]));

  // Calculate who owes whom (min-cost flow simplified)
  const transactions = [];
  const pos = MEMBERS.filter(m => balance[m] > 0.01).map(m => ({ m, v: balance[m] })).sort((a,b) => b.v-a.v);
  const neg = MEMBERS.filter(m => balance[m] < -0.01).map(m => ({ m, v: -balance[m] })).sort((a,b) => b.v-a.v);
  let pi = 0, ni = 0;
  const posC = pos.map(x => ({...x})), negC = neg.map(x => ({...x}));
  while (pi < posC.length && ni < negC.length) {
    const amt = Math.min(posC[pi].v, negC[ni].v);
    if (amt > 0.01) transactions.push({ from: negC[ni].m, to: posC[pi].m, amt });
    posC[pi].v -= amt; negC[ni].v -= amt;
    if (posC[pi].v < 0.01) pi++;
    if (negC[ni].v < 0.01) ni++;
  }

  const settle = async () => {
    if (!isAdmin) return;
    setSettling(true);
    await addSettlement({
      label: `Settlement ${new Date().toLocaleDateString("en-GB")}`,
      paid, shares: share, balances: balance, total: bills.reduce((s, b) => s + Number(b.total), 0),
      period_start: bills.length > 0 ? bills[0].date : today(),
      period_end: today(),
    });
    setMsg("✅ Settlement complete! Naya hisab suruu!");
    setTimeout(() => setMsg(""), 3000);
    setSettling(false);
  };

  return (
    <div>
      {bills.length === 0 && <div style={{ textAlign:"center", color:"#94a3b8", padding:40, fontSize:14 }}>Sabai settle bhaisakyo 🎉</div>}
      {bills.length > 0 && <>
        {/* Bill breakdown by category */}
        <div className="card fu" style={{ padding:18, marginBottom:12 }}>
          <div style={{ fontSize:11, color:"#64748b", letterSpacing:3, marginBottom:12, fontWeight:700 }}>BILL BREAKDOWN BY CATEGORY</div>
          {["Groceries","Electricity","Special"].map(cat => {
            const catBills = bills.filter(b => b.cat === cat);
            if (catBills.length === 0) return null;
            const color = CC[cat]; const icon = CI[cat];
            return <div key={cat} style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, color, letterSpacing:2, fontWeight:700, marginBottom:7 }}>{icon} {cat.toUpperCase()} ({catBills.length} bills)</div>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                {catBills.map(b => {
                  const bNum = bills.findIndex(x => x.id === b.id) + 1;
                  const mc = MC[b.paid_by]||MC.Admin;
                  return <div key={b.id} style={{ padding:"5px 10px", borderRadius:10, background:"#f8fafc", border:`1.5px solid ${color}44`, fontSize:11 }}>
                    <span style={{ fontWeight:900, color:"#1e293b" }}>#{bNum}</span>
                    <span style={{ color:mc.text, fontWeight:700, marginLeft:5 }}>{b.paid_by}</span>
                    <span style={{ color, fontWeight:800, marginLeft:5 }}>{fmt$(b.total)}</span>
                  </div>;
                })}
              </div>
              <div style={{ fontSize:12, fontWeight:800, color, marginTop:6 }}>
                Subtotal: {fmt$(catBills.reduce((s,b) => s+Number(b.total),0))}
              </div>
            </div>;
          })}
        </div>
        <div className="card fu1" style={{ padding:18, marginBottom:12 }}>
          <div style={{ fontSize:11, color:"#64748b", letterSpacing:3, marginBottom:14, fontWeight:700 }}>NET BALANCE</div>
          {MEMBERS.map(m => {
            const b = balance[m]; const mc = MC[m];
            return <div key={m} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #f1f5f9" }}>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ fontSize:13, fontWeight:800, color:mc.text }}>{m}</span>
                <span style={{ fontSize:11, color:"#94a3b8" }}>Paid: {fmt$(paid[m])}</span>
                <span style={{ fontSize:11, color:"#94a3b8" }}>Share: {fmt$(share[m])}</span>
              </div>
              <span style={{ fontSize:14, fontWeight:900, color:b>=0?"#16a34a":"#ef4444" }}>
                {b>=0?"+":""}{fmt$(Math.abs(b))} {b>0.01?"🟢":b<-0.01?"🔴":"✓"}
              </span>
            </div>;
          })}
        </div>
        {transactions.length > 0 && (
          <div className="card fu1" style={{ padding:18, marginBottom:12 }}>
            <div style={{ fontSize:11, color:"#64748b", letterSpacing:3, marginBottom:14, fontWeight:700 }}>KASLE KAILAI DINUPARCA</div>
            {transactions.map((tx, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderRadius:12,
                background:"#fafafa", border:"1.5px solid #e2e8f0", marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ padding:"4px 10px", borderRadius:20, background:MC[tx.from].light, color:MC[tx.from].text, fontSize:12, fontWeight:700 }}>{tx.from}</span>
                  <span style={{ color:"#94a3b8" }}>→</span>
                  <span style={{ padding:"4px 10px", borderRadius:20, background:MC[tx.to].light, color:MC[tx.to].text, fontSize:12, fontWeight:700 }}>{tx.to}</span>
                </div>
                <span style={{ fontSize:16, fontWeight:900, color:"#e11d48" }}>{fmt$(tx.amt)}</span>
              </div>
            ))}
          </div>
        )}
        {msg && <div style={{ padding:"12px 16px", borderRadius:12, background:"#dcfce7", border:"1.5px solid #86efac", color:"#16a34a", fontSize:13, fontWeight:700, marginBottom:12, textAlign:"center" }}>{msg}</div>}
        </div>
        {isAdmin && (
          <button className="btn fu2" onClick={settle} disabled={settling}
            style={{ width:"100%", padding:"14px", borderRadius:14, background:"linear-gradient(135deg,#1e293b,#374151)",
              color:"white", fontSize:15, fontWeight:800, boxShadow:"0 6px 20px rgba(30,41,59,0.3)", opacity:settling?.7:1 }}>
            {settling ? "Settling..." : "🤝 SETTLE GARNU — Naya Cycle Suru"}
          </button>
        )}
        {!isAdmin && <div style={{ fontSize:12, color:"#94a3b8", textAlign:"center", marginTop:8 }}>🔒 Admin le matra settle garna sakcha</div>}
      </>}
    </div>
  );
}

/* ─── HISTORY SECTION ─────────────────────────────────────────────── */
function HistorySection({ settlements }) {
  return (
    <div>
      {settlements.length === 0 && <div style={{ textAlign:"center", color:"#94a3b8", padding:40, fontSize:14 }}>Kei settlement history xaina abhi</div>}
      {[...settlements].reverse().map((s, i) => (
        <div key={s.id} className="card fu" style={{ padding:18, marginBottom:12, animation:`fadeUp .36s ${i*.07}s both` }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
            <div style={{ fontSize:14, fontWeight:900, color:"#1e293b" }}>{s.label}</div>
            <div style={{ fontSize:16, fontWeight:900, color:"#b45309" }}>{fmt$(s.total)}</div>
          </div>
          <div style={{ fontSize:11, color:"#94a3b8", marginBottom:10 }}>
            {s.period_start && `${fmtD(s.period_start)} → `}{s.period_end && fmtD(s.period_end)}
            {" · "}{s.settled_by} le settle garyo
          </div>
          {s.balances && (
            <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
              {Object.entries(s.balances).map(([m, v]) => (
                <span key={m} className="tag" style={{ background:MC[m]?.light||"#f1f5f9", color:MC[m]?.text||"#374151" }}>
                  {m}: {Number(v)>=0?"+":""}{fmt$(v)}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── PERSONAL SECTION ────────────────────────────────────────────── */
function PersonalSection({ bills, tasks, user, inRange }) {
  const [selMember, setSelMember] = useState(user !== "Admin" ? user : MEMBERS[0]);
  const mc = MC[selMember];

  const myBills = bills.filter(b => b.paid_by === selMember);
  const myTotal = myBills.reduce((s, b) => s + Number(b.total), 0);

  const myTasks = Object.fromEntries([...DTASKS,...WTASKS].map(t => [t.id, 0]));
  Object.entries(tasks).forEach(([date, dt]) => {
    if (!inRange(date)) return;
    Object.entries(dt).forEach(([k, v]) => { if (v === selMember) { const tid = k.split("_")[0]; if (myTasks[tid] !== undefined) myTasks[tid]++; } });
  });
  const totalMyTasks = Object.values(myTasks).reduce((s, v) => s + v, 0);

  return (
    <div>
      <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:14 }}>
        {MEMBERS.map(m => <Chip key={m} m={m} active={selMember===m} onClick={() => setSelMember(m)}/>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
        <div className="card fu" style={{ padding:16, background:mc.light, border:`1.5px solid ${mc.bg}33` }}>
          <div style={{ fontSize:22 }}>💷</div>
          <div style={{ fontSize:22, fontWeight:900, color:mc.bg, margin:"6px 0 3px" }}>{fmt$(myTotal)}</div>
          <div style={{ fontSize:11, color:"#64748b", fontWeight:700 }}>Jamma Tiryo</div>
        </div>
        <div className="card fu1" style={{ padding:16, background:mc.light, border:`1.5px solid ${mc.bg}33` }}>
          <div style={{ fontSize:22 }}>⚡</div>
          <div style={{ fontSize:22, fontWeight:900, color:mc.bg, margin:"6px 0 3px" }}>{totalMyTasks}</div>
          <div style={{ fontSize:11, color:"#64748b", fontWeight:700 }}>Kaam Garyo</div>
        </div>
      </div>
      <div className="card fu2" style={{ padding:18, marginBottom:12 }}>
        <div style={{ fontSize:11, color:"#64748b", letterSpacing:3, marginBottom:12, fontWeight:700 }}>TASK BREAKDOWN</div>
        {[...DTASKS,...WTASKS].filter(t => myTasks[t.id]>0).map(t => (
          <div key={t.id} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid #f1f5f9" }}>
            <span style={{ fontSize:13, color:"#374151", fontWeight:700 }}>{t.icon} {t.label}</span>
            <span style={{ fontSize:13, color:mc.bg, fontWeight:800 }}>{myTasks[t.id]}x</span>
          </div>
        ))}
        {totalMyTasks===0 && <div style={{ color:"#94a3b8", fontSize:13, textAlign:"center", padding:"10px 0" }}>Kei data xaina</div>}
      </div>
      {myBills.length > 0 && (
        <div className="card fu3" style={{ padding:18 }}>
          <div style={{ fontSize:11, color:"#64748b", letterSpacing:3, marginBottom:12, fontWeight:700 }}>BILLS ({myBills.length})</div>
          {[...myBills].reverse().slice(0,8).map(b => (
            <div key={b.id} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid #f1f5f9" }}>
              <span style={{ fontSize:12, color:"#64748b" }}>{CI[b.cat]} {fmtD(b.date)}</span>
              <span style={{ fontSize:14, fontWeight:800, color:mc.bg }}>{fmt$(b.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  ADMIN TAB                                                          */
/* ═══════════════════════════════════════════════════════════════════ */
function AdminTab({ perms, setPerms, pins, setPins, bills, tasks, toggleTask, deleteBill, groceryItems, deleteGroceryItem, user }) {
  const [sub, setSub] = useState("edit");
  const subTabs = [
    { id:"edit",    icon:"✏️", label:"Edit" },
    { id:"perms",   icon:"🔐", label:"Permissions" },
    { id:"pin",     icon:"🔑", label:"PIN" },
    { id:"analytics", icon:"📈", label:"Analytics" },
  ];
  return (
    <div>
      <SubTabs tabs={subTabs} active={sub} onChange={setSub} color="#374151" colorLight="#f3f4f6"/>
      {sub === "edit"      && <EditSection tasks={tasks} bills={bills} toggleTask={toggleTask} deleteBill={deleteBill}/>}
      {sub === "perms"     && <PermissionsSection perms={perms} setPerms={setPerms}/>}
      {sub === "pin"       && <PINSection pins={pins} setPins={setPins} user={user}/>}
      {sub === "analytics" && <AnalyticsSection bills={bills} tasks={tasks}/>}
    </div>
  );
}

/* ─── EDIT SECTION ────────────────────────────────────────────────── */
function EditSection({ tasks, bills, toggleTask, deleteBill }) {
  const [editDate, setDate] = useState(today());
  const [mode, setMode] = useState("tasks");
  const td = tasks[editDate] || {};
  const dayBills = bills.filter(b => b.date === editDate);

  return (
    <div>
      <div className="card fu" style={{ padding:18, border:"1.5px solid #ddd6fe", background:"#faf5ff", marginBottom:14 }}>
        <div style={{ fontSize:11, color:"#7c3aed", letterSpacing:3, marginBottom:14, fontWeight:700 }}>✏️ PAST DATE EDITOR</div>
        <div style={{ display:"flex", gap:9, alignItems:"center", marginBottom:14, flexWrap:"wrap" }}>
          <input type="date" value={editDate} max={today()} onChange={e => setDate(e.target.value)}
            style={{ padding:"9px 12px", fontSize:13, flex:1, minWidth:140 }}/>
          <div style={{ display:"flex", gap:6 }}>
            {["tasks","bills"].map(m => (
              <button key={m} className="btn" onClick={() => setMode(m)}
                style={{ padding:"9px 14px", borderRadius:9, background:mode===m?"#7c3aed":"white",
                  color:mode===m?"white":"#7c3aed", border:`1.5px solid ${mode===m?"#7c3aed":"#ddd6fe"}`, fontSize:12, fontWeight:700 }}>
                {m === "tasks" ? "⚡ Kaam" : "💷 Bills"}
              </button>
            ))}
          </div>
        </div>
        {mode === "tasks" && [...DTASKS,...WTASKS].map(task => {
          const done = MEMBERS.find(m => td[`${task.id}_${m}`]);
          return <div key={task.id} style={{ padding:"10px 12px", borderRadius:11, background:"white", border:"1px solid #e9d5ff", marginBottom:8 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#374151", marginBottom:7 }}>
              {task.icon} {task.label} {done && <span style={{ color:MC[done].text, fontSize:12 }}>— {done}</span>}
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {MEMBERS.map(m => {
                const mDone = td[`${task.id}_${m}`]; const mc = MC[m];
                return <button key={m} className="btn" onClick={() => toggleTask(editDate, task.id, m, null)}
                  style={{ padding:"5px 10px", borderRadius:8, background:mDone?mc.bg:mc.light,
                    color:mDone?"white":mc.text, border:`1.5px solid ${mDone?mc.bg:mc.bg+"44"}`, fontSize:11, fontWeight:700 }}>
                  {mDone ? "✓ ":""}{m}
                </button>;
              })}
            </div>
          </div>;
        })}
        {mode === "bills" && <>
          {dayBills.length===0 && <div style={{ color:"#94a3b8", fontSize:13, textAlign:"center", padding:20 }}>Yo din ko kei bill xaina</div>}
          {dayBills.map(b => {
            const mc = MC[b.paid_by] || MC.Admin;
            return <div key={b.id} style={{ padding:"12px 13px", borderRadius:11, background:"white", border:`1.5px solid ${mc.bg}33`, marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                <div style={{ display:"flex", gap:7, alignItems:"center" }}>
                  <span style={{ padding:"2px 8px", borderRadius:20, background:mc.light, color:mc.text, fontSize:11, fontWeight:700 }}>{b.paid_by}</span>
                  <span style={{ fontSize:12, color:"#64748b" }}>{CI[b.cat]} {b.cat}</span>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontWeight:900, color:mc.text }}>{fmt$(b.total)}</span>
                  <button className="btn" onClick={() => deleteBill(b.id)}
                    style={{ padding:"4px 8px", borderRadius:7, background:"#fee2e2", border:"1px solid #fca5a5", color:"#ef4444", fontSize:11, fontWeight:700 }}>🗑️</button>
                </div>
              </div>
              {(b.items||[]).map((it,i) => (
                <div key={i} style={{ fontSize:12, color:"#64748b", display:"flex", justifyContent:"space-between", padding:"2px 0" }}>
                  <span>{it.name}</span><span>{fmt$(it.amount)}</span>
                </div>
              ))}
            </div>;
          })}
        </>}
      </div>
    </div>
  );
}

/* ─── PERMISSIONS SECTION ─────────────────────────────────────────── */
function PermissionsSection({ perms, setPerms }) {
  const PKEYS = [
    { key:"aaja",       label:"🌅 Aaja" },
    { key:"expenses",   label:"💷 Kharcha" },
    { key:"report",     label:"📊 Report" },
    { key:"markOthers", label:"👥 Aru Mark" },
  ];
  const tog = (m, key) => {
    const u = { ...perms, [m]: { ...perms[m], [key]: !perms[m]?.[key] } };
    setPerms(u); LS.s("g9_perms", u);
  };
  return (
    <div>
      {MEMBERS.map(m => {
        const mc = MC[m];
        return <div key={m} className="card fu" style={{ padding:16, marginBottom:11, border:`1.5px solid ${mc.bg}22` }}>
          <div style={{ fontSize:15, fontWeight:900, color:mc.bg, marginBottom:10 }}>{m}</div>
          <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
            {PKEYS.map(({ key, label }) => {
              const on = !!perms[m]?.[key];
              return <button key={key} className="btn" onClick={() => tog(m, key)}
                style={{ padding:"7px 12px", borderRadius:20, background:on?mc.light:"#f1f5f9",
                  color:on?mc.text:"#94a3b8", border:`1.5px solid ${on?mc.bg+"55":"#e2e8f0"}`, fontSize:12, fontWeight:700 }}>
                {on ? "✓ ":""}{label}
              </button>;
            })}
          </div>
        </div>;
      })}
    </div>
  );
}

/* ─── PIN SECTION ─────────────────────────────────────────────────── */
function PINSection({ pins, setPins, user }) {
  const [selMember, setSel] = useState(MEMBERS[0]);
  const [oldPin, setOld] = useState("");
  const [newPin, setNew] = useState("");
  const [confirm, setConf] = useState("");
  const [msg, setMsg] = useState({ text:"", ok:false });

  const isAdmin = user === "Admin";

  const change = () => {
    if (newPin.length !== 4) return setMsg({ text:"PIN 4 digit hunu paro", ok:false });
    if (newPin !== confirm) return setMsg({ text:"PIN match garena!", ok:false });
    if (!isAdmin) {
      if (selMember !== user) return setMsg({ text:"Aafno PIN matra badla garna sakcha", ok:false });
      if ((pins[selMember] || DP[selMember]) !== oldPin) return setMsg({ text:"Purano PIN galat!", ok:false });
    }
    // Admin can change any PIN without needing old PIN
    const u = { ...pins, [selMember]: newPin };
    setPins(u); LS.s("g9_pins", u);
    setMsg({ text:`✅ ${selMember} ko PIN change bhayo!`, ok:true });
    setOld(""); setNew(""); setConf("");
    setTimeout(() => setMsg({ text:"", ok:false }), 3000);
  };

  const changeableMembers = isAdmin ? MEMBERS : [user].filter(u => u !== "Admin");

  return (
    <div>
      <div className="card fu" style={{ padding:18, marginBottom:14 }}>
        <div style={{ fontSize:11, color:"#64748b", letterSpacing:3, marginBottom:14, fontWeight:700 }}>🔑 PIN CHANGE GARNA</div>
        {isAdmin && (
          <>
            <div style={{ fontSize:10, color:"#64748b", letterSpacing:2, marginBottom:8, fontWeight:700 }}>KASLE KO PIN?</div>
            <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:14 }}>
              {MEMBERS.map(m => <Chip key={m} m={m} active={selMember===m} onClick={() => { setSel(m); setOld(""); setNew(""); setConf(""); }} small/>)}
            </div>
          </>
        )}
        {!isAdmin && <div style={{ padding:"10px 12px", borderRadius:11, background:"#f8fafc", marginBottom:14, fontSize:13, color:"#64748b" }}>
          Timi aafno PIN matra badla garna sakcha. Admin PIN bhulyo bhane, admin lae sodhna sakcha.
        </div>}
        <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
          {!isAdmin && (
            <input value={oldPin} onChange={e => setOld(e.target.value)} type="password" maxLength={4} placeholder="Purano PIN (4 digit)"
              style={{ padding:"11px 13px", fontSize:14, letterSpacing:6 }}/>
          )}
          <input value={newPin} onChange={e => setNew(e.target.value)} type="password" maxLength={4} placeholder="Naya PIN (4 digit)"
            style={{ padding:"11px 13px", fontSize:14, letterSpacing:6 }}/>
          <input value={confirm} onChange={e => setConf(e.target.value)} type="password" maxLength={4} placeholder="Naya PIN confirm"
            style={{ padding:"11px 13px", fontSize:14, letterSpacing:6 }}/>
        </div>
        {msg.text && <div style={{ padding:"10px 13px", borderRadius:10, background:msg.ok?"#dcfce7":"#fee2e2", color:msg.ok?"#16a34a":"#ef4444", fontSize:13, fontWeight:700, marginTop:12 }}>{msg.text}</div>}
        <button className="btn" onClick={change}
          style={{ width:"100%", padding:"13px", borderRadius:12, background:"#1e293b", color:"white", fontSize:14, fontWeight:800, marginTop:14, boxShadow:"0 4px 14px rgba(30,41,59,0.25)" }}>
          PIN CHANGE GARA 🔑
        </button>
        {isAdmin && <div style={{ fontSize:11, color:"#94a3b8", textAlign:"center", marginTop:10 }}>
          ⚠️ Admin ko aafno PIN bhulyo bhane app bata change garna sakdaina
        </div>}
      </div>
    </div>
  );
}

/* ─── ANALYTICS SECTION ───────────────────────────────────────────── */
function AnalyticsSection({ bills, tasks }) {
  const itemFreq = {};
  bills.forEach(b => (b.items||[]).forEach(it => { if(it.name) itemFreq[it.name] = (itemFreq[it.name]||0)+1; }));
  const topItems = Object.entries(itemFreq).sort((a,b) => b[1]-a[1]).slice(0,8);
  const totalByM = Object.fromEntries(MEMBERS.map(m => [m, bills.filter(b => b.paid_by===m).reduce((s,b) => s+Number(b.total), 0)]));
  const taskByM  = Object.fromEntries(MEMBERS.map(m => [m, 0]));
  Object.values(tasks).forEach(dt => Object.values(dt).forEach(v => { if(v && taskByM[v]!==undefined) taskByM[v]++; }));

  return (
    <div>
      <div className="card fu" style={{ padding:18, marginBottom:12 }}>
        <div style={{ fontSize:11, color:"#64748b", letterSpacing:3, marginBottom:14, fontWeight:700 }}>JAMMA KHARCHA (SABAI TIME)</div>
        <BarChart data={MEMBERS.map(m => ({ key:m, label:m, value:totalByM[m] }))} colorFn={k => MC[k].bg} unit="£"/>
        <div style={{ marginTop:10, padding:"8px 12px", background:"#f8fafc", borderRadius:10, textAlign:"center" }}>
          <span style={{ fontSize:13, fontWeight:700, color:"#374151" }}>Grand Total: </span>
          <span style={{ fontSize:16, fontWeight:900, color:"#b45309" }}>{fmt$(Object.values(totalByM).reduce((s,v) => s+v, 0))}</span>
        </div>
      </div>
      <div className="card fu1" style={{ padding:18, marginBottom:12 }}>
        <div style={{ fontSize:11, color:"#64748b", letterSpacing:3, marginBottom:14, fontWeight:700 }}>JAMMA KAAM (SABAI TIME)</div>
        <BarChart data={MEMBERS.map(m => ({ key:m, label:m, value:taskByM[m] }))} colorFn={k => MC[k].bg}/>
      </div>
      <div className="card fu2" style={{ padding:18 }}>
        <div style={{ fontSize:11, color:"#64748b", letterSpacing:3, marginBottom:14, fontWeight:700 }}>TOP ITEMS KINIYO</div>
        {topItems.length === 0 ? <div style={{ color:"#cbd5e1", fontSize:13 }}>Data xaina abhi</div>
          : <BarChart data={topItems.map(([n,c]) => ({ key:n, label:n, value:c }))} colorFn={() => "#7c3aed"}/>}
      </div>
    </div>
  );
}
