"use client";

import { useCallback, useEffect, useState } from "react";
import { watchlistFreshness } from "@/app/lib/watchlist-freshness";
import { financialTelemetry, telemetryFreshness } from "@/app/lib/telemetry-freshness";

type View = "overview" | "approvals" | "positions" | "activity" | "risk";
type Mode = "paper" | "live";

type Proposal = {
  id: string;
  revision: number;
  materialHash: string;
  mode: Mode;
  accountLabel: string;
  symbol: string;
  strategy: string;
  side: "buy" | "sell";
  optionType: "call" | "put";
  expiration: string;
  strikeCents: number;
  quantity: number;
  limitPriceCents: number;
  maxLossCents: number;
  rationale: string;
  exitPlan: string;
  brokerReviewId: string | null;
  brokerAlerts: string[];
  quoteTimestamp: string;
  expiresAt: string;
};

type Account = {
  mode: Mode;
  accountLabel: string;
  equityCents: number;
  buyingPowerCents: number;
  openExposureCents: number;
  dayPnlCents: number;
  winRateBps: number;
  openPositionsCount: number;
  recordedAt: string;
};

type Risk = {
  mode: Mode;
  maxPositions: number;
  maxExposureCents: number;
  dailyLossLimitCents: number;
  dailyLossRemainingCents: number;
  staleData: boolean;
  brokerConnected: boolean;
  summary: string;
  recordedAt: string;
};

type Watchlist = {
  status: "connected" | "degraded" | "offline";
  listLabel: string;
  itemCount: number;
  botManagedCount: number;
  syncedAt: string;
  message: string;
};

type Position = {
  id: string;
  mode: Mode;
  symbol: string;
  strategy: string;
  optionType: "call" | "put";
  expiration: string;
  strikeCents: number;
  quantity: number;
  entryPriceCents: number;
  markPriceCents: number;
  pnlCents: number;
  updatedAt: string;
};

type Activity = {
  id: string;
  mode: Mode;
  eventType: string;
  symbol: string | null;
  message: string;
  amountCents: number | null;
  status: string;
  occurredAt: string;
};

type SystemState = {
  paused: boolean;
  killSwitchEngaged: boolean;
  reason: string;
  version: number;
  updatedAt: string;
};

type DashboardData = {
  serverTime: string;
  paperAutoApprove: boolean;
  proposals: Proposal[];
  accounts: Account[];
  equityHistory: Account[];
  risk: Risk[];
  positions: Position[];
  activity: Activity[];
  watchlist: Watchlist | null;
  system: SystemState;
};

const navItems: { id: View; label: string; glyph: string }[] = [
  { id: "overview", label: "Overview", glyph: "01" },
  { id: "approvals", label: "Approvals", glyph: "02" },
  { id: "positions", label: "Positions", glyph: "03" },
  { id: "activity", label: "Activity", glyph: "04" },
  { id: "risk", label: "Risk controls", glyph: "05" },
];

const emptyData: DashboardData = {
  serverTime: new Date().toISOString(),
  paperAutoApprove: false,
  proposals: [],
  accounts: [],
  equityHistory: [],
  risk: [],
  positions: [],
  activity: [],
  watchlist: null,
  system: { paused: true, killSwitchEngaged: false, reason: "Awaiting dashboard sync", version: 0, updatedAt: new Date().toISOString() },
};

function money(cents: number | null | undefined, signed = false) {
  if (cents === null || cents === undefined) return "—";
  const prefix = signed && cents > 0 ? "+" : "";
  return `${prefix}${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)}`;
}

