import { useState, useEffect, useCallback } from "react";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SUPABASE_URL = "https://sddmujczlutzvfkwngsn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkZG11amN6bHV0enZma3duZ3NuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0OTQ5NDEsImV4cCI6MjA4ODA3MDk0MX0.dtAxUkKsqe-_rLD187qNiBpG0pxXlGOeeaC1e6EfqHw";

const sb = {
  async get(table, filters = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
    Object.entries(filters).forEach(([k, v]) => { url += `&${k}=eq.${v}`; });
    const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    return res.json();
  },
  async upsert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async delete(table, id) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
  },
  async patch(table, filters, data) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    Object.entries(filters).forEach(([k, v]) => { url += `${k}=eq.${v}&`; });
    await fetch(url, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  },
  subscribe(table, cb) {
    const url = `${SUPABASE_URL}/realtime/v1/websocket?apikey=${SUPABASE_KEY}&vsn=1.0.0`;
    const ws = new WebSocket(url);
    ws.onopen = () => {
      ws.send(JSON.stringify({ topic: `realtime:public:${table}`, event: "phx_join", payload: {}, ref: "1" }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.event === "INSERT" || msg.event === "UPDATE" || msg.event === "DELETE") cb(msg);
    };
    return ws;
  }
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const MEMBERS = ["Nitesh", "Subodh", "Bishal", "Bikram"];
const MC = {
  Nitesh: { bg: "#e11d48", light: "#ffe4e6", text: "#e11d48", glow: "#e11d4830" },
  Subodh: { bg: "#7c3aed", light: "#ede9fe", text: "#7c3aed", glow: "#7c3aed30" },
  Bishal: { bg: "#0369a1", light: "#e0f2fe", text: "#0369a1", glow: "#0369a130" },
  Bikram: { bg: "#b45309", light: "#fef3c7", text: "#b45309", glow: "#b4530930" },
  Admin:  { bg: "#374151", light: "#f3f4f6", text: "#374151", glow: "#37415130" },
};
const DAILY_TASKS = [
  { id: "khana",     label: "Khana Pakaaune", icon: "🍳" },
  { id: "bhada",     label: "Bhada Maajne",   icon: "🍽️" },
  { id: "kitchen",   label: "Kitchen Saffa",  icon: "🧹" },
  { id: "groceries", label: "Groceries Jane", icon: "🛒" },
];
const WEEKLY_TASKS = [
  { id: "room1_mil", label: "Room 1 Milaaune", icon: "🛏️" },
  { id: "room2_mil", label: "Room 2 Milaaune", icon: "🛏️" },
  { id: "room1_swp", label: "Room 1 Sweep",    icon: "🧺" },
  { id: "room2_swp", label: "Room 2 Sweep",    icon: "🧺" },
];
const CATEGORIES = ["Groceries", "Special", "Electricity"];
const CAT_ICONS  = { Groceries: "🛒", Special: "✨", Electricity: "⚡" };
const CAT_COLORS = { Groceries: "#16a34a", Special: "#db2777", Electricity: "#d97706" };
const DEFAULT_PINS  = { Nitesh: "1234", Subodh: "1234", Bishal: "1234", Bikram: "1234", Admin: "0000" };
const DEFAULT_PERMS = Object.fromEntries(MEMBERS.map(m => [m, { aaja: true, expenses: true, report: true, markOthers: false }]));

const LS = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const todayStr  = () => new Date().toISOString().split("T")[0];
const weekStart = (d) => { const dt = new Date(d); const day = dt.getDay(); const diff = dt.getDate() - day + (day === 0 ? -6 : 1); return new Date(dt.setDate(diff)).toISOString().split("T")[0]; };
const fmtDate   = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const fmtShort  = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

// ─── MOUNTAIN BANNER ──────────────────────────────────────────────────────────
const MountainBanner = () => (
  <svg viewBox="0 0 500 120" preserveAspectRatio="xMidYMid slice"
    style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "100%", opacity: 1 }}>
    <defs>
      <linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#bfdbfe"/><stop offset="100%" stopColor="#e0f2fe"/>
      </linearGradient>
    </defs>
    <rect width="500" height="120" fill="url(#sky2)"/>
    <polygon points="0,90 60,35 120,80 180,25 240,70 300,20 360,65 420,18 500,60 500,120 0,120" fill="#cbd5e1" opacity="0.5"/>
    <polygon points="0,100 80,50 160,85 240,40 320,80 400,35 500,75 500,120 0,120" fill="#e2e8f0" opacity="0.7"/>
    <polygon points="0,110 100,70 200,100 300,65 400,95 500,72 500,120 0,120" fill="#f1f5f9"/>
    <polygon points="180,25 190,38 170,38" fill="white" opacity="0.85"/>
    <polygon points="300,20 312,35 288,35" fill="white" opacity="0.85"/>
    <polygon points="420,18 432,33 408,33" fill="white" opacity="0.85"/>
    {[30,70,110,150,200,250,310,360,430,470].map((x, i) => (
      <g key={i} transform={`translate(${x},${100 + (i % 3) * 4})`} opacity="0.5">
        <polygon points="0,-12 6,0 -6,0" fill="#4ade80"/>
        <polygon points="0,-8 5,4 -5,4" fill="#22c55e"/>
        <rect x="-1.5" y="4" width="3" height="4" fill="#92400e"/>
      </g>
    ))}
    <circle cx="440" cy="28" r="14" fill="#fde68a" opacity="0.8"/>
    <circle cx="440" cy="28" r="10" fill="#fbbf24" opacity="0.9"/>
  </svg>
);

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Playfair+Display:wght@700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#f0f9ff;overflow-x:hidden;}
::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-thumb{background:#94a3b8;border-radius:4px;}
@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes bounce{0%,100%{transform:scale(1)}35%{transform:scale(1.28)}70%{transform:scale(.94)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
@keyframes sparkFly{0%{opacity:1;transform:translate(-50%,-50%) rotate(var(--a)) translateY(0)}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--a)) translateY(-38px)}}
@keyframes cloudDrift{from{transform:translateX(-20px)}to{transform:translateX(20px)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.fadeUp{animation:fadeUp .38s cubic-bezier(.34,1.3,.64,1) both;}
.fadeUp1{animation:fadeUp .38s .07s cubic-bezier(.34,1.3,.64,1) both;}
.fadeUp2{animation:fadeUp .38s .14s cubic-bezier(.34,1.3,.64,1) both;}
.fadeUp3{animation:fadeUp .38s .21s cubic-bezier(.34,1.3,.64,1) both;}
.shake{animation:shake .35s ease;}
.btn{transition:transform .15s,box-shadow .18s,background .15s;cursor:pointer;border:none;outline:none;font-family:'Nunito',sans-serif;}
.btn:hover{transform:translateY(-2px);}
.btn:active{transform:scale(.94);}
.card{background:white;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 2px 12px rgba(0,0,0,0.06);}
.live-dot{width:8px;height:8px;background:#22c55e;border-radius:50%;animation:pulse 1.5s infinite;display:inline-block;margin-right:5px;}
input,textarea,select{font-family:'Nunito',sans-serif;background:white;border:1.5px solid #e2e8f0;border-radius:11px;color:#1e293b;outline:none;transition:border .2s,box-shadow .2s;}
input:focus,textarea:focus{border-color:#7c3aed;box-shadow:0 0 0 3px #7c3aed18;}
input::placeholder,textarea::placeholder{color:#94a3b8;}
`;

// ─── SPARKS ───────────────────────────────────────────────────────────────────
function Sparks({ x, y, color, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 850); return () => clearTimeout(t); }, []);
  return <div style={{ position: "fixed", left: x, top: y, pointerEvents: "none", zIndex: 9999 }}>
    {[...Array(10)].map((_, i) => (
      <div key={i} style={{ position: "absolute", width: 7, height: 7, borderRadius: "50%", background: color,
        animation: "sparkFly .85s ease-out forwards", "--a": `${i * 36}deg` }}/>
    ))}
  </div>;
}

// ─── LOADING ──────────────────────────────────────────────────────────────────
function Loading() {
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 16 }}>
    <div style={{ width: 40, height: 40, border: "4px solid #e2e8f0", borderTop: "4px solid #7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}/>
    <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 700 }}>Database bata data load hudai cha...</div>
  </div>;
}

// ─── BAR CHART ────────────────────────────────────────────────────────────────
function BarChart({ data, colorFn, unit = "" }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    {data.map((d, i) => {
      const pct = Math.round((d.value / max) * 100);
      const color = colorFn(d.key);
      return <div key={d.key} style={{ animation: `fadeUp .4s ${i * .07}s both` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontSize: 13, color: "#374151", fontWeight: 700 }}>{d.label}</span>
          <span style={{ fontSize: 13, color, fontWeight: 800 }}>{unit}{d.value % 1 === 0 ? d.value : d.value.toFixed(2)}</span>
        </div>
        <div style={{ height: 9, background: "#f1f5f9", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 8,
            transition: "width 1s cubic-bezier(.34,1.1,.64,1)", boxShadow: `0 0 8px ${color}66` }}/>
        </div>
      </div>;
    })}
  </div>;
}

// ─── RING ─────────────────────────────────────────────────────────────────────
function Ring({ value, max, color, label, sub }) {
  const r = 34, circ = 2 * Math.PI * r, offset = circ - (value / Math.max(max, 1)) * circ;
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
    <div style={{ position: "relative", width: 82, height: 82 }}>
      <svg width={82} height={82} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={41} cy={41} r={r} fill="none" stroke="#f1f5f9" strokeWidth={9}/>
        <circle cx={41} cy={41} r={r} fill="none" stroke={color} strokeWidth={9}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.34,1,.64,1)", filter: `drop-shadow(0 0 6px ${color}88)` }}/>
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, fontWeight: 900, color }}>{value}</div>
    </div>
    <div style={{ fontSize: 12, color: "#374151", fontWeight: 700 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: "#94a3b8" }}>{sub}</div>}
  </div>;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin, pins }) {
  const [sel, setSel] = useState(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);

  const tryLogin = () => {
    if ((pins[sel] || DEFAULT_PINS[sel]) === pin) { onLogin(sel); }
    else { setShake(true); setErr("Galat PIN! 🚫"); setPin(""); setTimeout(() => { setShake(false); setErr(""); }, 600); }
  };

  return <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#e0f2fe 0%,#bfdbfe 40%,#dbeafe 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, position: "relative", overflow: "hidden" }}>
    <style>{CSS}</style>
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 200, zIndex: 0 }}><MountainBanner/></div>
    {[{ x: "10%", y: "12%", s: 1 }, { x: "55%", y: "6%", s: .7 }, { x: "80%", y: "18%", s: .85 }].map((c, i) => (
      <div key={i} style={{ position: "fixed", left: c.x, top: c.y, transform: `scale(${c.s})`, animation: `cloudDrift ${6 + i * 2}s ease-in-out infinite alternate`, pointerEvents: "none", zIndex: 0, opacity: .7 }}>
        <svg width="90" height="40" viewBox="0 0 90 40">
          <ellipse cx="45" cy="28" rx="40" ry="14" fill="white" opacity="0.8"/>
          <ellipse cx="30" cy="22" rx="22" ry="16" fill="white" opacity="0.8"/>
          <ellipse cx="58" cy="20" rx="18" ry="14" fill="white" opacity="0.8"/>
        </svg>
      </div>
    ))}

    <div className="fadeUp" style={{ width: "100%", maxWidth: 360, position: "relative", zIndex: 1 }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 46 }}>🏔️</div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 38, fontWeight: 700, color: "#1e3a5f", letterSpacing: 2 }}>GHAR.SYS</div>
        <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 4, marginTop: 2 }}>HAMRO GHAR — v8.0</div>
        <div style={{ fontSize: 11, color: "#22c55e", marginTop: 6, fontWeight: 700 }}><span className="live-dot"/>LIVE — Real-time sync ON</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[...MEMBERS, "Admin"].map(m => {
          const c = MC[m] || MC.Admin; const active = sel === m;
          return <button key={m} className="btn" onClick={() => { setSel(m); setPin(""); setErr(""); }}
            style={{ padding: "13px 8px", borderRadius: 14, background: active ? c.bg : "white",
              color: active ? "white" : c.text, border: `2px solid ${active ? c.bg : c.bg + "55"}`,
              fontSize: 14, fontWeight: 800, boxShadow: active ? `0 6px 20px ${c.glow}` : "0 2px 8px rgba(0,0,0,0.06)" }}>
            {m === "Admin" ? "⬡ ADMIN" : m.toUpperCase()}
          </button>;
        })}
      </div>

      {sel && <div className={`card ${shake ? "shake" : ""}`} style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 18 }}>
          {[0, 1, 2, 3].map(i => { const c = MC[sel] || MC.Admin; const on = i < pin.length;
            return <div key={i} style={{ width: 15, height: 15, borderRadius: "50%", background: on ? c.bg : "#e2e8f0",
              boxShadow: on ? `0 0 10px ${c.glow}` : "", transform: on ? "scale(1.2)" : "scale(1)", transition: "all .2s cubic-bezier(.34,1.5,.64,1)" }}/>;
          })}
        </div>
        {err && <div style={{ textAlign: "center", color: "#ef4444", fontSize: 13, marginBottom: 10, fontWeight: 700 }}>{err}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k, i) => (
            <button key={i} className="btn" onClick={() => { if (k === "⌫") setPin(p => p.slice(0, -1)); else if (k !== "") setPin(p => p.length < 4 ? p + k : p); }}
              style={{ padding: "15px 0", borderRadius: 12,
                background: k === "⌫" ? "#fee2e2" : k === "" ? "transparent" : "#f8fafc",
                border: k === "" ? "none" : `1.5px solid ${k === "⌫" ? "#fca5a5" : "#e2e8f0"}`,
                color: k === "⌫" ? "#ef4444" : "#1e293b", fontSize: 19, fontWeight: 800, cursor: k === "" ? "default" : "pointer" }}>
              {k}
            </button>
          ))}
        </div>
        <button className="btn" onClick={tryLogin} disabled={pin.length !== 4}
          style={{ width: "100%", padding: "14px 0", borderRadius: 12,
            background: pin.length === 4 ? (MC[sel] || MC.Admin).bg : "#f1f5f9",
            color: pin.length === 4 ? "white" : "#94a3b8", fontSize: 15, fontWeight: 800,
            boxShadow: pin.length === 4 ? `0 6px 20px ${(MC[sel] || MC.Admin).glow}` : "" }}>
          BHITRA JAAUM →
        </button>
      </div>}
    </div>
  </div>;
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [pins]               = useState(() => LS.get("g8_pins", DEFAULT_PINS));
  const [perms, setPerms]    = useState(() => LS.get("g8_perms", DEFAULT_PERMS));
  const [user, setUser]      = useState(() => LS.get("g8_user", null));
  const [tab, setTab]        = useState("aaja");
  // Supabase state
  const [tasks, setTasks]    = useState({});   // { date: { taskId_member: memberName } }
  const [bills, setBills]    = useState([]);
  const [notes, setNotes]    = useState("");
  const [loading, setLoading]= useState(true);
  const [online, setOnline]  = useState(true);
  const [sparks, setSparks]  = useState([]);

  useEffect(() => { LS.set("g8_perms", perms); }, [perms]);
  useEffect(() => { LS.set("g8_user", user); }, [user]);

  // ── Load all data from Supabase ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rawTasks, rawBills, rawNotes] = await Promise.all([
        sb.get("tasks"),
        sb.get("bills"),
        sb.get("notes")
      ]);
      // Convert flat tasks rows → nested { date: { taskId_member: memberName } }
      const tasksMap = {};
      (rawTasks || []).forEach(row => {
        if (!tasksMap[row.date]) tasksMap[row.date] = {};
        tasksMap[row.date][`${row.task_id}_${row.member}`] = row.done_by || null;
      });
      setTasks(tasksMap);
      setBills((rawBills || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
      setNotes(rawNotes?.[0]?.content || "");
      setOnline(true);
    } catch (e) {
      setOnline(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Realtime subscriptions ──
  useEffect(() => {
    const wsTasks = sb.subscribe("tasks", () => loadAll());
    const wsBills = sb.subscribe("bills", () => loadAll());
    const wsNotes = sb.subscribe("notes", () => loadAll());
    return () => { wsTasks.close(); wsBills.close(); wsNotes.close(); };
  }, [loadAll]);

  const isAdmin = user === "Admin";
  const up = perms[user] || {};

  const spark = (e, color) => {
    const r = e.currentTarget.getBoundingClientRect();
    const id = Date.now() + Math.random();
    setSparks(p => [...p, { id, x: r.left + r.width / 2, y: r.top + r.height / 2, color }]);
    setTimeout(() => setSparks(p => p.filter(s => s.id !== id)), 900);
  };

  // ── Task toggle → upsert to Supabase ──
  const toggleTask = async (date, taskId, member, e) => {
    const key = `${taskId}_${member}`;
    const curr = tasks[date]?.[key];
    if (!curr && e) spark(e, MC[member].bg);
    // Optimistic update
    setTasks(p => ({ ...p, [date]: { ...p[date], [key]: curr ? null : member } }));
    // Upsert to DB
    await sb.upsert("tasks", { date, task_id: taskId, member, done_by: curr ? null : member });
  };

  // ── Save notes ──
  const saveNotes = async (val) => {
    setNotes(val);
    await sb.patch("notes", { id: 1 }, { content: val });
  };

  // ── Add bill ──
  const addBill = async (bill) => {
    const { id: _id, num: _num, ...rest } = bill;
    const newBill = { ...rest, created_at: new Date().toISOString() };
    const res = await sb.upsert("bills", newBill);
    if (res && res[0]) setBills(p => [...p, res[0]]);
    else loadAll();
  };

  // ── Delete bill ──
  const deleteBill = async (id) => {
    setBills(p => p.filter(b => b.id !== id));
    await sb.delete("bills", id);
  };

  const login = (u) => { setUser(u); setTab("aaja"); };
  const logout = () => { setUser(null); LS.set("g8_user", null); };

  if (!user) return <Login onLogin={login} pins={pins} />;

  const uc = MC[user] || MC.Admin;
  const tabs = [
    { id: "aaja",     label: "🌅 Aaja",    show: isAdmin || up.aaja },
    { id: "expenses", label: "💷 Kharcha", show: isAdmin || up.expenses },
    { id: "report",   label: "📊 Report",  show: isAdmin || up.report },
    { id: "admin",    label: "⬡ Admin",    show: isAdmin },
  ].filter(t => t.show);

  return <div style={{ minHeight: "100vh", fontFamily: "'Nunito',sans-serif", background: "linear-gradient(180deg,#f0f9ff 0%,#e8f4fd 100%)" }}>
    <style>{CSS}</style>
    {sparks.map(s => <Sparks key={s.id} x={s.x} y={s.y} color={s.color} onDone={() => setSparks(p => p.filter(x => x.id !== s.id))}/>)}

    {/* Header with mountain */}
    <div style={{ position: "relative", height: 130, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#bfdbfe 0%,#dbeafe 60%,#e0f2fe 100%)" }}/>
      <MountainBanner/>
      <div style={{ position: "absolute", top: 16, left: 0, right: 0, padding: "0 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", zIndex: 2 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 700, color: "#1e3a5f", textShadow: "0 1px 8px rgba(255,255,255,0.8)" }}>🏔️ GHAR.SYS</div>
          <div style={{ fontSize: 10, color: "#3b82f6", letterSpacing: 3, fontWeight: 700 }}>SWAGAT {user.toUpperCase()} 👋</div>
          <div style={{ fontSize: 10, color: online ? "#22c55e" : "#ef4444", fontWeight: 700, marginTop: 2 }}>
            <span style={{ width: 6, height: 6, background: online ? "#22c55e" : "#ef4444", borderRadius: "50%", display: "inline-block", marginRight: 4, animation: online ? "pulse 1.5s infinite" : "" }}/>
            {online ? "LIVE — Real-time ON" : "Offline — Reconnecting..."}
          </div>
        </div>
        <button className="btn" onClick={logout}
          style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,0.7)", border: "1.5px solid #fca5a5", color: "#ef4444", fontSize: 12, fontWeight: 700, backdropFilter: "blur(8px)" }}>
          LOGOUT
        </button>
      </div>
    </div>

    <div style={{ maxWidth: 500, margin: "0 auto", padding: "0 16px 90px" }}>
      {/* Tabs */}
      <div className="fadeUp" style={{ display: "flex", gap: 8, padding: "14px 0", overflowX: "auto", scrollbarWidth: "none" }}>
        {tabs.map(t => { const active = tab === t.id;
          return <button key={t.id} className="btn" onClick={() => setTab(t.id)}
            style={{ padding: "9px 15px", borderRadius: 11, whiteSpace: "nowrap",
              background: active ? uc.bg : "white", color: active ? "white" : uc.text,
              border: `1.5px solid ${active ? uc.bg : uc.bg + "44"}`, fontSize: 13, fontWeight: 800,
              boxShadow: active ? `0 4px 14px ${uc.glow}` : "0 1px 4px rgba(0,0,0,0.06)" }}>
            {t.label}
          </button>; })}
      </div>

      {loading ? <Loading/> : <>
        {tab === "aaja"     && <AajaTab    tasks={tasks} toggleTask={toggleTask} user={user} isAdmin={isAdmin} perms={perms} notes={notes} saveNotes={saveNotes}/>}
        {tab === "expenses" && <ExpensesTab bills={bills} addBill={addBill} deleteBill={deleteBill} user={user} isAdmin={isAdmin} spark={spark}/>}
        {tab === "report"   && <ReportTab  tasks={tasks} bills={bills}/>}
        {tab === "admin"    && isAdmin && <AdminTab perms={perms} setPerms={setPerms} bills={bills} tasks={tasks} toggleTask={toggleTask} deleteBill={deleteBill}/>}
      </>}
    </div>
  </div>;
}

// ─── AAJA TAB ─────────────────────────────────────────────────────────────────
function AajaTab({ tasks, toggleTask, user, isAdmin, perms, notes, saveNotes }) {
  const [selDate, setSelDate] = useState(todayStr());
  const td = tasks[selDate] || {};
  const isToday = selDate === todayStr();
  const canMark = (m) => isAdmin || (m === user || perms[user]?.markOthers);

  return <div>
    {/* Notes FIRST */}
    <div className="card fadeUp" style={{ padding: 16, marginBottom: 16, border: "1.5px solid #fde68a", background: "#fffbeb" }}>
      <div style={{ fontSize: 10, color: "#d97706", letterSpacing: 3, marginBottom: 10, fontWeight: 700 }}>📝 NOTES & REMINDERS</div>
      <textarea value={notes} onChange={e => saveNotes(e.target.value)}
        placeholder="Kei note garna xa? Kei kinnae xa, remind garna xa sabailai..."
        rows={3} style={{ width: "100%", padding: "11px 13px", fontSize: 13, resize: "none", lineHeight: 1.7, color: "#374151", background: "transparent", border: "1.5px solid #fcd34d", borderRadius: 10 }}/>
    </div>

    {/* Date selector */}
    <div className="card fadeUp1" style={{ padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
        {isToday ? "📅 Aaja — " : isAdmin ? "✏️ Edit: " : ""}{fmtShort(selDate)}
        {!isToday && <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 6 }}>(past)</span>}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {isAdmin && <input type="date" value={selDate} max={todayStr()} onChange={e => setSelDate(e.target.value)}
          style={{ padding: "7px 10px", fontSize: 12, borderRadius: 10, border: "1.5px solid #e2e8f0", color: "#374151", cursor: "pointer" }}/>}
        {!isToday && <button className="btn" onClick={() => setSelDate(todayStr())}
          style={{ padding: "7px 12px", borderRadius: 9, background: "#eff6ff", border: "1.5px solid #93c5fd", color: "#1d4ed8", fontSize: 11, fontWeight: 700 }}>Aaja →</button>}
      </div>
    </div>

    {isAdmin && !isToday && <div style={{ fontSize: 12, color: "#7c3aed", background: "#f5f3ff", border: "1.5px solid #ddd6fe", borderRadius: 10, padding: "8px 12px", marginBottom: 14, fontWeight: 700 }}>
      ✏️ Admin mode — {fmtDate(selDate)} ko data edit garna sakchha!
    </div>}

    <Divider label="DAILY KAAM"/>
    {DAILY_TASKS.map((t, i) => <TaskCard key={t.id} task={t} td={td} date={selDate} canMark={canMark} toggleTask={toggleTask} delay={i * .06}/>)}
    <Divider label="WEEKLY KAAM"/>
    {WEEKLY_TASKS.map((t, i) => <TaskCard key={t.id} task={t} td={td} date={selDate} canMark={canMark} toggleTask={toggleTask} delay={i * .06}/>)}
  </div>;
}

function Divider({ label }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 12px" }}>
    <div style={{ flex: 1, height: 1, background: "#e2e8f0" }}/>
    <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 3, fontWeight: 700 }}>{label}</div>
    <div style={{ flex: 1, height: 1, background: "#e2e8f0" }}/>
  </div>;
}

function TaskCard({ task, td, date, canMark, toggleTask, delay = 0 }) {
  const done = MEMBERS.find(m => td[`${task.id}_${m}`]);
  const dc = done ? MC[done] : null;
  return <div className="card" style={{ marginBottom: 10, padding: "14px 16px",
    border: `1.5px solid ${done ? dc.bg + "44" : "#f1f5f9"}`,
    boxShadow: done ? `0 4px 16px ${dc.glow}` : "0 2px 8px rgba(0,0,0,0.04)",
    animation: `fadeUp .38s ${delay}s both` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <span style={{ fontSize: 22, display: "inline-block", animation: done ? "float 3s ease-in-out infinite" : "" }}>{task.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: done ? dc.bg : "#374151" }}>{task.label}</div>
        {done && <div style={{ fontSize: 11, color: dc.bg, fontWeight: 700, marginTop: 1 }}>✅ {done} le garyo!</div>}
      </div>
    </div>
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
      {MEMBERS.map(m => {
        const mDone = td[`${task.id}_${m}`]; const mc = MC[m]; const can = canMark(m);
        return <button key={m} className="btn" onClick={e => can && toggleTask(date, task.id, m, e)}
          style={{ padding: "6px 12px", borderRadius: 9,
            background: mDone ? mc.bg : mc.light, color: mDone ? "white" : mc.text,
            border: `1.5px solid ${mDone ? mc.bg : mc.bg + "44"}`, fontSize: 12, fontWeight: 700,
            boxShadow: mDone ? `0 3px 10px ${mc.glow}` : "",
            opacity: can ? 1 : .35, cursor: can ? "pointer" : "not-allowed",
            transform: mDone ? "scale(1.05)" : "scale(1)", transition: "all .2s" }}>
          {mDone ? "✓ " : ""}{m}
        </button>;
      })}
    </div>
  </div>;
}

// ─── EXPENSES TAB ─────────────────────────────────────────────────────────────
function ExpensesTab({ bills, addBill, deleteBill, user, isAdmin, spark }) {
  const [cat, setCat]         = useState("Groceries");
  const [items, setItems]     = useState([{ name: "", amount: "" }]);
  const [paidBy, setPaidBy]   = useState(user !== "Admin" ? user : "Nitesh");
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits]   = useState({});
  const [billNote, setBillNote] = useState("");
  const [filter, setFilter]   = useState("All");
  const [billDate, setBillDate] = useState(todayStr());
  const [saving, setSaving]   = useState(false);

  const addItem  = () => setItems(p => [...p, { name: "", amount: "" }]);
  const updItem  = (i, f, v) => setItems(p => p.map((it, idx) => idx === i ? { ...it, [f]: v } : it));
  const remItem  = (i) => setItems(p => p.filter((_, idx) => idx !== i));
  const total    = items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
  const splitTotal = Object.values(splits).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const billNum  = `#${String(bills.length + 1).padStart(3, "0")}`;

  const submit = async (e) => {
    if (!items.some(it => it.name && it.amount)) return;
    setSaving(true);
    const bill = { cat, items: items.filter(it => it.name && it.amount), total, paid_by: paidBy,
      splits: splitMode ? { ...splits } : {}, note: billNote, date: billDate, added_by: user };
    await addBill(bill);
    spark(e, MC[paidBy].bg);
    setItems([{ name: "", amount: "" }]); setBillNote(""); setSplits({}); setSplitMode(false); setBillDate(todayStr());
    setSaving(false);
  };

  const filtered = filter === "All" ? bills : bills.filter(b => b.cat === filter || b.paid_by === filter);

  return <div>
    <div className="card fadeUp" style={{ padding: 18, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 3, fontWeight: 700 }}>NAYA BILL</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#94a3b8", fontFamily: "monospace" }}>{billNum}</div>
      </div>

      {isAdmin && <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 2, marginBottom: 6, fontWeight: 700 }}>MITI (ADMIN)</div>
        <input type="date" value={billDate} max={todayStr()} onChange={e => setBillDate(e.target.value)}
          style={{ padding: "9px 12px", fontSize: 13, width: "100%" }}/>
      </div>}

      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
        {CATEGORIES.map(c => { const active = cat === c; const color = CAT_COLORS[c];
          return <button key={c} className="btn" onClick={() => setCat(c)}
            style={{ padding: "8px 14px", borderRadius: 9, background: active ? color + "18" : "#f8fafc",
              color: active ? color : "#64748b", border: `1.5px solid ${active ? color + "66" : "#e2e8f0"}`,
              fontSize: 13, fontWeight: 700 }}>{CAT_ICONS[c]} {c}</button>; })}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 2, marginBottom: 8, fontWeight: 700 }}>KASLE TIRYO?</div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {MEMBERS.map(m => { const mc = MC[m]; const active = paidBy === m;
            return <button key={m} className="btn" onClick={() => setPaidBy(m)}
              style={{ padding: "7px 12px", borderRadius: 9, background: active ? mc.bg : mc.light,
                color: active ? "white" : mc.text, border: `1.5px solid ${active ? mc.bg : mc.bg + "44"}`,
                fontSize: 12, fontWeight: 700, boxShadow: active ? `0 3px 10px ${mc.glow}` : "" }}>
              {m}
            </button>; })}
        </div>
      </div>

      <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 2, marginBottom: 8, fontWeight: 700 }}>ITEMS</div>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
          <input value={it.name} onChange={e => updItem(i, "name", e.target.value)} placeholder="Item (Milk, Potato...)"
            style={{ flex: 2, padding: "10px 12px", fontSize: 13 }}/>
          <div style={{ flex: 1, display: "flex", alignItems: "center", background: "white", border: "1.5px solid #e2e8f0", borderRadius: 11, overflow: "hidden" }}>
            <span style={{ padding: "0 7px", color: "#94a3b8", fontSize: 14, fontWeight: 700 }}>£</span>
            <input value={it.amount} onChange={e => updItem(i, "amount", e.target.value)} type="number" placeholder="0.00"
              style={{ flex: 1, padding: "10px 4px", border: "none", borderRadius: 0, fontSize: 13, background: "transparent" }}/>
          </div>
          {items.length > 1 && <button className="btn" onClick={() => remItem(i)}
            style={{ background: "#fee2e2", border: "1.5px solid #fca5a5", borderRadius: 9, padding: "10px", color: "#ef4444", fontSize: 12 }}>✕</button>}
        </div>
      ))}
      <button className="btn" onClick={addItem}
        style={{ width: "100%", padding: "9px", borderRadius: 10, background: "#f8fafc",
          border: "1.5px dashed #cbd5e1", color: "#94a3b8", fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
        + Item Thap
      </button>

      <button className="btn" onClick={() => setSplitMode(p => !p)}
        style={{ width: "100%", padding: "9px", borderRadius: 10,
          background: splitMode ? "#f5f3ff" : "#f8fafc", border: `1.5px solid ${splitMode ? "#c4b5fd" : "#e2e8f0"}`,
          color: splitMode ? "#7c3aed" : "#94a3b8", fontSize: 12, fontWeight: 700, marginBottom: splitMode ? 10 : 12 }}>
        {splitMode ? "🔀 Split Mode ON" : "🔀 Bill Split Garne? (Optional)"}
      </button>
      {splitMode && <div style={{ padding: 14, background: "#f5f3ff", borderRadius: 13, border: "1.5px solid #ddd6fe", marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "#7c3aed", letterSpacing: 2, marginBottom: 10, fontWeight: 700 }}>KASLE KATI TIRCHA?</div>
        {MEMBERS.map(m => (
          <div key={m} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 58, fontSize: 12, color: MC[m].text, fontWeight: 700 }}>{m}</div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", background: "white", border: "1.5px solid #e2e8f0", borderRadius: 9, overflow: "hidden" }}>
              <span style={{ padding: "0 7px", color: "#94a3b8" }}>£</span>
              <input value={splits[m] || ""} onChange={e => setSplits(p => ({ ...p, [m]: e.target.value }))} type="number" placeholder="0.00"
                style={{ flex: 1, padding: "8px 4px", border: "none", borderRadius: 0, fontSize: 13, background: "transparent" }}/>
            </div>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginTop: 6,
          color: Math.abs(splitTotal - total) < 0.01 && splitTotal > 0 ? "#16a34a" : "#64748b" }}>
          <span>Split: £{splitTotal.toFixed(2)}</span><span>Total: £{total.toFixed(2)}</span>
        </div>
        {Math.abs(splitTotal - total) > 0.01 && splitTotal > 0 && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>⚠️ Match garena!</div>}
      </div>}

      <input value={billNote} onChange={e => setBillNote(e.target.value)} placeholder="📝 Note (optional)..."
        style={{ width: "100%", padding: "10px 12px", fontSize: 13, marginBottom: 14 }}/>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#1e293b" }}>£<span style={{ color: "#d97706" }}>{total.toFixed(2)}</span></div>
        <button className="btn" onClick={submit} disabled={saving}
          style={{ padding: "13px 22px", borderRadius: 12,
            background: `linear-gradient(135deg,${MC[paidBy].bg},${MC[paidBy].bg}cc)`,
            color: "white", fontSize: 14, fontWeight: 800,
            boxShadow: `0 6px 20px ${MC[paidBy].glow}`, opacity: saving ? .7 : 1 }}>
          {saving ? "Saving..." : "SAVE BILL ✓"}
        </button>
      </div>
    </div>

    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
      {["All", ...CATEGORIES, ...MEMBERS].map(f => (
        <button key={f} className="btn" onClick={() => setFilter(f)}
          style={{ padding: "6px 12px", borderRadius: 8,
            background: filter === f ? "#1e293b" : "white", color: filter === f ? "white" : "#64748b",
            border: `1.5px solid ${filter === f ? "#1e293b" : "#e2e8f0"}`, fontSize: 11, fontWeight: 700,
            boxShadow: filter === f ? "0 2px 8px rgba(0,0,0,0.15)" : "0 1px 3px rgba(0,0,0,0.04)" }}>
          {f}
        </button>
      ))}
    </div>

    {filtered.length === 0 && <div style={{ textAlign: "center", color: "#cbd5e1", padding: 48, fontSize: 14 }}>Kei bill xaina 📭</div>}
    {[...filtered].reverse().map((bill, bi) => {
      const mc = MC[bill.paid_by] || MC.Admin;
      return <div key={bill.id} className="card fadeUp" style={{ padding: 14, marginBottom: 10, border: `1.5px solid ${mc.bg}33`, boxShadow: `0 3px 12px ${mc.glow}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#94a3b8", fontFamily: "monospace" }}>#{String(filtered.length - bi).padStart(3, "0")}</span>
            <span style={{ padding: "3px 9px", borderRadius: 7, background: mc.light, color: mc.text, fontSize: 11, fontWeight: 700 }}>{bill.paid_by}</span>
            <span style={{ fontSize: 12, color: "#64748b" }}>{CAT_ICONS[bill.cat]} {bill.cat}</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{fmtDate(bill.date)}</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: mc.text }}>£{Number(bill.total).toFixed(2)}</div>
            {isAdmin && <button className="btn" onClick={() => deleteBill(bill.id)}
              style={{ padding: "4px 8px", borderRadius: 7, background: "#fee2e2", border: "1px solid #fca5a5", color: "#ef4444", fontSize: 11, fontWeight: 700 }}>🗑️</button>}
          </div>
        </div>
        {(bill.items || []).map((it, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>
            <span>{it.name}</span><span>£{parseFloat(it.amount).toFixed(2)}</span>
          </div>
        ))}
        {bill.note && <div style={{ marginTop: 8, fontSize: 12, color: "#d97706", fontStyle: "italic" }}>📝 {bill.note}</div>}
        {bill.splits && Object.keys(bill.splits).filter(m => parseFloat(bill.splits[m]) > 0).length > 0 && (
          <div style={{ marginTop: 8, padding: "8px 10px", background: "#f5f3ff", borderRadius: 9 }}>
            <div style={{ fontSize: 9, color: "#7c3aed", letterSpacing: 2, marginBottom: 5, fontWeight: 700 }}>SPLIT</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.entries(bill.splits).filter(([, v]) => parseFloat(v) > 0).map(([m, v]) => (
                <span key={m} style={{ fontSize: 12, color: MC[m]?.text || "#374151", fontWeight: 700 }}>{m}: £{parseFloat(v).toFixed(2)}</span>
              ))}
            </div>
          </div>
        )}
      </div>;
    })}
  </div>;
}

// ─── REPORT TAB ───────────────────────────────────────────────────────────────
function ReportTab({ tasks, bills }) {
  const [mode, setMode]     = useState("weekly");
  const [subTab, setSubTab] = useState("kaam");
  const today = todayStr(); const wk = weekStart(today);
  const inRange = (d) => mode === "weekly" ? weekStart(d) === wk : d.slice(0, 7) === today.slice(0, 7);

  const taskCounts = Object.fromEntries(MEMBERS.map(m => [m, 0]));
  Object.entries(tasks).forEach(([date, dt]) => {
    if (!inRange(date)) return;
    Object.values(dt).forEach(v => { if (v && taskCounts[v] !== undefined) taskCounts[v]++; });
  });
  const totalTasks = Object.values(taskCounts).reduce((s, v) => s + v, 0);
  const sorted = [...MEMBERS].sort((a, b) => taskCounts[b] - taskCounts[a]);

  const spending   = Object.fromEntries(MEMBERS.map(m => [m, 0]));
  const catSpend   = Object.fromEntries(CATEGORIES.map(c => [c, 0]));
  const filtBills  = bills.filter(b => inRange(b.date));
  filtBills.forEach(b => { spending[b.paid_by] = (spending[b.paid_by] || 0) + Number(b.total); catSpend[b.cat] = (catSpend[b.cat] || 0) + Number(b.total); });
  const totalSpend = Object.values(spending).reduce((s, v) => s + v, 0);
  const medals     = ["🥇", "🥈", "🥉", "4️⃣"];

  return <div>
    <div className="fadeUp" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      {["weekly", "monthly"].map(m => (
        <button key={m} className="btn" onClick={() => setMode(m)}
          style={{ padding: "9px 16px", borderRadius: 10,
            background: mode === m ? "#1e293b" : "white", color: mode === m ? "white" : "#374151",
            border: `1.5px solid ${mode === m ? "#1e293b" : "#e2e8f0"}`, fontSize: 13, fontWeight: 800,
            boxShadow: mode === m ? "0 3px 10px rgba(0,0,0,0.15)" : "0 1px 4px rgba(0,0,0,0.05)" }}>
          {m.toUpperCase()}
        </button>
      ))}
    </div>

    <div className="card fadeUp1" style={{ padding: 20, marginBottom: 14, display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 14 }}>
      {sorted.map((m, i) => <Ring key={m} value={taskCounts[m]} max={Math.max(...Object.values(taskCounts), 1)} color={MC[m].bg} label={m} sub={medals[i]}/>)}
    </div>

    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      {["kaam", "kharcha"].map(s => (
        <button key={s} className="btn" onClick={() => setSubTab(s)}
          style={{ padding: "8px 16px", borderRadius: 9,
            background: subTab === s ? "#eff6ff" : "white", color: subTab === s ? "#1d4ed8" : "#64748b",
            border: `1.5px solid ${subTab === s ? "#93c5fd" : "#e2e8f0"}`, fontSize: 12, fontWeight: 800 }}>
          {s === "kaam" ? "⚡ KAAM" : "💷 KHARCHA"}
        </button>
      ))}
    </div>

    {subTab === "kaam" && <div className="fadeUp">
      <div className="card" style={{ padding: 18, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: 2 }}>LEADERBOARD</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>Jamma: {totalTasks}</div>
        </div>
        <BarChart data={sorted.map(m => ({ key: m, label: `${medals[sorted.indexOf(m)]} ${m}`, value: taskCounts[m] }))} colorFn={k => MC[k].bg}/>
      </div>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: 2, marginBottom: 14 }}>TASK BREAKDOWN</div>
        {[...DAILY_TASKS, ...WEEKLY_TASKS].map(task => {
          const who = Object.fromEntries(MEMBERS.map(m => [m, 0]));
          Object.entries(tasks).forEach(([date, dt]) => {
            if (!inRange(date)) return;
            MEMBERS.forEach(m => { if (dt[`${task.id}_${m}`]) who[m]++; });
          });
          const tt = Object.values(who).reduce((s, v) => s + v, 0);
          return <div key={task.id} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 13, color: "#374151", fontWeight: 700 }}>{task.icon} {task.label}</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>{tt}x</span>
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {MEMBERS.filter(m => who[m] > 0).map(m => (
                <span key={m} style={{ padding: "3px 8px", borderRadius: 6, background: MC[m].light, color: MC[m].text, fontSize: 11, fontWeight: 700 }}>{m} {who[m]}</span>
              ))}
              {tt === 0 && <span style={{ fontSize: 11, color: "#cbd5e1" }}>Kasaile garena</span>}
            </div>
          </div>;
        })}
      </div>
    </div>}

    {subTab === "kharcha" && <div className="fadeUp">
      <div className="card" style={{ padding: 18, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: 2 }}>KASLE KATI KHARCHYO</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#b45309" }}>£{totalSpend.toFixed(2)}</div>
        </div>
        <BarChart data={[...MEMBERS].sort((a, b) => spending[b] - spending[a]).map(m => ({ key: m, label: m, value: spending[m] }))} colorFn={k => MC[k].bg} unit="£"/>
      </div>
      <div className="card" style={{ padding: 18, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: 2, marginBottom: 14 }}>CATEGORY</div>
        <BarChart data={CATEGORIES.map(c => ({ key: c, label: `${CAT_ICONS[c]} ${c}`, value: catSpend[c] || 0 }))} colorFn={k => CAT_COLORS[k]} unit="£"/>
      </div>
      {filtBills.length > 0 && <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>RECENT BILLS</div>
        {[...filtBills].reverse().slice(0, 8).map(b => {
          const mc = MC[b.paid_by] || MC.Admin;
          return <div key={b.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: mc.text, fontWeight: 700 }}>{b.paid_by}</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>{CAT_ICONS[b.cat]}</span>
              <span style={{ fontSize: 11, color: "#cbd5e1" }}>{fmtDate(b.date)}</span>
              {b.note && <span style={{ fontSize: 11, color: "#d97706" }}>📝</span>}
            </div>
            <span style={{ fontSize: 16, fontWeight: 900, color: mc.text }}>£{Number(b.total).toFixed(2)}</span>
          </div>;
        })}
      </div>}
    </div>}
  </div>;
}

// ─── ADMIN TAB ────────────────────────────────────────────────────────────────
function AdminTab({ perms, setPerms, bills, tasks, toggleTask, deleteBill }) {
  const [editDate, setEditDate]   = useState(todayStr());
  const [editMode, setEditMode]   = useState("tasks");

  const togPerm = (m, key) => {
    const updated = { ...perms, [m]: { ...perms[m], [key]: !perms[m]?.[key] } };
    setPerms(updated);
    LS.set("g8_perms", updated);
  };

  const itemFreq = {};
  bills.forEach(b => (b.items || []).forEach(it => { itemFreq[it.name] = (itemFreq[it.name] || 0) + 1; }));
  const topItems = Object.entries(itemFreq).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const totalByMember = Object.fromEntries(MEMBERS.map(m => [m, bills.filter(b => b.paid_by === m).reduce((s, b) => s + Number(b.total), 0)]));

  const PERM_KEYS = [
    { key: "aaja",       label: "🌅 Aaja" },
    { key: "expenses",   label: "💷 Kharcha" },
    { key: "report",     label: "📊 Report" },
    { key: "markOthers", label: "👥 Aru Mark" },
  ];

  const selTd    = tasks[editDate] || {};
  const dayBills = bills.filter(b => b.date === editDate);

  return <div>
    {/* Past Date Editor */}
    <div className="card fadeUp" style={{ padding: 18, marginBottom: 16, border: "1.5px solid #ddd6fe", background: "#faf5ff" }}>
      <div style={{ fontSize: 11, color: "#7c3aed", letterSpacing: 3, marginBottom: 14, fontWeight: 700 }}>✏️ PAST DATE EDIT</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <input type="date" value={editDate} max={todayStr()} onChange={e => setEditDate(e.target.value)}
          style={{ padding: "9px 12px", fontSize: 13, flex: 1, minWidth: 140 }}/>
        <div style={{ display: "flex", gap: 6 }}>
          {["tasks", "bills"].map(m => (
            <button key={m} className="btn" onClick={() => setEditMode(m)}
              style={{ padding: "9px 14px", borderRadius: 9, background: editMode === m ? "#7c3aed" : "white",
                color: editMode === m ? "white" : "#7c3aed", border: `1.5px solid ${editMode === m ? "#7c3aed" : "#ddd6fe"}`,
                fontSize: 12, fontWeight: 700 }}>
              {m === "tasks" ? "⚡ Kaam" : "💷 Bills"}
            </button>
          ))}
        </div>
      </div>

      {editMode === "tasks" && <div>
        {[...DAILY_TASKS, ...WEEKLY_TASKS].map(task => {
          const done = MEMBERS.find(m => selTd[`${task.id}_${m}`]);
          return <div key={task.id} style={{ padding: "10px 12px", borderRadius: 10, background: "white", border: "1px solid #e9d5ff", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
              {task.icon} {task.label} {done && <span style={{ color: MC[done].text, fontSize: 12 }}>— {done}</span>}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {MEMBERS.map(m => {
                const mDone = selTd[`${task.id}_${m}`]; const mc = MC[m];
                return <button key={m} className="btn" onClick={() => toggleTask(editDate, task.id, m, null)}
                  style={{ padding: "5px 11px", borderRadius: 8, background: mDone ? mc.bg : mc.light,
                    color: mDone ? "white" : mc.text, border: `1.5px solid ${mDone ? mc.bg : mc.bg + "44"}`,
                    fontSize: 11, fontWeight: 700 }}>
                  {mDone ? "✓ " : ""}{m}
                </button>;
              })}
            </div>
          </div>;
        })}
      </div>}

      {editMode === "bills" && <div>
        {dayBills.length === 0 && <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 20 }}>Yo din ko kei bill xaina</div>}
        {dayBills.map(bill => {
          const mc = MC[bill.paid_by] || MC.Admin;
          return <div key={bill.id} style={{ padding: "12px 14px", borderRadius: 10, background: "white", border: `1.5px solid ${mc.bg}33`, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                <span style={{ padding: "2px 8px", borderRadius: 6, background: mc.light, color: mc.text, fontSize: 11, fontWeight: 700 }}>{bill.paid_by}</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>{CAT_ICONS[bill.cat]}</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontWeight: 900, color: mc.text }}>£{Number(bill.total).toFixed(2)}</span>
                <button className="btn" onClick={() => deleteBill(bill.id)}
                  style={{ padding: "4px 8px", borderRadius: 7, background: "#fee2e2", border: "1px solid #fca5a5", color: "#ef4444", fontSize: 11, fontWeight: 700 }}>🗑️ Delete</button>
              </div>
            </div>
            {(bill.items || []).map((it, i) => (
              <div key={i} style={{ fontSize: 12, color: "#64748b", display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                <span>{it.name}</span><span>£{parseFloat(it.amount).toFixed(2)}</span>
              </div>
            ))}
          </div>;
        })}
      </div>}
    </div>

    {/* Permissions */}
    <div className="card fadeUp1" style={{ padding: 18, marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 3, marginBottom: 14, fontWeight: 700 }}>PERMISSIONS</div>
      {MEMBERS.map(m => {
        const mc = MC[m];
        return <div key={m} style={{ marginBottom: 14, padding: "13px 14px", background: "#f8fafc", borderRadius: 14, border: `1.5px solid ${mc.bg}22` }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: mc.text, marginBottom: 10 }}>{m}</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {PERM_KEYS.map(({ key, label }) => {
              const on = !!perms[m]?.[key];
              return <button key={key} className="btn" onClick={() => togPerm(m, key)}
                style={{ padding: "6px 11px", borderRadius: 8,
                  background: on ? mc.light : "#f1f5f9", color: on ? mc.text : "#94a3b8",
                  border: `1.5px solid ${on ? mc.bg + "55" : "#e2e8f0"}`, fontSize: 11, fontWeight: 700 }}>
                {on ? "✓ " : ""}{label}
              </button>;
            })}
          </div>
        </div>;
      })}
    </div>

    {/* Analytics */}
    <div className="card fadeUp2" style={{ padding: 18, marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 3, marginBottom: 14, fontWeight: 700 }}>TOP ITEMS KINIYO</div>
      {topItems.length === 0 ? <div style={{ color: "#cbd5e1", fontSize: 13 }}>Data xaina abhi</div> :
        <BarChart data={topItems.map(([n, c]) => ({ key: n, label: n, value: c }))} colorFn={() => "#7c3aed"}/>}
    </div>

    <div className="card fadeUp3" style={{ padding: 18 }}>
      <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 3, marginBottom: 14, fontWeight: 700 }}>JAMMA KHARCHA (SABAI BELA)</div>
      <BarChart data={MEMBERS.map(m => ({ key: m, label: m, value: totalByMember[m] }))} colorFn={k => MC[k].bg} unit="£"/>
    </div>
  </div>;
}
