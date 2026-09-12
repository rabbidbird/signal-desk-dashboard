"use client";

import { useCallback, useEffect, useState } from "react";
import DashboardClient from "@/app/dashboard-client";
import type { PaperSnapshot } from "@/app/lib/paper-snapshot";

type SessionData = {
  snapshot: PaperSnapshot | null;
  sessions: { id: string; initial_cash_cents: number; created_at: string }[];
  pointer: { session_id: string; execution_armed: number; research_paused: number } | null;
  system: { paused: number; kill_switch_engaged: number; version: number; reason: string } | null;
  server_time: string;
};
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const time = (value: string) => new Date(value).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }) + " ET";

export function SessionPanels({ snapshot, paused, researchPaused, armed, historical = false }: { snapshot: PaperSnapshot; paused: boolean; researchPaused: boolean; armed: boolean; historical?: boolean }) {
  const a = snapshot.account;
  const change = a.equity_cents - a.initial_cash_cents;
  return <>
    <section className="session-metrics" aria-label="Paper session account">
      <article className="session-equity"><span>Paper equity</span><strong>{money(a.equity_cents)}</strong><p>{money(change)} · {(100 * change / a.initial_cash_cents).toFixed(2)}% since session start</p></article>
      <article><span>Available cash</span><strong>{money(a.cash_cents - a.reserved_cash_cents)}</strong><p>{money(a.reserved_cash_cents)} reserved · {money(a.cash_cents)} total cash</p></article>
      <article><span>Open exposure</span><strong>{money(a.exposure_cents)}</strong><p>{snapshot.positions.length} open positions</p></article>
      <article><span>Drawdown from peak</span><strong>{money(a.drawdown_cents)}</strong><p>Peak equity {money(a.peak_equity_cents)}</p></article>
    </section>
    <div className="session-columns">
      <section className="session-panel"><h2>Experiment settings</h2><dl className="session-facts">
        <div><dt>Starting capital</dt><dd>{money(a.initial_cash_cents)}</dd></div><div><dt>Allocation</dt><dd>AI chooses 0–100% of available cash</dd></div>
        <div><dt>Risk</dt><dd>High · full allocation permitted</dd></div><div><dt>Universe</dt><dd>Full supported market</dd></div>
        <div><dt>Execution</dt><dd>{historical ? "Historical session" : paused ? "Paused" : "Eligible"}</dd></div><div><dt>Research &amp; monitoring</dt><dd>{historical ? "Historical session" : researchPaused ? "Paused" : "Eligible"}</dd></div>
        <div><dt>Realized P&amp;L</dt><dd>{money(a.realized_pnl_cents)}</dd></div><div><dt>Unrealized P&amp;L</dt><dd>{money(a.unrealized_pnl_cents)}</dd></div>
      </dl><p className="session-note">Cash-backed paper fills. No margin or automatic refill.</p>{!armed && !historical && <p className="session-note">Prepared session. Activation and observed market-session validation are still required.</p>}</section>
      <section className="session-panel"><h2>Market coverage</h2><span className="session-tag">{snapshot.coverage.status.replaceAll("_", " ")}</span><p>{snapshot.coverage.detail}</p>
        <dl className="session-facts"><div><dt>Instruments examined</dt><dd>{snapshot.coverage.scanned.toLocaleString()}</dd></div><div><dt>Candidates</dt><dd>{snapshot.coverage.candidates.toLocaleString()}</dd></div><div><dt>Covered asset classes</dt><dd>{snapshot.coverage.asset_classes.join(", ") || "None yet"}</dd></div><div><dt>Provider truncation</dt><dd>{snapshot.coverage.truncated ? "Yes — partial coverage" : "None reported"}</dd></div></dl>
        <p className="session-note">Equities, ETFs, options and crypto are in scope. Indexes provide research context. Coverage reflects received data; no fixed ticker is preferred.</p>
      </section>
    </div>
    <section className="session-panel"><div className="session-section-title"><h2>Open paper positions</h2><span>{snapshot.positions.length}</span></div>
      {snapshot.positions.length ? <div className="session-table-wrap"><table><thead><tr><th>Symbol</th><th>Asset</th><th>Quantity</th><th>Entry / mark</th><th>Value</th><th>P&amp;L</th><th>Quote time</th></tr></thead><tbody>{snapshot.positions.map((p) => <tr key={p.id}><td><strong>{p.symbol}</strong></td><td>{p.asset_class}</td><td>{p.quantity}</td><td>${p.entry_price} / ${p.mark_price}</td><td>{money(p.market_value_cents)}</td><td>{money(p.unrealized_pnl_cents)}</td><td>{time(p.updated_at)}</td></tr>)}</tbody></table></div> : <p className="session-empty">No open positions in this session.</p>}
    </section>
    <section className="session-panel"><h2>AI decisions and fills</h2>{snapshot.decisions.length ? <ol className="session-decisions">{snapshot.decisions.map((d) => <li key={d.id}><div><strong>{d.symbol ?? "SESSION"} · {d.action}</strong><span className="session-tag">{d.outcome}</span></div><p>{d.message}</p><small>{time(d.occurred_at)}{d.allocation_bps !== null ? ` · ${(d.allocation_bps / 100).toFixed(1)}% allocation` : ""}</small></li>)}</ol> : <p className="session-empty">No decisions or fills yet. Research and trading will remain paused until you choose to start.</p>}</section>
    <section className="session-panel"><h2>Run health</h2><span className="session-tag">{snapshot.health.status.replaceAll("_", " ")}</span><p>{snapshot.health.detail}</p><p className="session-note">{snapshot.health.source_at ? `Worker check: ${time(snapshot.health.source_at)}` : "No worker check has been recorded for this session."} · Snapshot {snapshot.sequence}</p></section>
  </>;
}

