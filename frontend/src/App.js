import { useState, useEffect, useRef } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, Tooltip
} from "recharts";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Mono:wght@300;400;500&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --ink: #0d0d0d;
    --paper: #f5f0e8;
    --cream: #ede8dc;
    --rule: #c8bfaa;
    --faint: #e4ddd0;
    --accent: #1a3a2a;
    --red: #8b1a1a;
    --amber: #7a5c1a;
    --ink-muted: #5a5248;
    --ink-dim: #8a8278;
    --blue-ink: #1a2f4a;
  }

  html { scroll-behavior: smooth; font-size: 16px; }
  body {
    background: var(--paper);
    color: var(--ink);
    font-family: 'DM Mono', monospace;
    font-size: 15px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  input, select {
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--rule);
    color: var(--ink);
    font-family: 'DM Mono', monospace;
    font-size: 15px;
    padding: 8px 0;
    width: 100%;
    outline: none;
    transition: border-color 0.2s;
    border-radius: 0;
    -webkit-appearance: none;
    appearance: none;
  }
  input:focus, select:focus { border-bottom-color: var(--accent); }
  input::placeholder { color: var(--ink-dim); }
  select option { background: var(--paper); color: var(--ink); }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes flicker {
    0%,100% { opacity: 1; }
    50%      { opacity: 0.35; }
  }

  .r1 { animation: fadeUp 0.5s 0.0s ease both; }
  .r2 { animation: fadeUp 0.5s 0.1s ease both; }
  .r3 { animation: fadeUp 0.5s 0.2s ease both; }
  .r4 { animation: fadeUp 0.5s 0.3s ease both; }
  .r5 { animation: fadeUp 0.5s 0.45s ease both; }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: var(--faint); }
  ::-webkit-scrollbar-thumb { background: var(--rule); }