function strategyLabel(value: string) {
  const label = value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
  return value === "research_spread" ? `${label} · research only` : label;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00Z`));
}

function relativeTime(value: string) {
  const seconds = Math.round((Date.parse(value) - Date.now()) / 1000);
  if (Math.abs(seconds) < 60) return seconds >= 0 ? `${seconds}s remaining` : "expired";
  const minutes = Math.round(seconds / 60);
  return minutes >= 0 ? `${minutes}m remaining` : `${Math.abs(minutes)}m ago`;
}

function ModeBadge({ mode }: { mode: Mode }) {
  return <span className={`mode-badge mode-badge--${mode}`}>{mode === "live" ? "LIVE ACCOUNT" : "PAPER"}</span>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span aria-hidden="true">◇</span><strong>{title}</strong><p>{detail}</p></div>;
}

function WatchlistPanel({ watchlist, serverTime }: { watchlist: Watchlist | null; serverTime: string }) {
  const freshness = watchlist ? watchlistFreshness(watchlist.syncedAt, serverTime) : null;
  const effectiveStatus = watchlist === null ? "awaiting" : freshness?.label === "Stale" ? "stale" : watchlist.status;
  const displayStatus = { awaiting: "Awaiting sync", connected: "Connected", degraded: "Degraded", offline: "Offline", stale: "Stale" }[effectiveStatus];
  return (
    <section className={`panel watchlist-panel watchlist-panel--${effectiveStatus}`} aria-labelledby="watchlist-title">
      <div className="watchlist-copy"><p className="eyebrow">PAPER-ONLY MONITORING</p><h2 id="watchlist-title">Robinhood Options Watchlist</h2><p>{watchlist?.message ?? "Waiting for optional watchlist telemetry from the local bot."}</p></div>
      <div className="watchlist-state"><span className="watchlist-status">{displayStatus}</span><strong>{watchlist?.listLabel ?? "Awaiting sync"}</strong><small>{watchlist ? `Last sync ${new Date(watchlist.syncedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "No watchlist sync has been received"}</small></div>
      <div className="watchlist-facts"><div><span>Monitored</span><strong>{watchlist ? watchlist.botManagedCount : "—"}</strong><small>{watchlist ? `${watchlist.itemCount} total items` : "Awaiting bot count"}</small></div><div><span>Freshness</span><strong>{freshness?.label ?? "Awaiting sync"}</strong><small>{freshness?.detail ?? "No timestamp yet"}</small></div></div>
      <p className="watchlist-safety">Paper-only monitoring · Real Robinhood execution remains disabled in V1.</p>
    </section>
  );
}