export default function PaperSessionClient({ user }: { user: { displayName: string; email: string } }) {
  const [data, setData] = useState<SessionData | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(0);
  const refresh = useCallback(async () => {
    setClock(Date.now());
    try {
      const response = await fetch(`/api/paper-session${selected ? `?session=${encodeURIComponent(selected)}` : ""}`, { cache: "no-store" });
      const result = await response.json() as SessionData & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Session refresh failed");
      setData(result); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Session refresh failed"); }
  }, [selected]);
  useEffect(() => { const first = window.setTimeout(() => void refresh(), 0); const timer = window.setInterval(() => void refresh(), 15_000); return () => { window.clearTimeout(first); window.clearInterval(timer); }; }, [refresh]);
  const control = async (action: "pause" | "engage_kill" | "start_paper") => {
    setBusy(true);
    try {
      const response = await fetch(action === "start_paper" ? "/api/paper-session" : "/api/control", { method: action === "start_paper" ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(action === "start_paper" ? { action, session_id: data?.pointer?.session_id, control_version: data?.system?.version } : { action, reason: action === "engage_kill" ? "Operator stopped the paper experiment from the session dashboard" : "Operator paused paper execution and research" }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Control update failed");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Control update failed"); }
    finally { setBusy(false); }
  };
  if (data && !data.pointer && !selected) return <DashboardClient user={user} />;
  const s = data?.snapshot;
  const historical = !!s && s.session_id !== data?.pointer?.session_id;
  const paused = data?.system?.paused !== 0;
  const killed = data?.system?.kill_switch_engaged === 1;
  const armed = data?.pointer?.execution_armed === 1;
  const age = s ? Math.max(clock, Date.parse(data?.server_time ?? "")) - Date.parse(s.captured_at) : Infinity;
  const stale = age > 360_000; // Five-minute worker cadence plus completion grace.
  const startStale = age > 120_000; // Activation still requires a fresh receipt.
  return <main className="session-workspace">
    <header className="session-header"><div><p className="session-brand">Signal Desk · Paper trading</p><h1>{s ? `${money(s.account.initial_cash_cents)} experiment` : "Paper session"}</h1></div><div className="session-user">{user.displayName}<small>ChatGPT verified</small></div></header>
    <div className="session-toolbar"><label>Session<select value={selected} onChange={(event) => { setSelected(event.target.value); setData(null); }}><option value="">Current session</option>{data?.sessions.map((item) => <option key={item.id} value={item.id}>{time(item.created_at)} · {money(item.initial_cash_cents)}</option>)}</select></label><a href="/history/legacy">Prior bot history</a><button type="button" onClick={() => void refresh()}>Refresh</button></div>
    {error && <div className="session-warning" role="alert">{error} The last received snapshot remains visible.</div>}
    <div className="session-state" role="status"><div><strong>{historical ? "Historical session" : killed ? "Kill switch engaged" : paused ? "Trading paused" : "Paper trading eligible"}</strong><p>{historical ? "These totals belong only to the selected session." : data?.system?.reason ?? "Loading authenticated control state…"}</p><span>{s ? `Last complete snapshot: ${time(s.captured_at)}${stale ? " · Updates paused or overdue" : ""}` : "Awaiting session data"}</span></div>{!historical && <div className="session-actions">{paused && <button type="button" disabled={busy || killed || !s || startStale} onClick={() => void control("start_paper")}>Start paper trading</button>}<button type="button" disabled={busy || paused} onClick={() => void control("pause")}>Pause trading &amp; research</button><button type="button" className="session-stop" disabled={busy || killed || !data} onClick={() => void control("engage_kill")}>Stop experiment</button></div>}</div>
    {!historical && <p className="session-note">Start allows the scheduled worker to trade automatically, including a full cash allocation. The desktop worker must be scheduled and running; this page does not launch it. An overdue snapshot disables Start.</p>}
    {s ? <SessionPanels snapshot={s} paused={paused} researchPaused={data?.pointer?.research_paused !== 0} armed={armed} historical={historical} /> : <p className="session-empty">{error ? "Session data is unavailable." : "Loading paper session…"}</p>}
    <footer className="session-footer">Paper ledger only · All amounts are simulated · Prices are shown as of the recorded snapshot</footer>
  </main>;
}
