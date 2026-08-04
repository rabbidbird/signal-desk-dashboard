"use client";

import { useMemo, useState } from "react";

type View = "overview" | "positions" | "activity" | "risk";
type Range = "1W" | "1M" | "3M" | "ALL";

const chartData: Record<Range, number[]> = {
  "1W": [10000, 10028, 10012, 10076, 10054, 10122, 10108, 10156, 10142, 10206, 10188, 10242, 10218, 10285],
  "1M": [10000, 9986, 10018, 10042, 10024, 10066, 10038, 10082, 10106, 10094, 10138, 10116, 10172, 10148, 10196, 10184, 10228, 10212, 10254, 10285],
  "3M": [10000, 9962, 10034, 9988, 10070, 10118, 10082, 10146, 10106, 10178, 10142, 10202, 10168, 10236, 10192, 10254, 10218, 10285],
  ALL: [10000, 9940, 10022, 9976, 10064, 10018, 10102, 10070, 10152, 10112, 10196, 10158, 10228, 10188, 10285],
};

const positions = [
  {
    symbol: "NVDA",
    name: "NVIDIA",
    strategy: "Bull call spread",
    expiry: "Aug 21",
    legs: "$178 / $183 calls",
    entry: "$2.15",
    mark: "$2.62",
    pnl: "+$47.00",
    pct: "+21.9%",
    tone: "mint",
    progress: 68,
  },
  {
    symbol: "MSFT",
    name: "Microsoft",
    strategy: "Long call",
    expiry: "Aug 28",
    legs: "$535 call",
    entry: "$3.44",
    mark: "$3.18",
    pnl: "−$26.00",
    pct: "−7.6%",
    tone: "coral",
    progress: 42,
  },
  {
    symbol: "SPY",
    name: "S&P 500 ETF",
    strategy: "Bull call spread",
    expiry: "Aug 14",
    legs: "$636 / $640 calls",
    entry: "$1.36",
    mark: "$1.57",
    pnl: "+$21.00",
    pct: "+15.4%",
    tone: "blue",
    progress: 59,
  },
] as const;

const activity = [
  { time: "Today, 3:42 PM", symbol: "NVDA", action: "Opened", detail: "1 bull call spread · Aug 21", amount: "−$215.00", status: "Filled" },
  { time: "Today, 11:18 AM", symbol: "SPY", action: "Opened", detail: "1 bull call spread · Aug 14", amount: "−$136.00", status: "Filled" },
  { time: "Fri, 2:07 PM", symbol: "AAPL", action: "Closed", detail: "1 long call · Aug 14", amount: "+$82.00", status: "Target hit" },
  { time: "Fri, 10:31 AM", symbol: "MSFT", action: "Opened", detail: "1 long call · Aug 28", amount: "−$344.00", status: "Filled" },
  { time: "Thu, 1:56 PM", symbol: "QQQ", action: "No trade", detail: "Signal rejected · low volume", amount: "$0.00", status: "Guardrail" },
] as const;

const navItems: { id: View; label: string; glyph: string }[] = [
  { id: "overview", label: "Overview", glyph: "01" },
  { id: "positions", label: "Positions", glyph: "02" },
  { id: "activity", label: "Activity", glyph: "03" },
  { id: "risk", label: "Risk controls", glyph: "04" },
];