function ApprovalCards({
  proposals,
  paused,
  busy,
  onDecision,
  compact = false,
}: {
  proposals: Proposal[];
  paused: boolean;
  busy: string | null;
  onDecision: (proposal: Proposal, decision: "approved" | "denied") => void;
  compact?: boolean;
}) {
  const visible = compact ? proposals.slice(0, 2) : proposals;
  return (
    <section className="panel approval-panel" aria-labelledby="approval-title">
      <div className="panel-heading">
        <div><p className="eyebrow">DECISION QUEUE</p><h2 id="approval-title">Pending approvals <span>{proposals.length}</span></h2></div>
        <span className="approval-note">Exact order · one-time decision</span>
      </div>
      {!visible.length ? <EmptyState title="No trades awaiting you" detail="New bot proposals will appear here with a short approval window." /> : (
        <div className="approval-list">
          {visible.map((proposal) => (
            <article className={`approval-card ${proposal.mode === "live" ? "approval-card--live" : ""}`} key={`${proposal.id}-${proposal.revision}`}>
              <div className="approval-top">
                <div><ModeBadge mode={proposal.mode} /><span className="expires">{relativeTime(proposal.expiresAt)}</span></div>
                <span className="revision">#{proposal.id} · rev {proposal.revision}</span>
              </div>
              <div className="approval-order">
                <div><span className="ticker-large">{proposal.symbol}</span><strong>{proposal.side.toUpperCase()} {proposal.quantity} {proposal.optionType.toUpperCase()}</strong></div>
                <strong className="approval-price">{money(proposal.limitPriceCents)} limit</strong>
              </div>
              <p className="contract-line">{shortDate(proposal.expiration)} · {money(proposal.strikeCents)} strike · {strategyLabel(proposal.strategy)}</p>
              <div className="approval-facts">
                <div><span>Maximum loss</span><strong>{money(proposal.maxLossCents)}</strong></div>
                <div><span>Account</span><strong>{proposal.accountLabel}</strong></div>
                <div><span>Quote captured</span><strong>{new Date(proposal.quoteTimestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}</strong></div>
              </div>
              <div className="proposal-copy"><p><strong>Why:</strong> {proposal.rationale}</p><p><strong>Exit:</strong> {proposal.exitPlan}</p></div>
              {!!proposal.brokerAlerts.length && <div className="broker-alert"><strong>Broker review alerts</strong>{proposal.brokerAlerts.map((alert) => <span key={alert}>{alert}</span>)}</div>}
              <div className="approval-actions">
                <button className="deny-button" type="button" disabled={busy === proposal.id} onClick={() => onDecision(proposal, "denied")}>Deny</button>
                <button className="approve-button" type="button" disabled={paused || busy === proposal.id} onClick={() => onDecision(proposal, "approved")}>{paused ? "Paused" : proposal.mode === "live" ? "Approve for broker review" : "Approve paper order"}</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AccountSummary({ account, mode }: { account?: Account; mode: Mode }) {
  return <section className="metric-grid" aria-label={`${mode} account summary`}><article className="metric-card metric-card--accent"><div className="metric-label"><span>{mode} equity</span><ModeBadge mode={mode} /></div><strong>{money(account?.equityCents)}</strong><p>{account ? `${money(account.dayPnlCents, true)} today` : "Awaiting current account data"}</p></article><article className="metric-card"><div className="metric-label"><span>Buying power</span><span>↗</span></div><strong>{money(account?.buyingPowerCents)}</strong><p>{account ? account.accountLabel : "Awaiting current account data"}</p></article><article className="metric-card"><div className="metric-label"><span>Open exposure</span><span>↗</span></div><strong>{money(account?.openExposureCents)}</strong><p>{account ? `Across ${account.openPositionsCount} positions` : "Position count unavailable"}</p></article><article className="metric-card"><div className="metric-label"><span>Win rate</span><span>↗</span></div><strong>{account ? `${(account.winRateBps / 100).toFixed(1)}%` : "—"}</strong><p>From completed ledger trades</p></article></section>;
}

function EquityChart({ accounts, nowMs }: { accounts: Account[]; nowMs: number }) {
  const data = accounts.slice(-30).map((item) => item.equityCents);
  const min = data.length ? Math.min(...data) : 0;
  const max = data.length ? Math.max(...data) : 1;
  const span = Math.max(max - min, 1);
  const last = accounts.at(-1);
  const first = accounts[0];
  const freshness = telemetryFreshness(last?.recordedAt, nowMs);
  const change = last && first ? last.equityCents - first.equityCents : null;
  return (
    <section className="panel chart-panel" aria-labelledby="equity-title">
      <div className="panel-heading"><div><p className="eyebrow">PERFORMANCE</p><h2 id="equity-title">Account equity</h2></div>{last && <ModeBadge mode={last.mode} />}</div>
      {!data.length ? <EmptyState title="No equity history yet" detail="The bot will record account snapshots here during each run." /> : <>
        <div className="chart-value-row"><div><strong>{money(last?.equityCents)}</strong><span className={(change ?? 0) >= 0 ? "positive" : "negative"}>{money(change, true)} in this view</span></div><span className="chart-caption">{data.length} snapshots · {freshness.label} · {freshness.detail}</span></div>
        <div className="chart-wrap" role="img" aria-label={`Account equity history ending at ${money(last?.equityCents)}`}>
          <div className="chart-grid-lines" aria-hidden="true"><span /><span /><span /><span /></div>
          <div className="equity-bars" aria-hidden="true">{data.map((value, index) => <span key={`${index}-${value}`} style={{ height: `${24 + ((value - min) / span) * 66}%` }} />)}</div>
          <div className="chart-axis" aria-hidden="true"><span>Earlier</span><span>Latest sync</span></div>
        </div>
      </>}
    </section>
  );
}

function PositionsPanel({ positions, current, detail, expanded = false }: { positions: Position[]; current: boolean; detail: string; expanded?: boolean }) {
  return (
    <section className={`panel positions-panel ${expanded ? "positions-panel--expanded" : ""}`} aria-labelledby="positions-title">
      <div className="panel-heading"><div><p className="eyebrow">IN THE MARKET</p><h2 id="positions-title">Open positions <span>{current ? positions.length : "—"}</span></h2></div><span className="approval-note">{current ? "Current bot snapshot" : "Awaiting current snapshot"}</span></div>
      {!current ? <EmptyState title="Position status unavailable" detail={detail} /> : !positions.length ? <EmptyState title="No open positions" detail="Open paper or live positions will appear after the bot syncs them." /> : <div className="position-list">
        {positions.map((position) => {
          const contract = `${shortDate(position.expiration)} · ${money(position.strikeCents)} ${position.optionType}`;
          return <article className="position-row" key={position.id}>
            <div className={`ticker-mark ${position.mode === "live" ? "ticker-mark--coral" : "ticker-mark--mint"}`}>{position.symbol.slice(0, 1)}</div>
            <div className="position-main"><div className="position-title"><strong>{position.symbol}</strong><ModeBadge mode={position.mode} /></div><p>{strategyLabel(position.strategy)} · {contract}</p>{expanded && <small>{position.quantity} contract{position.quantity === 1 ? "" : "s"} · Entry {money(position.entryPriceCents)} · Mark {money(position.markPriceCents)}</small>}</div>
            <div className={`position-pnl ${position.pnlCents >= 0 ? "positive" : "negative"}`}><strong>{money(position.pnlCents, true)}</strong><span>{position.entryPriceCents ? `${((position.pnlCents / (position.entryPriceCents * position.quantity * 100)) * 100).toFixed(1)}%` : "—"}</span></div>
          </article>;
        })}
      </div>}
    </section>
  );
}

function ActivityPanel({ activity, limit }: { activity: Activity[]; limit?: number }) {
  const rows = typeof limit === "number" ? activity.slice(0, limit) : activity;
  return (
    <section className="panel activity-panel" aria-labelledby="activity-title">
      <div className="panel-heading"><div><p className="eyebrow">AUDIT TRAIL</p><h2 id="activity-title">Recent activity</h2></div><span className="live-note"><i /> Durable ledger</span></div>
      {!rows.length ? <EmptyState title="No activity recorded" detail="Proposals, decisions, fills, rejections, and safety events will be recorded here." /> : <div className="activity-table" role="table" aria-label="Trading activity">
        <div className="activity-head" role="row"><span>Time</span><span>Event</span><span>Result</span></div>
        {rows.map((row) => <div className="activity-row" role="row" key={row.id}><time>{new Date(row.occurredAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time><div className="activity-trade"><strong>{row.symbol ?? "SYSTEM"} <b>{row.eventType.replaceAll("_", " ")}</b></strong><span>{row.message}</span></div><div className="activity-result"><strong>{money(row.amountCents, true)}</strong><span><ModeBadge mode={row.mode} /> {row.status}</span></div></div>)}
      </div>}
    </section>
  );
}

function RiskPanel({ risk, account, telemetry, system, paperAutoApprove, onControl, busy, controlReason, onControlReason }: { risk?: Risk; account?: Account; telemetry: ReturnType<typeof financialTelemetry>; system: SystemState; paperAutoApprove: boolean; onControl: (action: string) => void; busy: string | null; controlReason: string; onControlReason: (reason: string) => void }) {
  const controls = [
    { name: "Trading state", value: system.killSwitchEngaged ? "KILL SWITCH" : system.paused ? "Paused" : "Eligible", note: system.reason, state: system.paused ? "watch" : "safe" },
    { name: "Paper approvals", value: paperAutoApprove ? "Automatic" : "Manual", note: paperAutoApprove ? "Exact paper proposals auto-approve; live execution remains disabled" : "Waiting for an operator decision", state: paperAutoApprove ? "safe" : "watch" },
    { name: "Market data", value: telemetry.marketDataCurrent ? "Fresh" : risk ? "Stale" : "Unknown", note: telemetry.riskFreshness.detail, state: telemetry.marketDataCurrent ? "safe" : "watch" },
    { name: "Broker telemetry", value: !telemetry.riskFreshness.current ? "Unknown" : risk?.brokerConnected ? "Reported connected" : "Reported offline", note: telemetry.riskFreshness.detail, state: telemetry.riskFreshness.current && risk?.brokerConnected ? "safe" : "watch" },
    { name: "Open positions", value: `${telemetry.accountCurrent ? account?.openPositionsCount : "—"} / ${telemetry.riskFreshness.current ? risk?.maxPositions : "—"}`, note: telemetry.accountCurrent ? "Current account versus configured limit" : telemetry.detail, state: telemetry.accountCurrent && account && risk && account.openPositionsCount <= risk.maxPositions ? "safe" : "watch" },
    { name: "Exposure", value: `${money(telemetry.accountCurrent ? account?.openExposureCents : undefined)} / ${money(telemetry.riskFreshness.current ? risk?.maxExposureCents : undefined)}`, note: telemetry.marketDataCurrent ? `Daily loss buffer ${money(risk?.dailyLossRemainingCents)}` : telemetry.detail, state: telemetry.accountCurrent && account && risk && account.openExposureCents <= risk.maxExposureCents ? "safe" : "watch" },
  ];
  return <section className="panel risk-panel" aria-labelledby="risk-title">
    <div className="panel-heading"><div><p className="eyebrow">FAIL-CLOSED SAFETY</p><h2 id="risk-title">Risk &amp; emergency controls</h2></div><span className={system.paused ? "watch-badge" : "safe-badge"}>{system.killSwitchEngaged ? "Emergency stop" : system.paused ? "Paused" : "Eligible"}</span></div>
    <div className="risk-list">{controls.map((control) => <article className="risk-row" key={control.name}><span className={`risk-dot risk-dot--${control.state}`} aria-hidden="true" /><div><strong>{control.name}</strong><small>{control.note}</small></div><b>{control.value}</b></article>)}</div>
    <div className="control-actions">
      {!system.paused && <button type="button" className="pause-button" disabled={!!busy} onClick={() => onControl("pause")}>Pause new trades</button>}
      {system.paused && !system.killSwitchEngaged && <button type="button" className="resume-button" disabled={!!busy} onClick={() => onControl("resume")}>Resume eligible trading</button>}
      <label className="control-reason"><span>{system.killSwitchEngaged ? "Reason to clear" : "Emergency-stop reason"}</span><input aria-label={system.killSwitchEngaged ? "Reason to clear kill switch" : "Kill-switch reason"} value={controlReason} onChange={(event) => onControlReason(event.target.value)} maxLength={500} placeholder={system.killSwitchEngaged ? "Why is it safe to clear?" : "Why are you stopping trading?"} /></label>
      {!system.killSwitchEngaged && <button type="button" className="kill-button" disabled={!!busy || !controlReason.trim()} onClick={() => onControl("engage_kill")}>Engage kill switch</button>}
      {system.killSwitchEngaged && <button type="button" className="clear-kill-button" disabled={!!busy || !controlReason.trim()} onClick={() => onControl("clear_kill")}>Clear kill switch (remains paused)</button>}
    </div>
  </section>;
}

export default function DashboardClient({ user }: { user: { displayName: string; email: string } }) {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [nowMs, setNowMs] = useState(Date.now);
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  const [view, setView] = useState<View>("overview");
  const [mode, setMode] = useState<Mode>("paper");
  const [mobileNav, setMobileNav] = useState(false);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [controlReason, setControlReason] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const body = await response.json() as DashboardData & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Dashboard sync failed");
      setData(body);
      setReceivedAt(Date.now());
      setNowMs(Date.now());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Dashboard sync failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => { setNowMs(Date.now()); void refresh(); }, 15_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const decide = async (proposal: Proposal, decision: "approved" | "denied") => {
    setBusy(proposal.id);
    try {
      const response = await fetch(`/api/proposals/${encodeURIComponent(proposal.id)}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, revision: proposal.revision, materialHash: proposal.materialHash }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Decision failed");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Decision failed");
    } finally {
      setBusy(null);
    }
  };

  const updateControl = async (action: string) => {
    const reason = action === "engage_kill" || action === "clear_kill" ? controlReason.trim() : null;
    if ((action === "engage_kill" || action === "clear_kill") && !reason) return;
    setBusy(action);
    try {
      const response = await fetch("/api/control", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, reason }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Control update failed");
      if (action === "engage_kill" || action === "clear_kill") setControlReason("");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Control update failed");
    } finally {
      setBusy(null);
    }
  };

  const account = data.accounts.find((item) => item.mode === mode);
  const risk = data.risk.find((item) => item.mode === mode);
  const serverMs = Date.parse(data.serverTime);
  const observedNow = receivedAt === null || !Number.isFinite(serverMs) ? nowMs : serverMs + Math.max(0, nowMs - receivedAt);
  const modePositions = data.positions.filter((item) => item.mode === mode);
  const telemetry = financialTelemetry(account, risk, modePositions, observedNow);
  const currentAccount = telemetry.accountCurrent ? account : undefined;
  const positions = data.positions.filter((item) => item.mode === mode && (!filter || item.symbol.includes(filter.toUpperCase())));
  const activity = data.activity.filter((item) => item.mode === mode && (!filter || item.symbol?.includes(filter.toUpperCase()) || item.message.toLowerCase().includes(filter.toLowerCase())));
  const history = data.equityHistory.filter((item) => item.mode === mode);
  const proposals = data.proposals.filter((item) => !filter || item.symbol.includes(filter.toUpperCase()));
  const firstName = user.displayName.includes("@") ? "Operator" : user.displayName.split(" ")[0];
  const initials = user.displayName.includes("@") ? user.email.slice(0, 2).toUpperCase() : user.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const pageMeta = {
    overview: [`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${firstName}`, "Your account, decision queue, and safety state."],
    approvals: ["Trade approvals", "Every approval is bound to one exact, expiring order revision."],
    positions: ["Open positions", "Current positions from the latest bot synchronization."],
    activity: ["Trade activity", "A durable record of proposals, decisions, fills, and safety events."],
    risk: ["Risk controls", "Pause new trading or stop the experiment immediately."],
  }[view];

  const downloadCsv = () => {
    const header = "Time,Mode,Symbol,Event,Message,Amount,Status";
    const lines = activity.map((row) => [row.occurredAt, row.mode, row.symbol ?? "", row.eventType, row.message, row.amountCents === null ? "" : (row.amountCents / 100).toFixed(2), row.status].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
    const url = URL.createObjectURL(new Blob([[header, ...lines].join("\n")], { type: "text/csv" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `signal-desk-${mode}-activity.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar--open" : ""}`}>
      <div className="brand"><span className="brand-mark"><i /><i /><i /></span><strong>Signal Desk</strong></div>
      <button className="mobile-close" type="button" onClick={() => setMobileNav(false)} aria-label="Close navigation">×</button>
      <nav aria-label="Primary navigation"><p>WORKSPACE</p>{navItems.map((item) => <button key={item.id} type="button" className={view === item.id ? "active" : ""} onClick={() => { setView(item.id); setMobileNav(false); }}><span>{item.glyph}</span>{item.label}{item.id === "approvals" && data.proposals.length > 0 && <b className="nav-count">{data.proposals.length}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="system-card"><div><span className={`status-light ${data.system.paused ? "status-light--paused" : ""}`} /><strong>{data.system.killSwitchEngaged ? "Kill switch engaged" : data.system.paused ? "Trading paused" : "Bot eligible"}</strong></div><p>Persistent control · v{data.system.version}</p><span>{data.system.reason}</span></div><div className="profile"><span>{initials}</span><div><strong>{user.displayName}</strong><small>ChatGPT verified</small></div></div></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><button className="mobile-menu" type="button" aria-label="Open navigation" onClick={() => setMobileNav(true)}>☰</button><label className="search-box"><span aria-hidden="true">⌕</span><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Find a symbol or event" aria-label="Find a symbol or event" /></label><div className="header-actions"><div className="mode-switch" aria-label="Account mode">{(["paper", "live"] as const).map((item) => <button key={item} type="button" className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item}</button>)}</div><button type="button" className="export-button" onClick={downloadCsv}>Export activity</button><span className="avatar">{initials}</span></div></header>
      <div className="content-wrap">
        <section className="page-intro"><div><p className="date-line">{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase()}</p><h1>{pageMeta[0]}</h1><p>{pageMeta[1]}</p></div><div className="market-status"><span>{loading ? "Syncing" : error || telemetry.needsAttention ? "Needs attention" : "Dashboard synced"}</span><small>{error ?? `Last refresh ${new Date(data.serverTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}</small></div></section>
        {error && <div className="error-banner" role="alert"><strong>Dashboard needs attention.</strong> {error}<button type="button" onClick={() => void refresh()}>Retry</button></div>}
        <div className={`safety-banner ${data.system.killSwitchEngaged ? "safety-banner--kill" : data.system.paused ? "safety-banner--paused" : "safety-banner--active"}`}><div><strong>{data.system.killSwitchEngaged ? "Emergency kill switch engaged" : data.system.paused ? "New trades are paused" : "Trading is eligible within configured limits"}</strong><span>{data.system.reason} · Paper approvals {data.paperAutoApprove ? "automatic" : "manual"}</span></div>{!data.system.paused && <button type="button" onClick={() => void updateControl("pause")}>Pause now</button>}</div>

        {!loading && telemetry.needsAttention && <div className="telemetry-banner" role="status"><strong>Financial data needs an update.</strong><span>{telemetry.detail} Current totals are hidden until a complete, fresh snapshot arrives.</span></div>}
        {view === "overview" && <><AccountSummary account={currentAccount} mode={mode} /><WatchlistPanel watchlist={data.watchlist} serverTime={new Date(observedNow).toISOString()} /><ApprovalCards proposals={proposals} paused={data.system.paused} busy={busy} onDecision={decide} compact /><div className="overview-grid"><EquityChart accounts={history} nowMs={observedNow} /><PositionsPanel positions={positions} current={telemetry.positionsCurrent} detail={telemetry.detail} /></div><div className="lower-grid"><ActivityPanel activity={activity} limit={5} /><RiskPanel risk={risk} account={account} telemetry={telemetry} system={data.system} paperAutoApprove={data.paperAutoApprove} busy={busy} onControl={updateControl} controlReason={controlReason} onControlReason={setControlReason} /></div></>}
        {view === "approvals" && <div className="single-view single-view--wide"><ApprovalCards proposals={proposals} paused={data.system.paused} busy={busy} onDecision={decide} /></div>}
        {view === "positions" && <div className="single-view"><PositionsPanel positions={positions} current={telemetry.positionsCurrent} detail={telemetry.detail} expanded /><RiskPanel risk={risk} account={account} telemetry={telemetry} system={data.system} paperAutoApprove={data.paperAutoApprove} busy={busy} onControl={updateControl} controlReason={controlReason} onControlReason={setControlReason} /></div>}
        {view === "activity" && <div className="single-view single-view--wide"><ActivityPanel activity={activity} /></div>}
        {view === "risk" && <div className="single-view single-view--wide"><RiskPanel risk={risk} account={account} telemetry={telemetry} system={data.system} paperAutoApprove={data.paperAutoApprove} busy={busy} onControl={updateControl} controlReason={controlReason} onControlReason={setControlReason} /></div>}
        <footer><span>Signal Desk · D1-backed trading operations</span><span>{mode === "live" ? "Live account view — Robinhood execution is disabled in V1." : "Paper account selected — no real order execution."}</span></footer>
      </div>
    </main>
    {mobileNav && <button className="nav-scrim" aria-label="Close navigation overlay" type="button" onClick={() => setMobileNav(false)} />}
  </div>;
}