`;

/* ── tiny helpers ── */
const Rule = ({ thick, s }) => (
  <div style={{ width:"100%", height: thick?2:1, background: thick?"var(--ink)":"var(--rule)", ...s }} />
);

const Mono = ({ children, style }) => (
  <span style={{ fontFamily:"'DM Mono',monospace", ...style }}>{children}</span>
);

const Serif = ({ children, style, as: Tag = "span" }) => (
  <Tag style={{ fontFamily:"'Playfair Display',serif", ...style }}>{children}</Tag>
);

/* ── Section heading ── */
function SectionHead({ n, title }) {
  return (
    <div style={{ marginBottom:28, marginTop:48 }}>
      <div style={{ display:"flex", alignItems:"baseline", gap:14, marginBottom:10 }}>
        <Mono style={{ fontSize:13, color:"var(--ink-dim)", letterSpacing:"0.1em" }}>{n}</Mono>
        <Serif style={{ fontSize:28, fontWeight:700, letterSpacing:"-0.025em" }}>{title}</Serif>
      </div>
      <Rule />
    </div>
  );
}

/* ── Field ── */
function Field({ label, hint, children }) {
  return (
    <div style={{ paddingBottom:24 }}>
      <div style={{ fontSize:11, letterSpacing:"0.2em", textTransform:"uppercase", color:"var(--ink-muted)", marginBottom:6 }}>
        {label}{hint && <span style={{ color:"var(--ink-dim)", letterSpacing:0, textTransform:"none", marginLeft:6 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/* ── Stat box ── */
function Stat({ label, value, sub, color }) {
  const c = color || "var(--ink)";
  return (
    <div style={{ borderLeft:`3px solid ${c}`, paddingLeft:14 }}>
      <div style={{ fontSize:11, letterSpacing:"0.18em", textTransform:"uppercase", color:"var(--ink-muted)", marginBottom:3 }}>{label}</div>
      <Serif style={{ fontSize:36, fontWeight:900, color:c, lineHeight:1, letterSpacing:"-0.03em", display:"block" }}>{value}</Serif>
      {sub && <div style={{ fontSize:12, color:"var(--ink-dim)", marginTop:4 }}>{sub}</div>}
    </div>
  );
}

/* ── Score bar ── */
function ScoreBar({ label, value }) {
  const pct = value;
  const c = pct>60 ? "var(--accent)" : pct>35 ? "var(--amber)" : "var(--red)";
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5, alignItems:"baseline" }}>
        <span style={{ fontSize:13, color:"var(--ink-muted)" }}>{label}</span>
        <Serif style={{ fontSize:18, fontWeight:700, color:c }}>{value}</Serif>
      </div>
      <div style={{ height:2, background:"var(--faint)" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:c, transition:"width 1.2s cubic-bezier(.16,1,.3,1)" }} />
      </div>
    </div>
  );
}

/* ── Model row ── */
function ModelRow({ name, score }) {
  const high = score > 50;
  const c = high ? "var(--red)" : "var(--accent)";
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:20, alignItems:"center", padding:"9px 0", borderBottom:"1px solid var(--faint)" }}>
      <span style={{ fontSize:14, color:"var(--ink-muted)" }}>{name}</span>
      <Serif style={{ fontSize:14, fontWeight:700, color:c, letterSpacing:"0.04em" }}>{high ? "HIGH RISK" : "LOW RISK"}</Serif>
      <Mono style={{ fontSize:14, color:"var(--ink-dim)", minWidth:32, textAlign:"right" }}>{score}%</Mono>
    </div>
  );
}

/* ── Report ── */
function Report({ text }) {
  if (!text) return null;
  return (
    <div style={{ fontFamily:"'Libre Baskerville',serif", fontSize:16, lineHeight:1.9, color:"var(--ink)" }}>
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## "))
          return (
            <div key={i} style={{ marginTop:36, marginBottom:14 }}>
              <Mono style={{ fontSize:11, letterSpacing:"0.22em", textTransform:"uppercase", color:"var(--ink-muted)", display:"block", marginBottom:8 }}>{line.slice(3)}</Mono>
              <Rule />
            </div>
          );
        if (line.startsWith("- ")) {
          const html = line.slice(2).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
          return (
            <div key={i} style={{ display:"flex", gap:16, marginBottom:10 }}>
              <Mono style={{ color:"var(--rule)", marginTop:2 }}>—</Mono>
              <span dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          );
        }
        if (/^\d\./.test(line)) {
          const html = line.slice(2).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
          return (
            <div key={i} style={{ display:"flex", gap:16, marginBottom:12 }}>
              <Serif style={{ fontWeight:700, color:"var(--ink-muted)", minWidth:14, fontSize:15 }}>{line[0]}</Serif>
              <span dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          );
        }
        if (!line.trim()) return <div key={i} style={{ height:10 }} />;
        return <p key={i} style={{ marginBottom:8 }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>") }} />;
      })}
    </div>
  );
}

/* ── Loading ── */
function Loading() {
  const steps = ["Engineering features","Gradient boosting","Random forest","Logistic regression","SHAP attribution","Dimension scoring","Compiling report"];
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive(a => Math.min(a+1, steps.length-1)), 700);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ padding:"120px 0", display:"flex", flexDirection:"column", alignItems:"center", gap:48 }}>
      <Serif style={{ fontSize:13, letterSpacing:"0.25em", color:"var(--ink-muted)", textTransform:"uppercase" }}>
        Analysis in progress
      </Serif>
      <div style={{ width:1, height:60, background:"var(--rule)" }} />
      <div style={{ width:300 }}>
        {steps.map((s,i) => (
          <div key={i} style={{ display:"flex", gap:14, alignItems:"center", padding:"9px 0", opacity: i>active ? 0.2 : 1, transition:"opacity 0.4s" }}>
            <Serif style={{ fontSize:14, color: i<active?"var(--accent)":i===active?"var(--ink)":"var(--ink-dim)", animation: i===active?"flicker 1.2s infinite":"none" }}>
              {i<active ? "✓" : i===active ? "→" : "·"}
            </Serif>
            <span style={{ fontSize:14, color: i===active?"var(--ink)":"var(--ink-muted)", letterSpacing:"0.04em" }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════ */
export default function App() {
  const [form, setForm] = useState({
    startupName:"", industry:"", stage:"pre-seed",
    funding:"", burnRate:"", revenue:"", revenueGrowth:"",
    churnRate:"", teamSize:"", priorExits:"no", domainExp:"",
    monthsSinceLaunch:"", payingCustomers:"", tam:"medium", pivotCount:"0",
  });
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);
  const reportRef = useRef(null);

  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(null); setLoading(true); setResult(null);
    try {
      const res = await fetch("http://localhost:5000/analyze", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setResult(await res.json());
      setTimeout(() => reportRef.current?.scrollIntoView({ behavior:"smooth" }), 100);
    } catch {
      setError("Backend unreachable. Ensure python app.py is running on port 5000.");
    }
    setLoading(false);
  };

  const riskColor = result
    ? result.riskLevel==="high" ? "var(--red)"
    : result.riskLevel==="medium" ? "var(--amber)"
    : "var(--accent)"
    : "var(--ink)";

  const radarData = result ? Object.entries(result.dimensions).map(([name,value]) => ({ name, value })) : [];
  const shapData  = result ? result.shapBreakdown.map(s => ({
    name: s.factor.replace("Monthly ","").replace("Total ","").replace(" Rate",""),
    impact: Math.abs(s.impact),
    risk: s.impact > 0,
  })) : [];

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight:"100vh", background:"var(--paper)" }}>

        {/* MASTHEAD */}
        <div style={{
          borderBottom:"2px solid var(--ink)",
          padding:"18px 56px",
          display:"grid",
          gridTemplateColumns:"1fr auto 1fr",
          alignItems:"center",
          background:"var(--paper)",
          position:"sticky", top:0, zIndex:99,
        }}>
          <Mono style={{ fontSize:11, letterSpacing:"0.2em", color:"var(--ink-muted)", textTransform:"uppercase" }}>
            Venture Risk Intelligence
          </Mono>
          <Serif style={{ fontSize:17, fontWeight:700, letterSpacing:"0.06em", textAlign:"center" }}>
            STARTUP RISK ANALYSER
          </Serif>
          <Mono style={{ fontSize:11, letterSpacing:"0.15em", color:"var(--ink-muted)", textTransform:"uppercase", textAlign:"right" }}>
            {new Date().toLocaleDateString("en-GB",{ day:"2-digit", month:"long", year:"numeric" }).toUpperCase()}
          </Mono>
        </div>

        <div style={{ maxWidth:880, margin:"0 auto", padding:"0 56px 120px" }}>

          {/* ── FORM ── */}
          {!result && !loading && (
            <>
              {/* Hero */}
              <div style={{ padding:"72px 0 48px", borderBottom:"1px solid var(--rule)" }}>
                <Serif style={{ fontSize:54, fontWeight:900, letterSpacing:"-0.04em", lineHeight:1.08, display:"block" }}>
                  Is your startup<br />
                  <em style={{ color:"var(--ink-muted)" }}>built to survive?</em>
                </Serif>
                <p style={{ marginTop:22, fontSize:16, color:"var(--ink-muted)", maxWidth:500, lineHeight:1.75, fontFamily:"'Libre Baskerville',serif" }}>
                  Enter your startup's metrics. Three machine learning models and SHAP factor analysis will produce a risk-weighted assessment with a full analyst report.
                </p>
              </div>

              <SectionHead n="1" title="Identity" />
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:"0 40px" }}>
                <Field label="Startup name">
                  <input value={form.startupName} onChange={e=>set("startupName")(e.target.value)} placeholder="e.g. Meridian Labs" />
                </Field>
                <Field label="Industry">
                  <input value={form.industry} onChange={e=>set("industry")(e.target.value)} placeholder="e.g. SaaS" />
                </Field>
                <Field label="Stage">
                  <select value={form.stage} onChange={e=>set("stage")(e.target.value)}>
                    <option value="pre-seed">Pre-Seed</option>
                    <option value="seed">Seed</option>
                    <option value="series-a">Series A</option>
                  </select>
                </Field>
              </div>

              <SectionHead n="II" title="Financials" />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"0 40px" }}>
                <Field label="Total funding raised" hint="USD">
                  <input type="number" value={form.funding} onChange={e=>set("funding")(e.target.value)} placeholder="500000" />
                </Field>
                <Field label="Monthly burn rate" hint="USD">
                  <input type="number" value={form.burnRate} onChange={e=>set("burnRate")(e.target.value)} placeholder="30000" />
                </Field>
                <Field label="Monthly revenue" hint="USD">
                  <input type="number" value={form.revenue} onChange={e=>set("revenue")(e.target.value)} placeholder="12000" />
                </Field>
                <Field label="Revenue growth MoM" hint="%">
                  <input type="number" value={form.revenueGrowth} onChange={e=>set("revenueGrowth")(e.target.value)} placeholder="14" />
                </Field>
                <Field label="Monthly churn rate" hint="%">
                  <input type="number" value={form.churnRate} onChange={e=>set("churnRate")(e.target.value)} placeholder="4" />
                </Field>
              </div>

              <SectionHead n="III" title="Team" />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"0 40px" }}>
                <Field label="Team size">
                  <input type="number" value={form.teamSize} onChange={e=>set("teamSize")(e.target.value)} placeholder="6" />
                </Field>
                <Field label="Prior founder exits">
                  <select value={form.priorExits} onChange={e=>set("priorExits")(e.target.value)}>
                    <option value="no">None</option>
                    <option value="yes">At least one</option>
                  </select>
                </Field>
                <Field label="Avg domain experience" hint="years">
                  <input type="number" value={form.domainExp} onChange={e=>set("domainExp")(e.target.value)} placeholder="5" />
                </Field>
              </div>

              <SectionHead n="IV" title="Traction & Market" />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:"0 40px" }}>
                <Field label="Months since launch">
                  <input type="number" value={form.monthsSinceLaunch} onChange={e=>set("monthsSinceLaunch")(e.target.value)} placeholder="10" />
                </Field>
                <Field label="Paying customers">
                  <input type="number" value={form.payingCustomers} onChange={e=>set("payingCustomers")(e.target.value)} placeholder="40" />
                </Field>
                <Field label="Market size (TAM)">
                  <select value={form.tam} onChange={e=>set("tam")(e.target.value)}>
                    <option value="small">Small &lt;$500M</option>
                    <option value="medium">Medium $500M–$5B</option>
                    <option value="large">Large &gt;$5B</option>
                  </select>
                </Field>
                <Field label="Pivots to date">
                  <select value={form.pivotCount} onChange={e=>set("pivotCount")(e.target.value)}>
                    <option value="0">None</option>
                    <option value="1">One</option>
                    <option value="2">Two</option>
                    <option value="3">Three or more</option>
                  </select>
                </Field>
              </div>

              <Rule thick />
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:28 }}>
                <p style={{ fontSize:13, color:"var(--ink-dim)", fontFamily:"'Libre Baskerville',serif", fontStyle:"italic", maxWidth:360, lineHeight:1.7 }}>
                
                </p>
                <button
                  onClick={submit}
                  disabled={loading}
                  style={{
                    background:"var(--ink)", color:"var(--paper)", border:"none",
                    padding:"15px 44px",
                    fontFamily:"'DM Mono',monospace",
                    fontSize:12, letterSpacing:"0.2em", textTransform:"uppercase",
                    cursor:"pointer", opacity: loading?0.5:1, transition:"opacity 0.2s",
                  }}
                >
                  Run Analysis
                </button>
              </div>

              {error && (
                <div style={{ marginTop:24, padding:"14px 18px", borderLeft:"3px solid var(--red)", fontSize:13, color:"var(--red)", fontFamily:"'Libre Baskerville',serif", fontStyle:"italic" }}>
                  {error}
                </div>
              )}
            </>
          )}

          {loading && <Loading />}

          {/* ── RESULTS ── */}
          {result && (
            <div ref={reportRef}>

              {/* Verdict */}
              <div style={{ padding:"64px 0 40px", borderBottom:"2px solid var(--ink)" }} className="r1">
                <Mono style={{ fontSize:11, letterSpacing:"0.25em", textTransform:"uppercase", color:"var(--ink-muted)", display:"block", marginBottom:20 }}>
                  Risk Assessment — {form.startupName || "Unnamed Startup"} — {form.industry || "Unknown Industry"}
                </Mono>
                <div style={{ display:"flex", alignItems:"flex-end", gap:28, flexWrap:"wrap" }}>
                  <Serif style={{ fontSize:100, fontWeight:900, letterSpacing:"-0.05em", lineHeight:0.9, color:riskColor }}>
                    {result.riskScore}
                  </Serif>
                  <div style={{ paddingBottom:6 }}>
                    <Serif style={{ fontSize:32, fontWeight:700, color:riskColor, letterSpacing:"-0.02em", display:"block" }}>
                      {result.riskLabel}
                    </Serif>
                    <Mono style={{ fontSize:11, color:"var(--ink-muted)", letterSpacing:"0.12em", display:"block", marginTop:8 }}>
                      ENSEMBLE RISK SCORE /100
                    </Mono>
                  </div>
                </div>
              </div>

              {/* Key stats */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", borderBottom:"1px solid var(--rule)", padding:"36px 0", gap:8 }} className="r2">
                <Stat label="Runway" value={`${result.runway}mo`} sub="at current burn rate"
                  color={result.runway<6?"var(--red)":result.runway<12?"var(--amber)":"var(--accent)"} />
                <Stat label="Capital efficiency" value={`${result.efficiency}%`} sub="revenue / funding raised" />
                <Stat label="XGBoost signal" value={`${result.modelScores["XGBoost"]}%`} sub="primary model risk prob."
                  color={result.modelScores["XGBoost"]>50?"var(--red)":"var(--accent)"} />
                <Stat label="Ensemble verdict" value={`${result.riskScore}%`} sub="weighted across 3 models" color={riskColor} />
              </div>

              {/* Model consensus + dimensions */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:60, padding:"40px 0", borderBottom:"1px solid var(--rule)" }} className="r3">
                <div>
                  <Mono style={{ fontSize:11, letterSpacing:"0.2em", textTransform:"uppercase", color:"var(--ink-muted)", display:"block", marginBottom:16 }}>Model Consensus</Mono>
                  {Object.entries(result.modelScores).map(([name,score]) => <ModelRow key={name} name={name} score={score} />)}
                </div>
                <div>
                  <Mono style={{ fontSize:11, letterSpacing:"0.2em", textTransform:"uppercase", color:"var(--ink-muted)", display:"block", marginBottom:20 }}>Dimension Scores</Mono>
                  {Object.entries(result.dimensions).map(([dim,score]) => <ScoreBar key={dim} label={dim} value={score} />)}
                </div>
              </div>

              {/* Charts */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:60, padding:"40px 0", borderBottom:"1px solid var(--rule)" }} className="r4">
                <div>
                  <Mono style={{ fontSize:11, letterSpacing:"0.2em", textTransform:"uppercase", color:"var(--ink-muted)", display:"block", marginBottom:12 }}>Dimension Radar</Mono>
                  <ResponsiveContainer width="100%" height={240}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="var(--faint)" />
                      <PolarAngleAxis dataKey="name" tick={{ fill:"var(--ink-muted)", fontSize:11, fontFamily:"DM Mono" }} />
                      <Radar dataKey="value" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.08} strokeWidth={1.5} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <Mono style={{ fontSize:11, letterSpacing:"0.2em", textTransform:"uppercase", color:"var(--ink-muted)", display:"block", marginBottom:12 }}>Risk Factor Attribution (SHAP)</Mono>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={shapData} layout="vertical">
                      <XAxis type="number" tick={{ fill:"var(--ink-muted)", fontSize:11, fontFamily:"DM Mono" }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill:"var(--ink-dim)", fontSize:11, fontFamily:"DM Mono" }} width={90} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background:"var(--paper)", border:"1px solid var(--rule)", borderRadius:0, fontFamily:"DM Mono", fontSize:12 }} cursor={{ fill:"var(--faint)" }} />
                      <Bar dataKey="impact" radius={0}>
                        {shapData.map((d,i) => <Cell key={i} fill={d.risk?"var(--red)":"var(--accent)"} fillOpacity={0.65} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display:"flex", gap:24, marginTop:12 }}>
                    {[["var(--red)","Increases risk"],["var(--accent)","Reduces risk"]].map(([c,l]) => (
                      <div key={l} style={{ display:"flex", gap:6, alignItems:"center" }}>
                        <div style={{ width:9, height:9, background:c, opacity:0.65 }} />
                        <Mono style={{ fontSize:11, color:"var(--ink-dim)", letterSpacing:"0.1em", textTransform:"uppercase" }}>{l}</Mono>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Analyst report */}
              <div style={{ padding:"52px 0" }} className="r5">
                <div style={{ marginBottom:32 }}>
                  <Mono style={{ fontSize:11, letterSpacing:"0.25em", textTransform:"uppercase", color:"var(--ink-muted)", display:"block", marginBottom:8 }}>Analyst Report</Mono>
                  <Rule thick />
                </div>
                <Report text={result.report} />
              </div>

              <Rule thick />
              <div style={{ paddingTop:28, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <p style={{ fontSize:12, color:"var(--ink-dim)", fontFamily:"'Libre Baskerville',serif", fontStyle:"italic" }}>
                  Generated {new Date().toLocaleDateString("en-GB",{ weekday:"long", day:"2-digit", month:"long", year:"numeric" })}
                </p>
                <button
                  onClick={() => { setResult(null); setError(null); window.scrollTo({ top:0, behavior:"smooth" }); }}
                  style={{
                    background:"transparent", border:"1px solid var(--rule)",
                    padding:"12px 32px",
                    fontFamily:"'DM Mono',monospace",
                    fontSize:12, letterSpacing:"0.15em", textTransform:"uppercase",
                    color:"var(--ink-muted)", cursor:"pointer",
                  }}
                >
                  New Analysis
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
