import { useState, useEffect } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmt = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
const fmtShort = (amount) => {
  if (!amount) return "₹0";
  const abs = Math.abs(amount);
  if (abs >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
  return fmt(amount);
};

const DashboardPreview = () => {
  const [data, setData] = useState(null);
  const [todaySales, setTodaySales] = useState([]);
  const [mtd, setMtd] = useState(null);
  const [topRecv, setTopRecv] = useState([]);
  const [topPay, setTopPay] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';

    Promise.all([
      axios.get(`${API}/balance-sheet`),
      axios.get(`${API}/daily-sales?from_date=${today}&to_date=${today}`),
      axios.get(`${API}/daily-sales?from_date=${monthStart}&to_date=${today}`),
      axios.get(`${API}/dukandar-ledger`),
      axios.get(`${API}/bepaari-ledger`),
    ]).then(([bsRes, todayRes, mtdRes, dukRes, bepRes]) => {
      setData(bsRes.data);

      const ts = todayRes.data;
      setTodaySales(ts.sort((a, b) => b.gross_amount - a.gross_amount).slice(0, 5));

      const ms = mtdRes.data;
      const uniqueDates = [...new Set(ms.map(s => s.date))];
      setMtd({
        qty: ms.reduce((s, x) => s + x.quantity, 0),
        gross: ms.reduce((s, x) => s + x.gross_amount, 0),
        days: uniqueDates.length,
        entries: ms.length,
        todayQty: ts.reduce((s, x) => s + x.quantity, 0),
        todayGross: ts.reduce((s, x) => s + x.gross_amount, 0),
        todayEntries: ts.length,
        todayBeparis: [...new Set(ts.map(s => s.bepaari_id))].length,
      });

      const dukLedger = dukRes.data;
      setTopRecv(dukLedger.filter(d => d.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 5));

      const bepLedger = bepRes.data;
      setTopPay(bepLedger.filter(b => b.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 5));

      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div style={styles.loadingWrap}>
      <div style={styles.loadingSpinner} />
      <p style={{ color: '#C5A55A', fontFamily: 'Cormorant Garamond, serif', fontSize: 18, marginTop: 16 }}>Loading Dashboard...</p>
    </div>
  );

  const comm = data?.liabilities?.commission || {};
  const bs = data || {};
  const patti = data?.assets?.patti || 0;
  const bepPay = data?.liabilities?.bepaari_payables || 0;
  const todayAvg = mtd?.todayQty > 0 ? Math.round(mtd.todayGross / mtd.todayQty) : 0;

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>Dashboard</h1>
          <p style={styles.dateText}>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>
        <div style={{
          ...styles.badge,
          ...(bs.difference === 0 ? styles.badgeTallied : styles.badgePending)
        }}>
          {bs.difference === 0 ? 'BALANCE SHEET TALLIED' : `DIFF: ${fmt(bs.difference)}`}
        </div>
      </div>

      {/* MTD Bar */}
      <div style={styles.mtdBar}>
        <div style={styles.mtdLabel}>
          <span style={styles.mtdTitle}>MTD SUMMARY</span>
          <span style={styles.mtdMonth}>{new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
        </div>
        <div style={styles.mtdStats}>
          <div style={styles.mtdStat}>
            <span style={styles.mtdValue}>{mtd?.qty?.toLocaleString('en-IN')}</span>
            <span style={styles.mtdStatLabel}>Total Goats</span>
          </div>
          <div style={styles.mtdDivider} />
          <div style={styles.mtdStat}>
            <span style={styles.mtdValue}>{fmtShort(mtd?.gross)}</span>
            <span style={styles.mtdStatLabel}>Gross Sales</span>
          </div>
          <div style={styles.mtdDivider} />
          <div style={styles.mtdStat}>
            <span style={styles.mtdValue}>{mtd?.days}</span>
            <span style={styles.mtdStatLabel}>Market Days</span>
          </div>
          <div style={styles.mtdDivider} />
          <div style={styles.mtdStat}>
            <span style={styles.mtdValue}>{fmtShort(comm.total)}</span>
            <span style={styles.mtdStatLabel}>Net Commission</span>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>TODAY'S GOATS</span>
          <span style={styles.metricValue}>{mtd?.todayQty}</span>
          <span style={styles.metricSub}>{mtd?.todayEntries} txns | {mtd?.todayBeparis} bepaaris</span>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>TODAY'S SALES</span>
          <span style={styles.metricValue}>{fmtShort(mtd?.todayGross)}</span>
          <span style={styles.metricSub}>Avg {fmt(todayAvg)}/head</span>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>NET COMMISSION</span>
          <span style={styles.metricValue}>{fmtShort(comm.total)}</span>
          <span style={styles.metricSub}>Gross {fmtShort(comm.earned)}{comm.rate_diff > 0 ? ` +${fmtShort(comm.rate_diff)}` : ''} - Disc {fmtShort(comm.discounts)}</span>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>CASH BALANCE</span>
          <span style={{ ...styles.metricValue, color: '#166534' }}>{fmt(data?.assets?.cash_balance)}</span>
          <span style={styles.metricSub}>&nbsp;</span>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>BANK BALANCE</span>
          <span style={{ ...styles.metricValue, color: '#1B2A4A' }}>{fmt(data?.assets?.bank_balance)}</span>
          <span style={styles.metricSub}>&nbsp;</span>
        </div>
      </div>

      {/* Three Columns */}
      <div style={styles.threeCol}>
        {/* Today's Transactions */}
        <div style={styles.tableCard}>
          <div style={styles.tableHeader}>
            <h3 style={styles.tableTitle}>Today's Transactions</h3>
            <span style={styles.viewAll}>View All</span>
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>BEPAARI &rarr; DUKANDAR</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>QTY</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {todaySales.length === 0 ? (
                <tr><td colSpan="3" style={{ ...styles.td, textAlign: 'center', color: '#94a3b8' }}>No sales today</td></tr>
              ) : todaySales.map((s, i) => (
                <tr key={i} style={i % 2 === 1 ? { background: '#F9F8F6' } : {}}>
                  <td style={styles.td}>
                    <span style={styles.partyName}>{s.bepaari_name}</span>
                    <span style={styles.arrow}> &rarr; </span>
                    <span style={styles.partyNameLight}>{s.dukandar_name}</span>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>{s.quantity} pcs</td>
                  <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>{fmt(s.gross_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top Receivables */}
        <div style={styles.tableCard}>
          <div style={styles.tableHeader}>
            <h3 style={styles.tableTitle}>Top Receivables (Patti)</h3>
            <span style={styles.viewAll}>Ledger</span>
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>DUKANDAR</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>BALANCE</th>
              </tr>
            </thead>
            <tbody>
              {topRecv.map((d, i) => (
                <tr key={i} style={i % 2 === 1 ? { background: '#F9F8F6' } : {}}>
                  <td style={styles.td}><span style={styles.partyName}>{d.name}</span></td>
                  <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'Cormorant Garamond, serif', fontWeight: 600, color: '#991B1B' }}>{fmt(d.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={styles.totalBar}>
            <span>Total Patti</span>
            <span style={styles.totalValue}>{fmtShort(patti)}</span>
          </div>
        </div>

        {/* Top Payables */}
        <div style={styles.tableCard}>
          <div style={styles.tableHeader}>
            <h3 style={styles.tableTitle}>Top Payables (Bepaari)</h3>
            <span style={styles.viewAll}>Ledger</span>
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>BEPAARI</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>BALANCE</th>
              </tr>
            </thead>
            <tbody>
              {topPay.map((b, i) => (
                <tr key={i} style={i % 2 === 1 ? { background: '#F9F8F6' } : {}}>
                  <td style={styles.td}><span style={styles.partyName}>{b.name}</span></td>
                  <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'Cormorant Garamond, serif', fontWeight: 600, color: '#166534' }}>{fmt(b.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={styles.totalBar}>
            <span>Total Payable</span>
            <span style={styles.totalValue}>{fmtShort(bepPay)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: {
    background: '#F9F8F6',
    minHeight: '100vh',
    padding: '24px 32px',
    fontFamily: 'IBM Plex Sans, -apple-system, sans-serif',
  },
  loadingWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', background: '#1B2A4A',
  },
  loadingSpinner: {
    width: 40, height: 40, border: '3px solid #C5A55A33', borderTop: '3px solid #C5A55A',
    borderRadius: '50%', animation: 'spin 1s linear infinite',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20,
  },
  h1: {
    fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 32, fontWeight: 600,
    color: '#1B2A4A', margin: 0, letterSpacing: '-0.5px',
  },
  dateText: {
    fontSize: 13, color: '#475569', marginTop: 4,
  },
  badge: {
    padding: '6px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase',
  },
  badgeTallied: {
    background: 'rgba(22,101,52,0.08)', color: '#166534', border: '1px solid rgba(22,101,52,0.2)',
  },
  badgePending: {
    background: 'rgba(153,27,27,0.08)', color: '#991B1B', border: '1px solid rgba(153,27,27,0.2)',
  },
  mtdBar: {
    background: '#1B2A4A', padding: '16px 24px', marginBottom: 20,
    borderBottom: '3px solid #C5A55A', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  mtdLabel: {
    display: 'flex', flexDirection: 'column',
  },
  mtdTitle: {
    color: '#C5A55A', fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase',
  },
  mtdMonth: {
    color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2,
  },
  mtdStats: {
    display: 'flex', alignItems: 'center', gap: 0,
  },
  mtdStat: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px',
  },
  mtdValue: {
    color: '#C5A55A', fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 22, fontWeight: 700,
  },
  mtdStatLabel: {
    color: 'rgba(255,255,255,0.6)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2,
  },
  mtdDivider: {
    width: 1, height: 32, background: 'rgba(255,255,255,0.15)',
  },
  metricsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 20,
  },
  metricCard: {
    background: '#FFFFFF', padding: '20px 18px 16px', borderTop: '3px solid #C5A55A',
    border: '1px solid #E2E0D8', borderTopWidth: 3, display: 'flex', flexDirection: 'column',
  },
  metricLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', color: '#475569', textTransform: 'uppercase', marginBottom: 8,
  },
  metricValue: {
    fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 28, fontWeight: 700, color: '#1B2A4A', lineHeight: 1.1,
  },
  metricSub: {
    fontSize: 11, color: '#94a3b8', marginTop: 8,
  },
  threeCol: {
    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16,
  },
  tableCard: {
    background: '#FFFFFF', border: '1px solid #E2E0D8', overflow: 'hidden',
  },
  tableHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px 10px', borderBottom: '2px solid #1B2A4A',
  },
  tableTitle: {
    fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 16, fontWeight: 600, color: '#1B2A4A', margin: 0,
  },
  viewAll: {
    fontSize: 11, color: '#C5A55A', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  table: {
    width: '100%', borderCollapse: 'collapse',
  },
  th: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', color: '#475569', textTransform: 'uppercase',
    padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid #E2E0D8',
  },
  td: {
    padding: '10px 16px', fontSize: 13, color: '#0F172A', borderBottom: '1px solid #F1F0EC',
  },
  partyName: {
    fontWeight: 600, color: '#1B2A4A',
  },
  partyNameLight: {
    color: '#475569',
  },
  arrow: {
    color: '#C5A55A', fontWeight: 700,
  },
  totalBar: {
    display: 'flex', justifyContent: 'space-between', padding: '12px 16px',
    borderTop: '2px solid #C5A55A', fontSize: 12, fontWeight: 600, color: '#475569',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  totalValue: {
    fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 16, fontWeight: 700, color: '#1B2A4A',
  },
};

export default DashboardPreview;