function MoneyCard({ label, value, note, accent }: { label: string; value: string; note: string; accent?: boolean }) {
  return (
    <article className={`metric-card ${accent ? "metric-card--accent" : ""}`}>
      <div className="metric-label"><span>{label}</span><span aria-hidden="true">↗</span></div>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

function EquityChart({ range, onRange }: { range: Range; onRange: (range: Range) => void }) {
  const data = chartData[range];
  const min = Math.min(...data) - 20;
  const max = Math.max(...data) + 20;
  return (
    <section className="panel chart-panel" aria-labelledby="equity-title">
      <div className="panel-heading chart-heading">
        <div>
          <p className="eyebrow">PERFORMANCE</p>
          <h2 id="equity-title">Paper equity</h2>
        </div>
        <div className="range-control" aria-label="Chart range">
          {(Object.keys(chartData) as Range[]).map((item) => (
            <button key={item} type="button" className={item === range ? "active" : ""} onClick={() => onRange(item)} aria-pressed={item === range}>{item}</button>
          ))}
        </div>
      </div>
      <div className="chart-value-row">
        <div><strong>$10,284.90</strong><span className="positive">+$284.90 · 2.85%</span></div>
        <span className="chart-caption">Since paper account start</span>
      </div>
      <div className="chart-wrap" role="img" aria-label={`Paper account equity chart for ${range}, ending at $10,284.90`}>
        <div className="chart-grid-lines" aria-hidden="true"><span /><span /><span /><span /></div>
        <div className="equity-bars" aria-hidden="true">
          {data.map((value, index) => {
            const height = 22 + ((value - min) / (max - min)) * 68;
            return <span key={`${range}-${index}`} style={{ height: `${height}%` }} />;
          })}
        </div>
        <div className="chart-axis" aria-hidden="true"><span>Start</span><span>Midpoint</span><span>Now</span></div>
      </div>
    </section>
  );
}

function PositionsPanel({ expanded = false }: { expanded?: boolean }) {
  return (
    <section className={`panel positions-panel ${expanded ? "positions-panel--expanded" : ""}`} aria-labelledby="positions-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">IN THE MARKET</p>
          <h2 id="positions-title">Open positions <span>3</span></h2>
        </div>
        <button className="text-button" type="button">Sort: P&amp;L <span aria-hidden="true">↓</span></button>
      </div>
      <div className="position-list">
        {positions.map((position) => (
          <article className="position-row" key={position.symbol}>
            <div className={`ticker-mark ticker-mark--${position.tone}`}>{position.symbol.slice(0, 1)}</div>
            <div className="position-main">
              <div className="position-title"><strong>{position.symbol}</strong><span>{position.name}</span></div>
              <p>{position.strategy} · {position.expiry}</p>
              {expanded && <small>{position.legs} · Entry {position.entry} · Mark {position.mark}</small>}
            </div>
            {expanded && <div className="position-progress" aria-label={`${position.progress}% to profit target`}><span style={{ width: `${position.progress}%` }} /></div>}
            <div className={`position-pnl ${position.pnl.startsWith("+") ? "positive" : "negative"}`}><strong>{position.pnl}</strong><span>{position.pct}</span></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ActivityPanel({ limit }: { limit?: number }) {
  const rows = typeof limit === "number" ? activity.slice(0, limit) : activity;
  return (
    <section className="panel activity-panel" aria-labelledby="activity-title">
      <div className="panel-heading">
        <div><p className="eyebrow">AUDIT TRAIL</p><h2 id="activity-title">Recent activity</h2></div>
        <span className="live-note"><i /> Preview ledger</span>
      </div>
      <div className="activity-table" role="table" aria-label="Recent paper trading activity">
        <div className="activity-head" role="row"><span>Time</span><span>Trade</span><span>Result</span></div>
        {rows.map((row) => (
          <div className="activity-row" role="row" key={`${row.time}-${row.symbol}`}>
            <time>{row.time}</time>
            <div className="activity-trade"><strong>{row.symbol} <b>{row.action}</b></strong><span>{row.detail}</span></div>
            <div className="activity-result"><strong>{row.amount}</strong><span>{row.status}</span></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RiskPanel({ full = false }: { full?: boolean }) {
  const controls = [
    { name: "Paper mode lock", value: "On", note: "Live orders are structurally disabled", state: "safe" },
    { name: "Open positions", value: "3 / 4", note: "One slot remains", state: "safe" },
    { name: "Maximum exposure", value: "$630 / $1,250", note: "50.4% of the account limit", state: "watch" },
    { name: "Daily loss buffer", value: "$385", note: "Trading stops at the daily limit", state: "safe" },
  ];
  return (
    <section className={`panel risk-panel ${full ? "risk-panel--full" : ""}`} aria-labelledby="risk-title">
      <div className="panel-heading">
        <div><p className="eyebrow">FAIL-CLOSED SAFETY</p><h2 id="risk-title">Risk guardrails</h2></div>
        <span className="safe-badge">All clear</span>
      </div>
      <div className="risk-list">
        {controls.map((control) => (
          <article className="risk-row" key={control.name}>
            <span className={`risk-dot risk-dot--${control.state}`} aria-hidden="true" />
            <div><strong>{control.name}</strong><small>{control.note}</small></div>
            <b>{control.value}</b>
          </article>
        ))}
      </div>
      {full && <div className="risk-explainer"><strong>Defined risk only.</strong><p>This dashboard mirrors the bot’s safety model: paper execution, limited position count, bounded loss, and explicit rejection reasons. No live broker connection is active.</p></div>}
    </section>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [range, setRange] = useState<Range>("1M");
  const [mobileNav, setMobileNav] = useState(false);
  const [filter, setFilter] = useState("");
  const pageMeta = useMemo(() => ({
    overview: ["Good afternoon, Jay", "Here’s how the paper account is doing."],
    positions: ["Open positions", "Track every defined-risk paper trade."],
    activity: ["Trade activity", "A clear record of decisions, fills, and rejections."],
    risk: ["Risk controls", "The guardrails protecting the paper account."],
  } as const)[view], [view]);

  const downloadCsv = () => {
    const header = "Time,Symbol,Action,Detail,Amount,Status";
    const lines = activity.map((row) => [row.time, row.symbol, row.action, row.detail, row.amount, row.status].map((value) => `"${value}"`).join(","));
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "signal-desk-paper-activity.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar--open" : ""}`}>
        <div className="brand"><span className="brand-mark"><i /><i /><i /></span><strong>Signal Desk</strong></div>
        <button className="mobile-close" type="button" onClick={() => setMobileNav(false)} aria-label="Close navigation">×</button>
        <nav aria-label="Primary navigation">
          <p>WORKSPACE</p>
          {navItems.map((item) => (
            <button key={item.id} type="button" className={view === item.id ? "active" : ""} onClick={() => { setView(item.id); setMobileNav(false); }}>
              <span>{item.glyph}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="system-card"><div><span className="status-light" /><strong>Analysis ready</strong></div><p>Phase 3 · paper only</p><span>Last model pass 4:02 PM ET</span></div>
          <div className="profile"><span>JL</span><div><strong>Jay&apos;s workspace</strong><small>Private preview</small></div><b>•••</b></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" type="button" aria-label="Open navigation" onClick={() => setMobileNav(true)}>☰</button>
          <label className="search-box"><span aria-hidden="true">⌕</span><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Find a symbol or trade" aria-label="Find a symbol or trade" /></label>
          <div className="header-actions"><span className="preview-pill"><i /> Paper · Preview data</span><button type="button" className="export-button" onClick={downloadCsv}>Export activity</button><button className="avatar" type="button" aria-label="Open profile">JL</button></div>
        </header>

        <div className="content-wrap">
          <section className="page-intro">
            <div><p className="date-line">MONDAY · AUGUST 3</p><h1>{pageMeta[0]}</h1><p>{pageMeta[1]}</p></div>
            <div className="market-status"><span>Market closed</span><small>Next session in 16h 28m</small></div>
          </section>

          {filter && <div className="filter-banner" role="status">Showing preview matches for <strong>“{filter}”</strong><button type="button" onClick={() => setFilter("")}>Clear</button></div>}

          {view === "overview" && (
            <>
              <section className="metric-grid" aria-label="Account summary">
                <MoneyCard label="Paper equity" value="$10,284.90" note="+$41.60 today" accent />
                <MoneyCard label="Buying power" value="$9,614.90" note="93.5% available" />
                <MoneyCard label="Open exposure" value="$630.00" note="Across 3 positions" />
                <MoneyCard label="Win rate" value="66.7%" note="4 wins · 2 losses" />
              </section>
              <div className="overview-grid"><EquityChart range={range} onRange={setRange} /><PositionsPanel /></div>
              <div className="lower-grid"><ActivityPanel limit={4} /><RiskPanel /></div>
            </>
          )}
          {view === "positions" && <div className="single-view"><PositionsPanel expanded /><RiskPanel /></div>}
          {view === "activity" && <div className="single-view single-view--wide"><ActivityPanel /></div>}
          {view === "risk" && <div className="single-view single-view--wide"><RiskPanel full /></div>}

          <footer><span>Signal Desk · paper trading preview</span><span>Data shown is illustrative until storage is connected.</span></footer>
        </div>
      </main>
      {mobileNav && <button className="nav-scrim" aria-label="Close navigation overlay" type="button" onClick={() => setMobileNav(false)} />}
    </div>
  );
}
