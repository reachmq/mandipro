import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import axios from "axios";
import "./App.css";
import BepariAakda from "./BepariAakda";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
};

const fmtShort = (amount) => {
  if (!amount) return "₹0";
  const abs = Math.abs(amount);
  if (abs >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
  return formatCurrency(amount);
};

// ============== SIDEBAR ==============
const Sidebar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { path: "/", label: "Dashboard", icon: "📊" },
    { path: "/daily-sales", label: "Daily Sales", icon: "🐐" },
    { path: "/cash-book", label: "Cash & Bank", icon: "💰" },
    { path: "/adjustments", label: "Adjustments (JV)", icon: "🔄" },
    { path: "/balance-transfer", label: "Balance Transfer", icon: "↔️" },
    { path: "/bepaari-ledger", label: "Bepaari Ledger", icon: "📒" },
    { path: "/dukandar-ledger", label: "Dukandar Ledger", icon: "📗" },
    { path: "/balance-sheet", label: "Balance Sheet", icon: "📑" },
    { path: "/bepaari-aakda", label: "Bepaari Aakda", icon: "🧾" },
    { path: "/party-statement", label: "Party Statement", icon: "📄" },
    { path: "/masters", label: "Masters", icon: "⚙️" },
  ];

  return (
    <>
      <button className="mobile-hamburger" data-testid="mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)}>
        {mobileOpen ? "✕" : "☰"}
      </button>
      {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`} data-testid="sidebar">
        <div className="sidebar-header">
          <h1>Mandi</h1>
          <span>Accounting</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};

// ============== DASHBOARD (Dalal Premium Traditional) ==============
const Dashboard = () => {
  const [data, setData] = useState(null);
  const [todaySales, setTodaySales] = useState([]);
  const [mtd, setMtd] = useState(null);
  const [topRecv, setTopRecv] = useState([]);
  const [topPay, setTopPay] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
        todayQty: ts.reduce((s, x) => s + x.quantity, 0),
        todayGross: ts.reduce((s, x) => s + x.gross_amount, 0),
        todayEntries: ts.length,
        todayBeparis: [...new Set(ts.map(s => s.bepaari_id))].length,
      });
      setTopRecv(dukRes.data.filter(d => d.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 5));
      setTopPay(bepRes.data.filter(b => b.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 5));
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  const comm = data?.liabilities?.commission || {};
  const patti = data?.assets?.patti || 0;
  const bepPay = data?.liabilities?.bepaari_payables || 0;
  const todayAvg = mtd?.todayQty > 0 ? Math.round(mtd.todayGross / mtd.todayQty) : 0;

  return (
    <div className="dalal-dashboard" data-testid="dashboard-page">
      {/* Header */}
      <div className="dalal-header">
        <div>
          <h1 className="dalal-h1">Dashboard</h1>
          <p className="dalal-date">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className={`dalal-badge ${data?.difference === 0 ? 'tallied' : 'pending'}`} data-testid="bs-status-badge">
          {data?.difference === 0 ? 'BALANCE SHEET TALLIED' : `DIFF: ${formatCurrency(data?.difference)}`}
        </div>
      </div>

      {/* MTD Bar */}
      <div className="dalal-mtd-bar">
        <div className="dalal-mtd-label">
          <span className="dalal-mtd-title">MTD SUMMARY</span>
          <span className="dalal-mtd-month">{new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
        </div>
        <div className="dalal-mtd-stats">
          <div className="dalal-mtd-stat">
            <span className="dalal-mtd-value">{mtd?.qty?.toLocaleString('en-IN')}</span>
            <span className="dalal-mtd-stat-label">Total Goats</span>
          </div>
          <div className="dalal-mtd-divider" />
          <div className="dalal-mtd-stat">
            <span className="dalal-mtd-value">{fmtShort(mtd?.gross)}</span>
            <span className="dalal-mtd-stat-label">Gross Sales</span>
          </div>
          <div className="dalal-mtd-divider" />
          <div className="dalal-mtd-stat">
            <span className="dalal-mtd-value">{mtd?.days}</span>
            <span className="dalal-mtd-stat-label">Market Days</span>
          </div>
          <div className="dalal-mtd-divider" />
          <div className="dalal-mtd-stat">
            <span className="dalal-mtd-value">{fmtShort(comm.total)}</span>
            <span className="dalal-mtd-stat-label">Net Commission</span>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="dalal-metrics" data-testid="metric-cards">
        <div className="dalal-metric-card" data-testid="metric-today-goats">
          <span className="dalal-metric-label">TODAY'S GOATS</span>
          <span className="dalal-metric-value">{mtd?.todayQty || 0}</span>
          <span className="dalal-metric-sub">{mtd?.todayEntries || 0} txns | {mtd?.todayBeparis || 0} bepaaris</span>
        </div>
        <div className="dalal-metric-card" data-testid="metric-today-sales">
          <span className="dalal-metric-label">TODAY'S SALES</span>
          <span className="dalal-metric-value">{fmtShort(mtd?.todayGross)}</span>
          <span className="dalal-metric-sub">{todayAvg > 0 ? `Avg ${formatCurrency(todayAvg)}/head` : 'No sales today'}</span>
        </div>
        <div className="dalal-metric-card" data-testid="commission-card">
          <span className="dalal-metric-label">NET COMMISSION</span>
          <span className="dalal-metric-value">{fmtShort(comm.total)}</span>
          <span className="dalal-metric-sub">Gross {fmtShort(comm.earned)}{comm.rate_diff > 0 ? ` +${fmtShort(comm.rate_diff)}` : ''} - Disc {fmtShort(comm.discounts)}</span>
        </div>
        <div className="dalal-metric-card" data-testid="metric-cash">
          <span className="dalal-metric-label">CASH BALANCE</span>
          <span className="dalal-metric-value cash">{formatCurrency(data?.assets?.cash_balance)}</span>
          <span className="dalal-metric-sub">&nbsp;</span>
        </div>
        <div className="dalal-metric-card" data-testid="metric-bank">
          <span className="dalal-metric-label">BANK BALANCE</span>
          <span className="dalal-metric-value">{formatCurrency(data?.assets?.bank_balance)}</span>
          <span className="dalal-metric-sub">&nbsp;</span>
        </div>
      </div>

      {/* Three Columns */}
      <div className="dalal-three-col">
        {/* Today's Transactions */}
        <div className="dalal-table-card">
          <div className="dalal-table-header">
            <h3>Today's Transactions</h3>
            <span className="dalal-link" onClick={() => navigate('/daily-sales')} data-testid="view-all-sales">View All</span>
          </div>
          <table className="dalal-table">
            <thead><tr><th>BEPAARI &rarr; DUKANDAR</th><th style={{textAlign:'center'}}>QTY</th><th style={{textAlign:'right'}}>AMOUNT</th></tr></thead>
            <tbody>
              {todaySales.length === 0 ? (
                <tr><td colSpan="3" className="dalal-empty">No sales today</td></tr>
              ) : todaySales.map((s, i) => (
                <tr key={i} className={i % 2 === 1 ? 'alt-row' : ''}>
                  <td><strong>{s.bepaari_name}</strong><span className="dalal-arrow"> &rarr; </span><span className="dalal-muted">{s.dukandar_name}</span></td>
                  <td style={{textAlign:'center'}}>{s.quantity} pcs</td>
                  <td style={{textAlign:'right'}} className="dalal-amount">{formatCurrency(s.gross_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top Receivables */}
        <div className="dalal-table-card">
          <div className="dalal-table-header">
            <h3>Top Receivables (Patti)</h3>
            <span className="dalal-link" onClick={() => navigate('/dukandar-ledger')} data-testid="view-dukandar-ledger">Ledger</span>
          </div>
          <table className="dalal-table">
            <thead><tr><th>DUKANDAR</th><th style={{textAlign:'right'}}>BALANCE</th></tr></thead>
            <tbody>
              {topRecv.map((d, i) => (
                <tr key={i} className={i % 2 === 1 ? 'alt-row' : ''}>
                  <td><strong>{d.name}</strong></td>
                  <td style={{textAlign:'right'}} className="dalal-amount recv">{formatCurrency(d.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="dalal-total-bar">
            <span>Total Patti</span>
            <span className="dalal-total-value">{fmtShort(patti)}</span>
          </div>
        </div>

        {/* Top Payables */}
        <div className="dalal-table-card">
          <div className="dalal-table-header">
            <h3>Top Payables (Bepaari)</h3>
            <span className="dalal-link" onClick={() => navigate('/bepaari-ledger')} data-testid="view-bepaari-ledger">Ledger</span>
          </div>
          <table className="dalal-table">
            <thead><tr><th>BEPAARI</th><th style={{textAlign:'right'}}>BALANCE</th></tr></thead>
            <tbody>
              {topPay.map((b, i) => (
                <tr key={i} className={i % 2 === 1 ? 'alt-row' : ''}>
                  <td><strong>{b.name}</strong></td>
                  <td style={{textAlign:'right'}} className="dalal-amount pay">{formatCurrency(b.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="dalal-total-bar">
            <span>Total Payable</span>
            <span className="dalal-total-value">{fmtShort(bepPay)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============== DAILY SALES ==============
const DailySales = () => {
  const [sales, setSales] = useState([]);
  const [bepaaris, setBeparis] = useState([]);
  const [dukandars, setDukandars] = useState([]);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], bepaari_id: "", dukandar_id: "", quantity: "", rate: "", discount: "0", dukandar_rate: "" });
  const [filters, setFilters] = useState({ fromDate: "", toDate: "", bepaari_id: "", dukandar_id: "" });
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      let url = `${API}/daily-sales?`;
      if (filters.fromDate) url += `from_date=${filters.fromDate}&`;
      if (filters.toDate) url += `to_date=${filters.toDate}&`;
      if (filters.bepaari_id) url += `bepaari_id=${filters.bepaari_id}&`;
      if (filters.dukandar_id) url += `dukandar_id=${filters.dukandar_id}&`;
      
      const [salesRes, bepaariRes, dukandarRes] = await Promise.all([
        axios.get(url), axios.get(`${API}/bepaaris`), axios.get(`${API}/dukandars`)
      ]);
      setSales(salesRes.data);
      setBeparis(bepaariRes.data);
      setDukandars(dukandarRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [filters]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await axios.post(`${API}/daily-sales`, { ...form, quantity: parseInt(form.quantity), rate: parseFloat(form.rate), discount: parseFloat(form.discount || 0), dukandar_rate: form.dukandar_rate ? parseFloat(form.dukandar_rate) : null });
    setForm({ ...form, bepaari_id: "", dukandar_id: "", quantity: "", rate: "", discount: "0", dukandar_rate: "" });
    fetchData();
  };

  const handleDelete = async (id) => { if (window.confirm("Delete?")) { await axios.delete(`${API}/daily-sales/${id}`); fetchData(); } };

  const handleEdit = (sale) => {
    setEditItem(sale);
    setEditForm({
      date: sale.date,
      bepaari_id: sale.bepaari_id,
      dukandar_id: sale.dukandar_id,
      quantity: sale.quantity,
      rate: sale.rate,
      discount: sale.discount || 0,
      dukandar_rate: sale.dukandar_rate || ""
    });
  };

  const handleEditSave = async () => {
    await axios.put(`${API}/daily-sales/${editItem.id}`, {
      ...editForm,
      quantity: parseInt(editForm.quantity),
      rate: parseFloat(editForm.rate),
      discount: parseFloat(editForm.discount || 0),
      dukandar_rate: editForm.dukandar_rate ? parseFloat(editForm.dukandar_rate) : null
    });
    setEditItem(null);
    fetchData();
  };

  const clearFilters = () => setFilters({ fromDate: "", toDate: "", bepaari_id: "", dukandar_id: "" });

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <h2>Daily Sales</h2>
      
      <form className="entry-form" onSubmit={handleSubmit}>
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        <select value={form.bepaari_id} onChange={(e) => setForm({ ...form, bepaari_id: e.target.value })} required>
          <option value="">Select Bepaari</option>
          {bepaaris.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={form.dukandar_id} onChange={(e) => setForm({ ...form, dukandar_id: e.target.value })} required>
          <option value="">Select Dukandar</option>
          {dukandars.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input type="number" placeholder="Qty" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required min="1" />
        <input type="number" placeholder="Rate" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} required />
        <input type="number" placeholder="Discount" value={form.discount === "0" ? "" : form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} onBlur={(e) => { if (!e.target.value) setForm({ ...form, discount: "0" }); }} />
        <span className="form-calc" data-testid="form-total">{form.quantity && form.rate ? `Total: ${formatCurrency(parseInt(form.quantity || 0) * parseFloat(form.rate || 0) - parseFloat(form.discount || 0))}` : ''}</span>
        <input type="number" placeholder="Duk. Rate (optional)" value={form.dukandar_rate} onChange={(e) => setForm({ ...form, dukandar_rate: e.target.value })} data-testid="dukandar-rate-input" title="Only fill if Dukandar rate differs from Bepaari rate" />
        <button type="submit" className="btn-primary">Add Sale</button>
      </form>

      <div className="filter-bar">
        <label>From:</label><input type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} />
        <label>To:</label><input type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} />
        <select value={filters.bepaari_id} onChange={(e) => setFilters({ ...filters, bepaari_id: e.target.value })}>
          <option value="">All Bepaaris</option>
          {bepaaris.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={filters.dukandar_id} onChange={(e) => setFilters({ ...filters, dukandar_id: e.target.value })}>
          <option value="">All Dukandars</option>
          {dukandars.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button className="btn-clear" onClick={clearFilters}>Clear</button>
      </div>

      <div className="table-container">
        <table>
          <thead><tr><th>Date</th><th>Bepaari</th><th>Dukandar</th><th>Qty</th><th>Rate</th><th>Duk. Rate</th><th>Gross</th><th>Disc</th><th>Net</th><th>Actions</th></tr></thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>{s.date}</td><td>{s.bepaari_name}</td><td>{s.dukandar_name}</td><td>{s.quantity}</td>
                <td>{formatCurrency(s.rate)}</td>
                <td>{s.dukandar_rate ? formatCurrency(s.dukandar_rate) : "—"}</td>
                <td>{formatCurrency(s.gross_amount)}</td><td>{formatCurrency(s.discount)}</td><td>{formatCurrency(s.net_amount)}</td>
                <td>
                  <button className="btn-edit" onClick={() => handleEdit(s)}>Edit</button>
                  <button className="btn-delete" onClick={() => handleDelete(s.id)}>X</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editItem && (
        <div className="modal-overlay" onClick={() => setEditItem(null)}>
          <div className="modal-content" onClick={(ev) => ev.stopPropagation()}>
            <h3>Edit Sale</h3>
            <div className="edit-form">
              <label>Date:<input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} /></label>
              <label>Bepaari:
                <select value={editForm.bepaari_id} onChange={(e) => setEditForm({ ...editForm, bepaari_id: e.target.value })}>
                  {bepaaris.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
              <label>Dukandar:
                <select value={editForm.dukandar_id} onChange={(e) => setEditForm({ ...editForm, dukandar_id: e.target.value })}>
                  {dukandars.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label>Qty:<input type="number" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} /></label>
              <label>Rate:<input type="number" value={editForm.rate} onChange={(e) => setEditForm({ ...editForm, rate: e.target.value })} /></label>
              <label>Discount:<input type="number" value={editForm.discount} onChange={(e) => setEditForm({ ...editForm, discount: e.target.value })} /></label>
              <label>Duk. Rate:<input type="number" placeholder="Optional" value={editForm.dukandar_rate} onChange={(e) => setEditForm({ ...editForm, dukandar_rate: e.target.value })} /></label>
            </div>
            <div className="modal-actions">
              <button className="btn-clear" onClick={() => setEditItem(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleEditSave}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============== CASH BOOK ==============
const CashBook = () => {
  const [entries, setEntries] = useState([]);
  const [allEntries, setAllEntries] = useState([]); // Store all entries for client-side filtering
  const [parties, setParties] = useState([]);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], type: "", sub_type: "", party_id: "", amount: "", bf_disc: "", mode: "CASH", particulars: "" });
  const [filters, setFilters] = useState({ fromDate: "", toDate: "", type: "", subType: "", party: "", mode: "" });
  const [sortBy, setSortBy] = useState("date-desc");
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [loading, setLoading] = useState(true);

  const types = ["BEPAARI", "DUKANDAR", "CAPITAL", "LOAN", "AMANAT", "ADVANCE", "EXPENSE", "ZAKAT"];
  const subTypes = {
    BEPAARI: ["PAYMENT", "MOTOR", "BHUSSA", "GAWALI", "CASH_ADV"],
    DUKANDAR: ["RECEIPT"],
    CAPITAL: ["TAKEN", "REPAID", "WITHDRAWN"],
    LOAN: ["TAKEN", "REPAID"],
    AMANAT: ["TAKEN", "REPAID"],
    ADVANCE: ["GIVEN", "RECEIVED"],
    EXPENSE: ["MANDI", "TRAVEL", "FOOD", "SALARY", "MHN_PERSONAL", "JB_PAID", "MISC", "OTHER"],
    ZAKAT: ["PROVISION", "PAID"]
  };
  const modes = ["CASH", "BANK", "UPI", "TRANSFER"];

  const fetchData = async () => {
    try {
      let url = `${API}/cash-book?`;
      if (filters.fromDate) url += `from_date=${filters.fromDate}&`;
      if (filters.toDate) url += `to_date=${filters.toDate}&`;
      
      const [entriesRes, bepaarisRes, dukandarsRes, advRes, capRes] = await Promise.all([
        axios.get(url), axios.get(`${API}/bepaaris`), axios.get(`${API}/dukandars`),
        axios.get(`${API}/advance-parties`), axios.get(`${API}/capital-partners`)
      ]);
      setAllEntries(entriesRes.data);
      setEntries(entriesRes.data);
      setParties([
        ...bepaarisRes.data.map(p => ({ ...p, ptype: "BEPAARI" })),
        ...dukandarsRes.data.map(p => ({ ...p, ptype: "DUKANDAR" })),
        ...advRes.data.map(p => ({ ...p, ptype: "ADVANCE" })),
        ...capRes.data.map(p => ({ ...p, ptype: p.partner_type }))
      ]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const applyFilters = () => { fetchData(); };

  const filteredParties = parties.filter(p => {
    if (form.type === "BEPAARI") return p.ptype === "BEPAARI";
    if (form.type === "DUKANDAR") return p.ptype === "DUKANDAR";
    if (form.type === "ADVANCE") return p.ptype === "ADVANCE";
    if (["CAPITAL", "LOAN", "AMANAT"].includes(form.type)) return p.ptype === form.type;
    return false;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await axios.post(`${API}/cash-book`, { 
      ...form, 
      amount: parseFloat(form.amount),
      bf_disc: form.bf_disc ? parseFloat(form.bf_disc) : 0
    });
    setForm({ ...form, type: "", sub_type: "", party_id: "", amount: "", bf_disc: "", particulars: "" });
    fetchData();
  };

  const handleDelete = async (id) => { if (window.confirm("Delete?")) { await axios.delete(`${API}/cash-book/${id}`); fetchData(); } };

  const handleEdit = (entry) => {
    setEditItem(entry);
    setEditForm({
      date: entry.date,
      type: entry.type,
      sub_type: entry.sub_type,
      party_id: entry.party_id || "",
      amount: entry.amount,
      bf_disc: entry.bf_disc || 0,
      mode: entry.mode,
      particulars: entry.particulars || ""
    });
  };

  const handleEditSave = async () => {
    await axios.put(`${API}/cash-book/${editItem.id}`, {
      ...editForm,
      amount: parseFloat(editForm.amount),
      bf_disc: editForm.bf_disc ? parseFloat(editForm.bf_disc) : 0
    });
    setEditItem(null);
    fetchData();
  };

  // Client-side filtering based on column filters
  const filteredEntries = allEntries.filter(e => {
    if (filters.type && e.type !== filters.type) return false;
    if (filters.subType && e.sub_type !== filters.subType) return false;
    if (filters.party && e.party_name !== filters.party) return false;
    if (filters.mode && e.mode !== filters.mode) return false;
    return true;
  });

  // Sorting
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    if (sortBy === "date-desc") return b.date.localeCompare(a.date);
    if (sortBy === "date-asc") return a.date.localeCompare(b.date);
    if (sortBy === "type-asc") return (a.type || "").localeCompare(b.type || "");
    if (sortBy === "type-desc") return (b.type || "").localeCompare(a.type || "");
    if (sortBy === "subtype-asc") return (a.sub_type || "").localeCompare(b.sub_type || "");
    if (sortBy === "subtype-desc") return (b.sub_type || "").localeCompare(a.sub_type || "");
    if (sortBy === "party-asc") return (a.party_name || "").localeCompare(b.party_name || "");
    if (sortBy === "party-desc") return (b.party_name || "").localeCompare(a.party_name || "");
    if (sortBy === "amount-desc") return b.amount - a.amount;
    if (sortBy === "amount-asc") return a.amount - b.amount;
    if (sortBy === "mode-asc") return (a.mode || "").localeCompare(b.mode || "");
    if (sortBy === "mode-desc") return (b.mode || "").localeCompare(a.mode || "");
    return 0;
  });

  // Get unique values for dropdown filters
  const uniqueParties = [...new Set(allEntries.map(e => e.party_name).filter(Boolean))].sort();
  const uniqueSubTypes = [...new Set(allEntries.map(e => e.sub_type).filter(Boolean))].sort();

  // Calculate filtered total
  const filteredTotal = sortedEntries.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Show BF_Disc field only for DUKANDAR RECEIPT
  const showBfDisc = form.type === "DUKANDAR" && form.sub_type === "RECEIPT";

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <h2>Cash & Bank</h2>
      
      <form className="entry-form" onSubmit={handleSubmit}>
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, sub_type: "", party_id: "", bf_disc: "" })} required>
          <option value="">Type</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={form.sub_type} onChange={(e) => setForm({ ...form, sub_type: e.target.value, bf_disc: "" })} required disabled={!form.type}>
          <option value="">Sub-Type</option>
          {(subTypes[form.type] || []).map((st) => <option key={st} value={st}>{st}</option>)}
        </select>
        <select value={form.party_id} onChange={(e) => setForm({ ...form, party_id: e.target.value })}>
          <option value="">Party</option>
          {filteredParties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="number" placeholder="Amount (Full Payable)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        {showBfDisc && (
          <input 
            type="number" 
            placeholder="BF Disc (if any)" 
            value={form.bf_disc} 
            onChange={(e) => setForm({ ...form, bf_disc: e.target.value })} 
            className="bf-disc-input"
            style={{maxWidth: '120px'}}
          />
        )}
        <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} required>
          {["CASH", "BANK", "UPI", "TRANSFER"].map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="text" placeholder="Comments (UPI ref, etc.)" value={form.particulars || ""} onChange={(e) => setForm({ ...form, particulars: e.target.value })} style={{minWidth: '180px'}} />
        <button type="submit" className="btn-primary">Add</button>
      </form>
      
      {showBfDisc && form.amount && (
        <div className="cash-calc-hint">
          Actual Cash Received: <strong>{formatCurrency(parseFloat(form.amount || 0) - parseFloat(form.bf_disc || 0))}</strong>
        </div>
      )}

      <div className="filter-bar">
        <label>From:</label><input type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} />
        <label>To:</label><input type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} />
        <button className="btn-primary" onClick={applyFilters}>Search</button>
        <button className="btn-clear" onClick={() => { setFilters({ fromDate: "", toDate: "", type: "", subType: "", party: "", mode: "" }); fetchData(); }}>Clear All</button>
      </div>

      {(filters.type || filters.subType || filters.party || filters.mode) && (
        <div className="filter-summary">
          <strong>Filters:</strong> 
          {filters.type && <span className="filter-tag">{filters.type} <button onClick={() => setFilters({...filters, type: ""})}>×</button></span>}
          {filters.subType && <span className="filter-tag">{filters.subType} <button onClick={() => setFilters({...filters, subType: ""})}>×</button></span>}
          {filters.party && <span className="filter-tag">{filters.party} <button onClick={() => setFilters({...filters, party: ""})}>×</button></span>}
          {filters.mode && <span className="filter-tag">{filters.mode} <button onClick={() => setFilters({...filters, mode: ""})}>×</button></span>}
          <span className="filter-result">| Showing {sortedEntries.length} entries | Total: <strong>{formatCurrency(filteredTotal)}</strong></span>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>
                <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className="header-filter">
                  <option value="">Type ▼</option>
                  {types.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </th>
              <th>
                <select value={filters.subType} onChange={(e) => setFilters({ ...filters, subType: e.target.value })} className="header-filter">
                  <option value="">Sub-Type ▼</option>
                  {uniqueSubTypes.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </th>
              <th>
                <select value={filters.party} onChange={(e) => setFilters({ ...filters, party: e.target.value })} className="header-filter">
                  <option value="">Party ▼</option>
                  {uniqueParties.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </th>
              <th>Amount</th>
              <th>BF Disc</th>
              <th>
                <select value={filters.mode} onChange={(e) => setFilters({ ...filters, mode: e.target.value })} className="header-filter">
                  <option value="">Mode ▼</option>
                  {modes.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </th>
              <th>Comments</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map((e) => (
              <tr key={e.id}>
                <td>{e.date}</td><td>{e.type}</td><td>{e.sub_type}</td><td>{e.party_name || "-"}</td>
                <td>{formatCurrency(e.amount)}</td>
                <td className="bf-disc-col">{e.bf_disc > 0 ? formatCurrency(e.bf_disc) : "-"}</td>
                <td>{e.mode}</td><td className="comments-col">{e.particulars || "-"}</td>
                <td>
                  <button className="btn-edit" onClick={() => handleEdit(e)}>Edit</button>
                  <button className="btn-delete" onClick={() => handleDelete(e.id)}>X</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editItem && (
        <div className="modal-overlay" onClick={() => setEditItem(null)}>
          <div className="modal-content" onClick={(ev) => ev.stopPropagation()}>
            <h3>Edit Cash & Bank Entry</h3>
            <div className="edit-form">
              <label>Date:<input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} /></label>
              <label>Amount:<input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} /></label>
              {editForm.type === "DUKANDAR" && editForm.sub_type === "RECEIPT" && (
                <label>BF Disc:<input type="number" value={editForm.bf_disc} onChange={(e) => setEditForm({ ...editForm, bf_disc: e.target.value })} /></label>
              )}
              <label>Mode:
                <select value={editForm.mode} onChange={(e) => setEditForm({ ...editForm, mode: e.target.value })}>
                  {["CASH", "BANK", "UPI", "TRANSFER"].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label>Comments:<input type="text" value={editForm.particulars} onChange={(e) => setEditForm({ ...editForm, particulars: e.target.value })} /></label>
            </div>
            <div className="modal-actions">
              <button className="btn-clear" onClick={() => setEditItem(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleEditSave}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============== ADJUSTMENTS / JOURNAL VOUCHER ==============
const Adjustments = () => {
  const [adjustments, setAdjustments] = useState([]);
  const [bepaaris, setBeparis] = useState([]);
  const [dukandars, setDukandars] = useState([]);
  const [advanceParties, setAdvanceParties] = useState([]);
  const [capitalPartners, setCapitalPartners] = useState([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    debit_type: "",
    debit_party_id: "",
    credit_type: "",
    credit_party_id: "",
    amount: "",
    narration: ""
  });
  const [sortBy, setSortBy] = useState("date-desc");
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [adjRes, bepaariRes, dukandarRes, advRes, capRes] = await Promise.all([
        axios.get(`${API}/adjustments`),
        axios.get(`${API}/bepaaris`),
        axios.get(`${API}/dukandars`),
        axios.get(`${API}/advance-parties`),
        axios.get(`${API}/capital-partners`)
      ]);
      setAdjustments(adjRes.data);
      setBeparis(bepaariRes.data);
      setDukandars(dukandarRes.data);
      setAdvanceParties(advRes.data);
      setCapitalPartners(capRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const getParties = (type) => {
    if (type === "BEPAARI") return bepaaris;
    if (type === "DUKANDAR") return dukandars;
    if (type === "ADVANCE") return advanceParties;
    if (type === "CAPITAL") return capitalPartners.filter(p => p.partner_type === "CAPITAL");
    if (type === "LOAN") return capitalPartners.filter(p => p.partner_type === "LOAN");
    if (type === "AMANAT") return capitalPartners.filter(p => p.partner_type === "AMANAT");
    if (type === "MANDI_EXPENSE" || type === "BF_DISCOUNT") return []; // No party needed
    return [];
  };

  const isExpenseHead = (type) => type === "MANDI_EXPENSE" || type === "BF_DISCOUNT";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.debit_type || !form.credit_type) {
      alert("Please select both Debit and Credit types");
      return;
    }
    if (!isExpenseHead(form.debit_type) && !form.debit_party_id) {
      alert("Please select a Debit party");
      return;
    }
    if (!isExpenseHead(form.credit_type) && !form.credit_party_id) {
      alert("Please select a Credit party");
      return;
    }
    await axios.post(`${API}/adjustments`, {
      ...form,
      amount: parseFloat(form.amount),
      debit_party_id: isExpenseHead(form.debit_type) ? `__${form.debit_type}__` : form.debit_party_id,
      credit_party_id: isExpenseHead(form.credit_type) ? `__${form.credit_type}__` : form.credit_party_id
    });
    setForm({
      ...form,
      debit_type: "",
      debit_party_id: "",
      credit_type: "",
      credit_party_id: "",
      amount: "",
      narration: ""
    });
    fetchData();
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this adjustment?")) {
      await axios.delete(`${API}/adjustments/${id}`);
      fetchData();
    }
  };

  const handleEdit = (adj) => {
    setEditItem(adj);
    setEditForm({
      date: adj.date,
      amount: adj.amount,
      narration: adj.narration || ""
    });
  };

  const handleEditSave = async () => {
    await axios.put(`${API}/adjustments/${editItem.id}`, {
      ...editForm,
      amount: parseFloat(editForm.amount)
    });
    setEditItem(null);
    fetchData();
  };

  // Sorting
  const sortedAdjustments = [...adjustments].sort((a, b) => {
    if (sortBy === "date-desc") return b.date.localeCompare(a.date);
    if (sortBy === "date-asc") return a.date.localeCompare(b.date);
    if (sortBy === "amount-desc") return b.amount - a.amount;
    if (sortBy === "amount-asc") return a.amount - b.amount;
    return 0;
  });

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <h2>Adjustments / Journal Voucher</h2>
      <p className="hint">Record triangular settlements where one party pays another on your behalf (no cash moves through you)</p>

      <form className="entry-form adjustment-form" onSubmit={handleSubmit}>
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        
        <div className="jv-row">
          <div className="jv-section debit-section">
            <label>DEBIT</label>
            <select value={form.debit_type} onChange={(e) => setForm({ ...form, debit_type: e.target.value, debit_party_id: "" })} required>
              <option value="">Select Type</option>
              <optgroup label="Parties">
                <option value="DUKANDAR">Dukandar</option>
                <option value="ADVANCE">Advance Party</option>
                <option value="BEPAARI">Bepaari</option>
                <option value="CAPITAL">Capital</option>
                <option value="LOAN">Loan</option>
                <option value="AMANAT">Amanat</option>
              </optgroup>
              <optgroup label="Expense Heads (Write-off)">
                <option value="MANDI_EXPENSE">Mandi Expense</option>
                <option value="BF_DISCOUNT">BF Discount</option>
              </optgroup>
            </select>
            {!isExpenseHead(form.debit_type) && (
              <select value={form.debit_party_id} onChange={(e) => setForm({ ...form, debit_party_id: e.target.value })} required={!isExpenseHead(form.debit_type)} disabled={!form.debit_type}>
                <option value="">Select Party</option>
                {getParties(form.debit_type).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>

          <div className="jv-section credit-section">
            <label>CREDIT</label>
            <select value={form.credit_type} onChange={(e) => setForm({ ...form, credit_type: e.target.value, credit_party_id: "" })} required>
              <option value="">Select Type</option>
              <optgroup label="Parties">
                <option value="BEPAARI">Bepaari</option>
                <option value="DUKANDAR">Dukandar</option>
                <option value="ADVANCE">Advance Party</option>
                <option value="CAPITAL">Capital</option>
                <option value="LOAN">Loan</option>
                <option value="AMANAT">Amanat</option>
              </optgroup>
              <optgroup label="Expense Heads (Write-off)">
                <option value="MANDI_EXPENSE">Mandi Expense</option>
                <option value="BF_DISCOUNT">BF Discount</option>
              </optgroup>
            </select>
            {!isExpenseHead(form.credit_type) && (
              <select value={form.credit_party_id} onChange={(e) => setForm({ ...form, credit_party_id: e.target.value })} required={!isExpenseHead(form.credit_type)} disabled={!form.credit_type}>
                <option value="">Select Party</option>
                {getParties(form.credit_type).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
        </div>

        <input type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required min="1" />
        <input type="text" placeholder="Narration (e.g., Jagdish paid Bepaari directly)" value={form.narration} onChange={(e) => setForm({ ...form, narration: e.target.value })} style={{minWidth: '300px'}} />
        <button type="submit" className="btn-primary">Add Adjustment</button>
      </form>

      <div className="filter-bar">
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
          <option value="date-desc">Date (Newest)</option>
          <option value="date-asc">Date (Oldest)</option>
          <option value="amount-desc">Amount (High-Low)</option>
          <option value="amount-asc">Amount (Low-High)</option>
        </select>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Debit (Who Paid)</th>
              <th>Credit (Who Received)</th>
              <th>Amount</th>
              <th>Narration</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedAdjustments.map((a) => (
              <tr key={a.id}>
                <td>{a.date}</td>
                <td><span className="badge debit">{a.debit_type}</span> {a.debit_party_name}</td>
                <td><span className="badge credit">{a.credit_type}</span> {a.credit_party_name}</td>
                <td>{formatCurrency(a.amount)}</td>
                <td>{a.narration || "-"}</td>
                <td>
                  <button className="btn-edit" onClick={() => handleEdit(a)}>Edit</button>
                  <button className="btn-delete" onClick={() => handleDelete(a.id)}>X</button>
                </td>
              </tr>
            ))}
            {adjustments.length === 0 && (
              <tr><td colSpan="6" style={{textAlign: 'center', color: '#888'}}>No adjustments recorded yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editItem && (
        <div className="modal-overlay" onClick={() => setEditItem(null)}>
          <div className="modal-content" onClick={(ev) => ev.stopPropagation()}>
            <h3>Edit Adjustment</h3>
            <div className="edit-form">
              <label>Date:<input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} /></label>
              <label>Amount:<input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} /></label>
              <label>Narration:<input type="text" value={editForm.narration} onChange={(e) => setEditForm({ ...editForm, narration: e.target.value })} /></label>
            </div>
            <div className="modal-actions">
              <button className="btn-clear" onClick={() => setEditItem(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleEditSave}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============== BALANCE TRANSFER ==============
const BalanceTransfer = () => {
  const [bepaaris, setBeparis] = useState([]);
  const [dukandars, setDukandars] = useState([]);
  const [advanceParties, setAdvanceParties] = useState([]);
  const [cashBookEntries, setCashBookEntries] = useState([]);
  const [form, setForm] = useState({
    from_type: "DUKANDAR",
    from_party_id: "",
    to_type: "DUKANDAR",
    to_party_id: "",
    to_party_name: "",
    amount: "",
    narration: "",
    create_new: false
  });
  const [selectedEntries, setSelectedEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const fetchData = async () => {
    try {
      const [bRes, dRes, aRes] = await Promise.all([
        axios.get(`${API}/bepaaris`),
        axios.get(`${API}/dukandars`),
        axios.get(`${API}/advance-parties`)
      ]);
      setBeparis(bRes.data);
      setDukandars(dRes.data);
      setAdvanceParties(aRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // Fetch cash book entries when source party changes
  useEffect(() => {
    if (form.from_party_id) {
      axios.get(`${API}/cash-book`).then(res => {
        const filtered = res.data.filter(e => e.party_id === form.from_party_id);
        setCashBookEntries(filtered);
      });
    } else {
      setCashBookEntries([]);
    }
    setSelectedEntries([]);
  }, [form.from_party_id]);

  const getParties = (type) => {
    if (type === "BEPAARI") return bepaaris;
    if (type === "DUKANDAR") return dukandars;
    if (type === "ADVANCE") return advanceParties;
    return [];
  };

  const getSourcePartyBalance = () => {
    const parties = getParties(form.from_type);
    const party = parties.find(p => p.id === form.from_party_id);
    return party?.opening_balance || 0;
  };

  const handleTransfer = async () => {
    if (!form.from_party_id || !form.amount) {
      alert("Please select source party and enter amount");
      return;
    }
    if (!form.create_new && !form.to_party_id) {
      alert("Please select destination party or check 'Create New'");
      return;
    }
    if (form.create_new && !form.to_party_name) {
      alert("Please enter name for new party");
      return;
    }

    try {
      // Step 1: Transfer balance
      const transferRes = await axios.post(`${API}/balance-transfer`, {
        from_type: form.from_type,
        from_party_id: form.from_party_id,
        to_type: form.to_type,
        to_party_id: form.create_new ? null : form.to_party_id,
        to_party_name: form.create_new ? form.to_party_name : null,
        amount: parseFloat(form.amount),
        date: new Date().toISOString().split('T')[0],
        narration: form.narration
      });

      // Step 2: Reassign selected cash book entries
      if (selectedEntries.length > 0) {
        await axios.put(`${API}/cash-book/reassign`, {
          entry_ids: selectedEntries,
          new_party_id: transferRes.data.new_to_party_id || form.to_party_id,
          new_party_type: form.to_type
        });
      }

      setMessage(`✅ Transferred ₹${formatCurrency(form.amount)} from ${transferRes.data.from_party} to ${transferRes.data.to_party}. ${selectedEntries.length > 0 ? `Also moved ${selectedEntries.length} cash book entries.` : ''}`);
      
      // Reset form
      setForm({ ...form, from_party_id: "", to_party_id: "", to_party_name: "", amount: "", narration: "", create_new: false });
      setSelectedEntries([]);
      fetchData();
    } catch (err) {
      alert("Error: " + (err.response?.data?.detail || err.message));
    }
  };

  const toggleEntry = (id) => {
    setSelectedEntries(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <h2>Balance Transfer</h2>
      <p className="hint">Transfer opening balance from one party to another. Use this to correct party splits or move balances to new parties.</p>

      {message && <div className="success-message">{message}</div>}

      <div className="transfer-container">
        <div className="transfer-section from-section">
          <h3>FROM (Source Party)</h3>
          <select value={form.from_type} onChange={(e) => setForm({ ...form, from_type: e.target.value, from_party_id: "" })}>
            <option value="DUKANDAR">Dukandar</option>
            <option value="BEPAARI">Bepaari</option>
            <option value="ADVANCE">Advance Party</option>
          </select>
          <select value={form.from_party_id} onChange={(e) => setForm({ ...form, from_party_id: e.target.value })}>
            <option value="">Select Party</option>
            {getParties(form.from_type).map(p => (
              <option key={p.id} value={p.id}>{p.name} (₹{p.opening_balance?.toLocaleString() || 0})</option>
            ))}
          </select>
          {form.from_party_id && (
            <div className="balance-info">Current Opening Balance: <strong>₹{getSourcePartyBalance().toLocaleString()}</strong></div>
          )}
        </div>

        <div className="transfer-arrow">→</div>

        <div className="transfer-section to-section">
          <h3>TO (Destination Party)</h3>
          <select value={form.to_type} onChange={(e) => setForm({ ...form, to_type: e.target.value, to_party_id: "" })}>
            <option value="DUKANDAR">Dukandar</option>
            <option value="BEPAARI">Bepaari</option>
            <option value="ADVANCE">Advance Party</option>
          </select>
          
          <label className="checkbox-label">
            <input type="checkbox" checked={form.create_new} onChange={(e) => setForm({ ...form, create_new: e.target.checked, to_party_id: "" })} />
            Create New Party
          </label>

          {form.create_new ? (
            <input type="text" placeholder="New Party Name" value={form.to_party_name} onChange={(e) => setForm({ ...form, to_party_name: e.target.value })} />
          ) : (
            <select value={form.to_party_id} onChange={(e) => setForm({ ...form, to_party_id: e.target.value })}>
              <option value="">Select Existing Party</option>
              {getParties(form.to_type).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="amount-section">
        <label>Amount to Transfer:</label>
        <input type="number" placeholder="Enter amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="amount-input" />
      </div>

      <div className="narration-section">
        <label>Comment / Narration (Optional):</label>
        <input type="text" placeholder="Brief description of transfer" value={form.narration} onChange={(e) => setForm({ ...form, narration: e.target.value })} className="narration-input" />
      </div>

      {cashBookEntries.length > 0 && (
        <div className="entries-section">
          <h3>Also Move These Cash & Bank Entries? (Optional)</h3>
          <p className="hint">Select entries that should be reassigned to the destination party</p>
          <div className="entries-list">
            {cashBookEntries.map(e => (
              <label key={e.id} className="entry-checkbox">
                <input type="checkbox" checked={selectedEntries.includes(e.id)} onChange={() => toggleEntry(e.id)} />
                <span>{e.date} | {e.sub_type} | ₹{e.amount.toLocaleString()} | {e.mode}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <button className="btn-primary btn-transfer" onClick={handleTransfer}>Transfer Balance</button>
    </div>
  );
};

// ============== PARTY STATEMENT (NEW!) ==============
const PartyStatement = () => {
  const [bepaaris, setBeparis] = useState([]);
  const [dukandars, setDukandars] = useState([]);
  const [partyType, setPartyType] = useState("bepaari");
  const [partyId, setPartyId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([axios.get(`${API}/bepaaris`), axios.get(`${API}/dukandars`)]).then(([b, d]) => {
      setBeparis(b.data);
      setDukandars(d.data);
    });
  }, []);

  const fetchStatement = async () => {
    if (!partyId) { alert("Please select a party"); return; }
    setLoading(true);
    let url = `${API}/party-statement/${partyType}/${partyId}?`;
    if (fromDate) url += `from_date=${fromDate}&`;
    if (toDate) url += `to_date=${toDate}&`;
    const res = await axios.get(url);
    setStatement(res.data);
    setLoading(false);
  };

  const downloadExcel = () => {
    let url = `${API}/export/party-statement/${partyType}/${partyId}?`;
    if (fromDate) url += `from_date=${fromDate}&`;
    if (toDate) url += `to_date=${toDate}&`;
    window.open(url, '_blank');
  };

  // Build ledger entries with running balance
  const buildLedgerEntries = () => {
    if (!statement) return [];
    
    const entries = [];
    const isBepari = partyType === "bepaari";
    
    if (isBepari) {
      // BEPAARI LEDGER: Group sales by date, show NET amount only (like Aakda)
      // NET = Gross Sales - Commission - JB - KK - Motor - Bhussa - Gawali - CashAdv
      // DON'T show Dukandar names or individual expenses
      
      // Group sales by date
      const salesByDate = {};
      statement.sales.forEach(s => {
        if (!salesByDate[s.date]) {
          salesByDate[s.date] = { qty: 0, gross: 0 };
        }
        salesByDate[s.date].qty += s.quantity;
        salesByDate[s.date].gross += s.gross_amount;
      });
      
      // Group expenses by date
      const expensesByDate = {};
      statement.cash_entries.forEach(c => {
        if (c.sub_type !== "PAYMENT") {
          // This is an expense (MOTOR, BHUSSA, GAWALI, CASH_ADV)
          if (!expensesByDate[c.date]) {
            expensesByDate[c.date] = 0;
          }
          expensesByDate[c.date] += c.amount;
        }
      });
      
      // Calculate commission, JB, KK per day (approximate based on qty)
      // We'll get this from the Aakda-style calculation
      const settings = { commission_rate: 4, jb_rate: 10, kk_fixed: 100 };
      
      // Add NET sales entries per date
      Object.keys(salesByDate).sort().forEach(date => {
        const s = salesByDate[date];
        const commission = s.gross * (settings.commission_rate / 100);
        const jb = s.qty * settings.jb_rate;
        const kk = settings.kk_fixed; // Per market day
        const otherExpenses = expensesByDate[date] || 0;
        const netAmount = s.gross - commission - jb - kk - otherExpenses;
        
        entries.push({
          date: date,
          description: `Sales (${s.qty} pcs) - Net after deductions`,
          debit: 0,
          credit: netAmount,
          type: 'sale'
        });
      });
      
      // Add PAYMENT entries only (not other expenses - they're already deducted)
      statement.cash_entries.forEach(c => {
        if (c.sub_type === "PAYMENT") {
          entries.push({
            date: c.date,
            description: `Payment (${c.mode})`,
            debit: c.amount,
            credit: 0,
            type: 'cash'
          });
        }
      });
      
    } else {
      // DUKANDAR LEDGER: Show purchases, discounts, and receipts
      
      // Add sales/purchase entries
      statement.sales.forEach(s => {
        const purchaseAmt = s.dukandar_amount || s.gross_amount;
        entries.push({
          date: s.date,
          description: `Purchase from ${s.bepaari_name} (${s.quantity} pcs)${s.dukandar_rate ? ` @ ${formatCurrency(s.dukandar_rate)}` : ''}`,
          debit: purchaseAmt,
          credit: 0,
          type: 'sale'
        });
        // If there's a discount on this sale, show it as credit
        if (s.discount > 0) {
          entries.push({
            date: s.date,
            description: `Discount on above`,
            debit: 0,
            credit: s.discount,
            type: 'discount'
          });
        }
      });
      
      // Add receipt entries
      // Receipt amount = full settlement (includes bf_disc portion)
      // bf_disc is NOT a separate credit — it's just tracking how much of the receipt was a discount
      statement.cash_entries.forEach(c => {
        const desc = c.bf_disc > 0
          ? `${c.sub_type} (${c.mode}) [incl. BF Disc ${formatCurrency(c.bf_disc)}]`
          : `${c.sub_type} (${c.mode})`;
        entries.push({
          date: c.date,
          description: desc,
          debit: 0,
          credit: c.amount,
          type: 'cash'
        });
      });
    }
    
    // Add adjustments (for both)
    if (statement.adjustments) {
      const expenseHeads = ["MANDI_EXPENSE", "BF_DISCOUNT"];
      statement.adjustments.forEach(a => {
        const isExpenseWriteoff = expenseHeads.includes(a.debit_type) || expenseHeads.includes(a.credit_type);
        
        if (isBepari) {
          if (a.direction === "CREDIT" && isExpenseWriteoff) {
            // Expense write-off CREDIT to Bepaari = increases our payable (extra payment)
            entries.push({
              date: a.date,
              description: `Write-off: ${a.debit_party_name} (${a.narration || 'Expense adjustment'})`,
              debit: 0,
              credit: a.amount,
              type: 'adjustment'
            });
          } else {
            // Party-to-party: CREDIT = someone paid them (reduces payable) -> Debit in running bal
            // DEBIT = they paid someone -> Credit in running bal
            entries.push({
              date: a.date,
              description: `JV: ${a.effect}`,
              debit: a.direction === "CREDIT" ? a.amount : 0,  // CREDIT from party = reduces payable = debit col
              credit: a.direction === "DEBIT" ? a.amount : 0,
              type: 'adjustment'
            });
          }
        } else {
          if (a.direction === "CREDIT" && isExpenseWriteoff) {
            // Expense write-off CREDIT to Dukandar = reduces receivable
            entries.push({
              date: a.date,
              description: `Write-off: ${a.debit_party_name} (${a.narration || 'Expense adjustment'})`,
              debit: 0,
              credit: a.amount,
              type: 'adjustment'
            });
          } else {
            // Dukandar: DEBIT = they paid someone (reduces debt) -> Credit in ledger
            // CREDIT from party = increases debt -> Debit in ledger
            entries.push({
              date: a.date,
              description: `JV: ${a.effect}`,
              debit: a.direction === "CREDIT" ? a.amount : 0,
              credit: a.direction === "DEBIT" ? a.amount : 0,
              type: 'adjustment'
            });
          }
        }
      });
    }
    
    // Add balance transfers as informational rows (NOT affecting running balance)
    // Balance transfers already modify opening_balance directly in the DB
    if (statement.balance_transfers) {
      statement.balance_transfers.forEach(t => {
        entries.push({
          date: t.date,
          description: `Transfer: ${t.effect}`,
          debit: 0,
          credit: 0,
          type: 'transfer',
          infoOnly: true,
          transferAmount: t.amount,
          transferDirection: t.direction
        });
      });
    }
    
    // Sort by date
    entries.sort((a, b) => a.date.localeCompare(b.date));
    
    // Calculate running balance
    let balance = statement.summary.opening_balance || 0;
    entries.forEach(e => {
      if (isBepari) {
        // Bepaari: Credits increase payable, Debits reduce it
        balance = balance + e.credit - e.debit;
      } else {
        // Dukandar: Debits increase receivable, Credits reduce it
        balance = balance + e.debit - e.credit;
      }
      e.balance = balance;
    });
    
    return entries;
  };

  const ledgerEntries = statement ? buildLedgerEntries() : [];
  const totalDebit = ledgerEntries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = ledgerEntries.reduce((sum, e) => sum + e.credit, 0);
  const closingBalance = ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].balance : (statement?.summary?.opening_balance || 0);
  
  // Determine closing balance label
  const getClosingLabel = () => {
    if (!statement) return "";
    const name = statement.party.name;
    if (partyType === "bepaari") {
      return closingBalance >= 0 ? `To Pay ${name}` : `To Receive from ${name}`;
    } else {
      return closingBalance >= 0 ? `To Receive from ${name}` : `To Pay ${name}`;
    }
  };

  const handlePrint = () => {
    if (!statement) return;
    const printDate = new Date().toISOString().split('T')[0];
    const isBepari = partyType === "bepaari";
    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ledger - ${statement.party.name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
          h1 { text-align: center; color: #1a365d; margin-bottom: 5px; font-size: 18px; }
          .subtitle { text-align: center; color: #666; margin-bottom: 5px; }
          .period { text-align: center; color: #333; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 6px 8px; }
          th { background: #1a365d; color: white; text-align: center; }
          td { text-align: right; }
          td:first-child, td:nth-child(2) { text-align: left; }
          .total-row { background: #f0f0f0; font-weight: bold; }
          .opening-row { background: #e8f4f8; font-weight: bold; }
          .closing-row { background: #d4edda; font-weight: bold; }
          .print-footer { margin-top: 20px; text-align: center; font-size: 10px; color: #888; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <h1>LEDGER - ${statement.party.name}</h1>
        <p class="subtitle">Phone: ${statement.party.phone || 'N/A'}</p>
        <p class="period">Period: ${fromDate || 'Beginning'} to ${toDate || printDate}</p>
        <table>
          <thead>
            <tr>
              <th style="width:80px">Date</th>
              <th>Description</th>
              <th style="width:100px">${isBepari ? 'Debit (-)' : 'Debit (+)'}</th>
              <th style="width:100px">${isBepari ? 'Credit (+)' : 'Credit (-)'}</th>
              <th style="width:100px">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr class="opening-row">
              <td>-</td>
              <td>Opening Balance</td>
              <td>-</td>
              <td>-</td>
              <td>${(statement.summary.opening_balance || 0).toLocaleString('en-IN')}</td>
            </tr>
            ${ledgerEntries.map(e => `
              <tr${e.infoOnly ? ' style="color:#999;font-style:italic"' : ''}>
                <td>${e.date}</td>
                <td>${e.description}${e.infoOnly ? ` (${e.transferAmount.toLocaleString('en-IN')} — already in opening bal.)` : ''}</td>
                <td>${e.debit > 0 ? e.debit.toLocaleString('en-IN') : '-'}</td>
                <td>${e.credit > 0 ? e.credit.toLocaleString('en-IN') : '-'}</td>
                <td>${e.balance.toLocaleString('en-IN')}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="2">TOTAL</td>
              <td>${totalDebit.toLocaleString('en-IN')}</td>
              <td>${totalCredit.toLocaleString('en-IN')}</td>
              <td>-</td>
            </tr>
            <tr class="closing-row">
              <td colspan="4">${getClosingLabel()}</td>
              <td>${Math.abs(closingBalance).toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>
        <p class="print-footer">Generated from Mandi Accounting System on ${printDate}</p>
      </body>
      </html>
    `;
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const parties = partyType === "bepaari" ? bepaaris : dukandars;

  return (
    <div className="page">
      <h2>Party Statement / Ledger</h2>
      <p className="hint">Get complete transaction history with running balance. All entries in date sequence.</p>
      
      <div className="filter-bar">
        <select value={partyType} onChange={(e) => { setPartyType(e.target.value); setPartyId(""); setStatement(null); }}>
          <option value="bepaari">Bepaari</option>
          <option value="dukandar">Dukandar</option>
        </select>
        <select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
          <option value="">Select {partyType}</option>
          {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label>From:</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <label>To:</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <button className="btn-primary" onClick={fetchStatement}>Get Statement</button>
        {statement && <button className="btn-print" onClick={handlePrint}>🖨️ Print / Save PDF</button>}
        {statement && <button className="btn-excel" onClick={downloadExcel}>Download CSV</button>}
      </div>

      {loading && <div className="loading">Loading...</div>}

      {statement && (
        <div className="statement-container">
          <div className="party-info">
            <h3>{statement.party.name}</h3>
            <p>Phone: {statement.party.phone || "N/A"} | Period: {fromDate || "Beginning"} to {toDate || "Current"}</p>
          </div>

          <div className="ledger-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>{partyType === "bepaari" ? "Debit (-)" : "Debit (+)"}</th>
                  <th>{partyType === "bepaari" ? "Credit (+)" : "Credit (-)"}</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr className="opening-row">
                  <td>-</td>
                  <td><strong>Opening Balance</strong></td>
                  <td>-</td>
                  <td>-</td>
                  <td><strong>{formatCurrency(statement.summary.opening_balance || 0)}</strong></td>
                </tr>
                {ledgerEntries.map((e, i) => (
                  <tr key={i} className={e.type === 'sale' ? 'sale-row' : e.type === 'adjustment' ? 'adjustment-row' : e.type === 'transfer' ? 'transfer-info-row' : ''}>
                    <td>{e.date}</td>
                    <td>{e.description}{e.infoOnly && <span className="transfer-note"> ({formatCurrency(e.transferAmount)} — already in opening bal.)</span>}</td>
                    <td>{e.debit > 0 ? formatCurrency(e.debit) : "-"}</td>
                    <td>{e.credit > 0 ? formatCurrency(e.credit) : "-"}</td>
                    <td className={e.balance >= 0 ? "positive" : "negative"}>{formatCurrency(e.balance)}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td colSpan="2"><strong>TOTAL</strong></td>
                  <td><strong>{formatCurrency(totalDebit)}</strong></td>
                  <td><strong>{formatCurrency(totalCredit)}</strong></td>
                  <td>-</td>
                </tr>
                <tr className="closing-row">
                  <td colSpan="4"><strong>{getClosingLabel()}</strong></td>
                  <td><strong>{formatCurrency(Math.abs(closingBalance))}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ============== BEPAARI LEDGER ==============
const BepariLedger = () => {
  const [ledger, setLedger] = useState([]);
  const [asOnDate, setAsOnDate] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const url = asOnDate ? `${API}/bepaari-ledger?as_on_date=${asOnDate}` : `${API}/bepaari-ledger`;
    const res = await axios.get(url);
    setLedger(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [asOnDate]);

  if (loading) return <div className="loading">Loading...</div>;

  // Sorting
  const sortedLedger = [...ledger].filter(b => b.gross_sales > 0 || b.opening > 0 || b.balance !== 0).sort((a, b) => {
    if (sortBy === "name-asc") return a.name.localeCompare(b.name);
    if (sortBy === "name-desc") return b.name.localeCompare(a.name);
    if (sortBy === "balance-desc") return b.balance - a.balance;
    if (sortBy === "balance-asc") return a.balance - b.balance;
    return 0;
  });

  const totals = ledger.reduce((acc, b) => ({
    gross: acc.gross + b.gross_sales, qty: acc.qty + b.quantity, comm: acc.comm + b.commission,
    kk: acc.kk + b.kk, jb: acc.jb + b.jb, ded: acc.ded + b.total_deductions, 
    pay: acc.pay + b.payments, adj: acc.adj + (b.adjustments || 0), bal: acc.bal + b.balance
  }), { gross: 0, qty: 0, comm: 0, kk: 0, jb: 0, ded: 0, pay: 0, adj: 0, bal: 0 });

  return (
    <div className="page">
      <h2>Bepaari Ledger</h2>
      <div className="filter-bar">
        <label>As On Date:</label>
        <input type="date" value={asOnDate} onChange={(e) => setAsOnDate(e.target.value)} />
        {asOnDate && <button className="btn-clear" onClick={() => setAsOnDate("")}>Show Current</button>}
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
          <option value="name-asc">Name (A-Z)</option>
          <option value="name-desc">Name (Z-A)</option>
          <option value="balance-desc">Balance (High-Low)</option>
          <option value="balance-asc">Balance (Low-High)</option>
        </select>
      </div>
      <div className="table-container">
        <table>
          <thead><tr>
            <th className="sortable" onClick={() => setSortBy(sortBy === "name-asc" ? "name-desc" : "name-asc")}>Name {sortBy.startsWith("name") ? (sortBy === "name-asc" ? "↑" : "↓") : ""}</th>
            <th>Phone</th><th>Opening</th><th>Sales</th><th>Qty</th><th>Comm</th><th>KK</th><th>JB</th><th>Deductions</th><th>Payments</th><th>Adj</th>
            <th className="sortable" onClick={() => setSortBy(sortBy === "balance-desc" ? "balance-asc" : "balance-desc")}>Balance {sortBy.startsWith("balance") ? (sortBy === "balance-desc" ? "↓" : "↑") : ""}</th>
          </tr></thead>
          <tbody>
            {sortedLedger.map((b) => (
              <tr key={b.id}>
                <td><strong>{b.name}</strong></td><td>{b.phone || "-"}</td><td>{formatCurrency(b.opening)}</td><td>{formatCurrency(b.gross_sales)}</td>
                <td>{b.quantity}</td><td>{formatCurrency(b.commission)}</td><td>{formatCurrency(b.kk)}</td><td>{formatCurrency(b.jb)}</td>
                <td>{formatCurrency(b.total_deductions)}</td><td>{formatCurrency(b.payments)}</td>
                <td className="adjustment-col">{b.adjustments > 0 ? formatCurrency(b.adjustments) : "-"}</td>
                <td className={b.balance >= 0 ? "positive" : "negative"}>{formatCurrency(b.balance)}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td><strong>TOTAL</strong></td><td></td><td>-</td><td><strong>{formatCurrency(totals.gross)}</strong></td><td><strong>{totals.qty}</strong></td>
              <td><strong>{formatCurrency(totals.comm)}</strong></td><td><strong>{formatCurrency(totals.kk)}</strong></td><td><strong>{formatCurrency(totals.jb)}</strong></td>
              <td><strong>{formatCurrency(totals.ded)}</strong></td><td><strong>{formatCurrency(totals.pay)}</strong></td>
              <td><strong>{totals.adj > 0 ? formatCurrency(totals.adj) : "-"}</strong></td><td><strong>{formatCurrency(totals.bal)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============== DUKANDAR LEDGER ==============
const DukandarLedger = () => {
  const [ledger, setLedger] = useState([]);
  const [asOnDate, setAsOnDate] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const url = asOnDate ? `${API}/dukandar-ledger?as_on_date=${asOnDate}` : `${API}/dukandar-ledger`;
    const res = await axios.get(url);
    setLedger(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [asOnDate]);

  const handlePrint = () => {
    const printDate = asOnDate || new Date().toISOString().split('T')[0];
    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Patti - Dukandar Outstanding - ${printDate}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; color: #1a365d; margin-bottom: 5px; }
          .subtitle { text-align: center; color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 12px; }
          th { background: #1a365d; color: white; }
          td:first-child, th:first-child { text-align: left; }
          .total-row { background: #f0f0f0; font-weight: bold; }
          .positive { color: green; }
          .negative { color: red; }
          .print-footer { margin-top: 30px; text-align: center; font-size: 11px; color: #888; }
          @media print { 
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>PATTI - Dukandar Outstanding</h1>
        <p class="subtitle">As on: ${printDate}</p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Opening</th>
              <th>Purchases</th>
              <th>Discounts</th>
              <th>Receipts</th>
              <th>BF Disc</th>
              <th>Adj</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            ${sortedLedger.map(d => `
              <tr>
                <td><strong>${d.name}</strong></td>
                <td>${d.phone || '-'}</td>
                <td>${d.opening.toLocaleString('en-IN')}</td>
                <td>${d.purchases.toLocaleString('en-IN')}</td>
                <td>${d.discounts.toLocaleString('en-IN')}</td>
                <td>${d.receipts.toLocaleString('en-IN')}</td>
                <td>${d.bf_disc > 0 ? d.bf_disc.toLocaleString('en-IN') : '-'}</td>
                <td>${d.adjustments > 0 ? d.adjustments.toLocaleString('en-IN') : '-'}</td>
                <td class="${d.balance >= 0 ? 'positive' : 'negative'}">${d.balance.toLocaleString('en-IN')}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td><strong>TOTAL PATTI</strong></td>
              <td></td>
              <td>-</td>
              <td>${totals.purchases.toLocaleString('en-IN')}</td>
              <td>${totals.discounts.toLocaleString('en-IN')}</td>
              <td>${totals.receipts.toLocaleString('en-IN')}</td>
              <td>${totals.bf_disc > 0 ? totals.bf_disc.toLocaleString('en-IN') : '-'}</td>
              <td>${totals.adj > 0 ? totals.adj.toLocaleString('en-IN') : '-'}</td>
              <td><strong>${totals.balance.toLocaleString('en-IN')}</strong></td>
            </tr>
          </tbody>
        </table>
        <p class="print-footer">Generated from Mandi Accounting System</p>
      </body>
      </html>
    `;
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) return <div className="loading">Loading...</div>;

  // Sorting
  const sortedLedger = [...ledger].filter(d => d.purchases > 0 || d.opening > 0 || d.balance !== 0).sort((a, b) => {
    if (sortBy === "name-asc") return a.name.localeCompare(b.name);
    if (sortBy === "name-desc") return b.name.localeCompare(a.name);
    if (sortBy === "balance-desc") return b.balance - a.balance;
    if (sortBy === "balance-asc") return a.balance - b.balance;
    return 0;
  });

  const totals = ledger.reduce((acc, d) => ({
    purchases: acc.purchases + d.purchases, discounts: acc.discounts + d.discounts, 
    receipts: acc.receipts + d.receipts, bf_disc: acc.bf_disc + (d.bf_disc || 0), adj: acc.adj + (d.adjustments || 0), balance: acc.balance + d.balance
  }), { purchases: 0, discounts: 0, receipts: 0, bf_disc: 0, adj: 0, balance: 0 });

  return (
    <div className="page">
      <h2>Dukandar Ledger (Patti)</h2>
      <div className="filter-bar">
        <label>As On Date:</label>
        <input type="date" value={asOnDate} onChange={(e) => setAsOnDate(e.target.value)} />
        {asOnDate && <button className="btn-clear" onClick={() => setAsOnDate("")}>Show Current</button>}
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
          <option value="name-asc">Name (A-Z)</option>
          <option value="name-desc">Name (Z-A)</option>
          <option value="balance-desc">Balance (High-Low)</option>
          <option value="balance-asc">Balance (Low-High)</option>
        </select>
        <button className="btn-print" onClick={handlePrint}>🖨️ Print / Save PDF</button>
      </div>
      <div className="table-container">
        <table>
          <thead><tr>
            <th className="sortable" onClick={() => setSortBy(sortBy === "name-asc" ? "name-desc" : "name-asc")}>Name {sortBy.startsWith("name") ? (sortBy === "name-asc" ? "↑" : "↓") : ""}</th>
            <th>Phone</th><th>Opening</th><th>Purchases</th><th>Discounts</th><th>Net Recv</th><th>Receipts</th><th>BF Disc</th><th>Adj</th>
            <th className="sortable" onClick={() => setSortBy(sortBy === "balance-desc" ? "balance-asc" : "balance-desc")}>Balance {sortBy.startsWith("balance") ? (sortBy === "balance-desc" ? "↓" : "↑") : ""}</th>
          </tr></thead>
          <tbody>
            {sortedLedger.map((d) => (
              <tr key={d.id}>
                <td><strong>{d.name}</strong></td><td>{d.phone || "-"}</td><td>{formatCurrency(d.opening)}</td><td>{formatCurrency(d.purchases)}</td>
                <td>{formatCurrency(d.discounts)}</td><td>{formatCurrency(d.net_receivable)}</td><td>{formatCurrency(d.receipts)}</td>
                <td className="bf-disc-col">{d.bf_disc > 0 ? formatCurrency(d.bf_disc) : "-"}</td>
                <td className="adjustment-col">{d.adjustments > 0 ? formatCurrency(d.adjustments) : "-"}</td>
                <td className={d.balance >= 0 ? "positive" : "negative"}>{formatCurrency(d.balance)}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td><strong>TOTAL</strong></td><td></td><td>-</td><td><strong>{formatCurrency(totals.purchases)}</strong></td><td><strong>{formatCurrency(totals.discounts)}</strong></td>
              <td>-</td><td><strong>{formatCurrency(totals.receipts)}</strong></td>
              <td><strong>{totals.bf_disc > 0 ? formatCurrency(totals.bf_disc) : "-"}</strong></td>
              <td><strong>{totals.adj > 0 ? formatCurrency(totals.adj) : "-"}</strong></td><td><strong>{formatCurrency(totals.balance)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============== BALANCE SHEET ==============
const BalanceSheet = () => {
  const [data, setData] = useState(null);
  const [asOnDate, setAsOnDate] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const url = asOnDate ? `${API}/balance-sheet?as_on_date=${asOnDate}` : `${API}/balance-sheet`;
    const res = await axios.get(url);
    setData(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [asOnDate]);

  if (loading) return <div className="loading">Loading...</div>;

  const { liabilities: L, assets: A, difference } = data;

  return (
    <div className="page">
      <h2>Balance Sheet {data.as_on_date !== "Current" ? `(As on ${data.as_on_date})` : ""}</h2>
      
      <div className="filter-bar">
        <label>As On Date:</label>
        <input type="date" value={asOnDate} onChange={(e) => setAsOnDate(e.target.value)} />
        {asOnDate && <button className="btn-clear" onClick={() => setAsOnDate("")}>Show Current</button>}
      </div>

      <div className={`balance-status ${difference === 0 ? "tallied" : "not-tallied"}`}>
        {difference === 0 ? "BALANCE SHEET TALLIED" : `DIFFERENCE: ${formatCurrency(difference)}`}
      </div>
      
      <div className="bs-container">
        <div className="bs-section">
          <h3>LIABILITIES</h3>
          <table>
            <tbody>
              {/* Capital - Individual names */}
              {L.capital_list && L.capital_list.length > 0 ? (
                <>
                  <tr className="section-header"><td colSpan="2"><strong>Capital</strong></td></tr>
                  {L.capital_list.map((p, i) => (
                    <tr key={i} className="sub-item"><td>&nbsp;&nbsp;{p.name}</td><td>{formatCurrency(p.amount)}</td></tr>
                  ))}
                  {L.capital_list.length > 1 && <tr className="sub-total"><td>&nbsp;&nbsp;<em>Total Capital</em></td><td><em>{formatCurrency(L.capital)}</em></td></tr>}
                </>
              ) : (
                <tr><td>Capital</td><td>{formatCurrency(L.capital)}</td></tr>
              )}
              
              {/* Loans - Individual names */}
              {L.loans_list && L.loans_list.length > 0 ? (
                <>
                  <tr className="section-header"><td colSpan="2"><strong>Loans</strong></td></tr>
                  {L.loans_list.map((p, i) => (
                    <tr key={i} className="sub-item"><td>&nbsp;&nbsp;{p.name}</td><td>{formatCurrency(p.amount)}</td></tr>
                  ))}
                  {L.loans_list.length > 1 && <tr className="sub-total"><td>&nbsp;&nbsp;<em>Total Loans</em></td><td><em>{formatCurrency(L.loans)}</em></td></tr>}
                </>
              ) : L.loans > 0 ? (
                <tr><td>Loans</td><td>{formatCurrency(L.loans)}</td></tr>
              ) : null}
              
              {/* Amanat - Individual names */}
              {L.amanat_list && L.amanat_list.length > 0 ? (
                <>
                  <tr className="section-header"><td colSpan="2"><strong>Amanat</strong></td></tr>
                  {L.amanat_list.map((p, i) => (
                    <tr key={i} className="sub-item"><td>&nbsp;&nbsp;{p.name}</td><td>{formatCurrency(p.amount)}</td></tr>
                  ))}
                  {L.amanat_list.length > 1 && <tr className="sub-total"><td>&nbsp;&nbsp;<em>Total Amanat</em></td><td><em>{formatCurrency(L.amanat)}</em></td></tr>}
                </>
              ) : L.amanat > 0 ? (
                <tr><td>Amanat</td><td>{formatCurrency(L.amanat)}</td></tr>
              ) : null}
              
              <tr><td>Bepaari Payables</td><td>{formatCurrency(L.bepaari_payables)}</td></tr>
              {L.dukandar_advances > 0 && <tr><td>Dukandar Advances</td><td>{formatCurrency(L.dukandar_advances)}</td></tr>}
              <tr className="sub-item"><td>JB Total</td><td>{formatCurrency(L.jb.total)}</td></tr>
              <tr className="sub-item"><td>KK Total</td><td>{formatCurrency(L.kk.total)}</td></tr>
              <tr className="sub-item"><td>Commission Total</td><td>{formatCurrency(L.commission.total)}</td></tr>
              <tr className="sub-item" style={{fontSize:'11px',color:'#718096'}}><td>&nbsp;&nbsp;Gross Earned: {formatCurrency(L.commission.earned)}{L.commission.rate_diff > 0 ? ` + Rate Diff: ${formatCurrency(L.commission.rate_diff)}` : ''} − Discounts: {formatCurrency(L.commission.discounts)}</td><td></td></tr>
              {L.zakat > 0 && <tr><td>Zakat Payable</td><td>{formatCurrency(L.zakat)}</td></tr>}
              <tr className="total-row"><td><strong>TOTAL LIABILITIES</strong></td><td><strong>{formatCurrency(L.total)}</strong></td></tr>
            </tbody>
          </table>
        </div>
        <div className="bs-section">
          <h3>ASSETS</h3>
          <table>
            <tbody>
              <tr><td>Cash Balance</td><td>{formatCurrency(A.cash_balance)}</td></tr>
              <tr><td>Bank Balance</td><td>{formatCurrency(A.bank_balance)}</td></tr>
              <tr><td>Patti (Dukandar Receivable)</td><td>{formatCurrency(A.patti)}</td></tr>
              {A.bepaari_advances > 0 && <tr><td>Bepaari Advances</td><td>{formatCurrency(A.bepaari_advances)}</td></tr>}
              <tr className="sub-item"><td>Mandi Expenses</td><td>{formatCurrency(A.mandi_expenses.total)}</td></tr>
              <tr className="sub-item"><td>BF Discount</td><td>{formatCurrency(A.bf_discount.total)}</td></tr>
              <tr className="sub-item"><td>MHN Personal</td><td>{formatCurrency(A.mhn_personal.total)}</td></tr>
              {A.advance_receivables.map((adv, i) => <tr key={i}><td>{adv.name} Receivable</td><td>{formatCurrency(adv.amount)}</td></tr>)}
              <tr className="total-row"><td><strong>TOTAL ASSETS</strong></td><td><strong>{formatCurrency(A.total)}</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============== MASTERS ==============
const Masters = () => {
  const [bepaaris, setBeparis] = useState([]);
  const [dukandars, setDukandars] = useState([]);
  const [advParties, setAdvParties] = useState([]);
  const [capPartners, setCapPartners] = useState([]);
  const [settings, setSettings] = useState({});
  const [form, setForm] = useState({ name: "", opening_balance: "0", commission_percent: "4", partner_type: "CAPITAL", phone: "" });
  const [activeTab, setActiveTab] = useState("bepaaris");
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({});

  const fetchData = async () => {
    const [b, d, a, c, s] = await Promise.all([
      axios.get(`${API}/bepaaris`), axios.get(`${API}/dukandars`), axios.get(`${API}/advance-parties`),
      axios.get(`${API}/capital-partners`), axios.get(`${API}/settings`)
    ]);
    setBeparis(b.data); setDukandars(d.data); setAdvParties(a.data); setCapPartners(c.data); setSettings(s.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const endpoints = { bepaaris: "/bepaaris", dukandars: "/dukandars", advance: "/advance-parties", capital: "/capital-partners" };
    await axios.post(`${API}${endpoints[activeTab]}`, {
      name: form.name, opening_balance: parseFloat(form.opening_balance || 0),
      commission_percent: parseFloat(form.commission_percent || 4), partner_type: form.partner_type, phone: form.phone
    });
    setForm({ name: "", opening_balance: "0", commission_percent: "4", partner_type: "CAPITAL", phone: "" });
    fetchData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete?")) return;
    const endpoints = { bepaaris: "/bepaaris", dukandars: "/dukandars", advance: "/advance-parties", capital: "/capital-partners" };
    await axios.delete(`${API}${endpoints[activeTab]}/${id}`);
    fetchData();
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setEditForm({
      name: item.name || "",
      phone: item.phone || "",
      opening_balance: item.opening_balance || 0,
      commission_percent: item.commission_percent || 4,
      partner_type: item.partner_type || "CAPITAL"
    });
  };

  const handleEditSave = async () => {
    const endpoints = { bepaaris: "/bepaaris", dukandars: "/dukandars", advance: "/advance-parties", capital: "/capital-partners" };
    const updates = { name: editForm.name };
    
    if (activeTab === "bepaaris" || activeTab === "dukandars") {
      updates.phone = editForm.phone;
    }
    if (activeTab === "bepaaris") {
      updates.commission_percent = parseFloat(editForm.commission_percent);
    }
    updates.opening_balance = parseFloat(editForm.opening_balance);
    
    await axios.put(`${API}${endpoints[activeTab]}/${editItem.id}`, updates);
    setEditItem(null);
    fetchData();
  };

  const handleSettingsUpdate = async () => {
    await axios.put(`${API}/settings`, settings);
    alert("Settings saved!");
  };

  if (loading) return <div className="loading">Loading...</div>;

  const getActiveData = () => {
    switch (activeTab) {
      case "bepaaris": return bepaaris;
      case "dukandars": return dukandars;
      case "advance": return advParties;
      case "capital": return capPartners;
      default: return [];
    }
  };

  return (
    <div className="page">
      <h2>Masters & Settings</h2>
      
      <div className="tabs">
        {["bepaaris", "dukandars", "advance", "capital", "settings"].map((tab) => (
          <button key={tab} className={`tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === "settings" ? (
        <div className="settings-form">
          <h3>System Settings</h3>
          <div className="settings-grid">
            <label>Commission %<input type="number" value={settings.commission_rate || ""} onChange={(e) => setSettings({ ...settings, commission_rate: parseFloat(e.target.value) })} /></label>
            <label>KK Fixed<input type="number" value={settings.kk_fixed || ""} onChange={(e) => setSettings({ ...settings, kk_fixed: parseFloat(e.target.value) })} /></label>
            <label>JB Rate<input type="number" value={settings.jb_rate || ""} onChange={(e) => setSettings({ ...settings, jb_rate: parseFloat(e.target.value) })} /></label>
            <label>Opening Cash<input type="number" value={settings.opening_cash || ""} onChange={(e) => setSettings({ ...settings, opening_cash: parseFloat(e.target.value) })} /></label>
            <label>Opening Bank<input type="number" value={settings.opening_bank || ""} onChange={(e) => setSettings({ ...settings, opening_bank: parseFloat(e.target.value) })} /></label>
            <label>JB Opening<input type="number" value={settings.jb_opening || ""} onChange={(e) => setSettings({ ...settings, jb_opening: parseFloat(e.target.value) })} /></label>
            <label>KK Opening<input type="number" value={settings.kk_opening || ""} onChange={(e) => setSettings({ ...settings, kk_opening: parseFloat(e.target.value) })} /></label>
            <label>Commission Opening<input type="number" value={settings.commission_opening || ""} onChange={(e) => setSettings({ ...settings, commission_opening: parseFloat(e.target.value) })} /></label>
            <label>Zakat Opening<input type="number" value={settings.zakat_opening || ""} onChange={(e) => setSettings({ ...settings, zakat_opening: parseFloat(e.target.value) })} /></label>
          </div>
          <button className="btn-primary" onClick={handleSettingsUpdate}>Save Settings</button>
        </div>
      ) : (
        <>
          <form className="entry-form" onSubmit={handleAdd}>
            <input type="text" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input type="number" placeholder="Opening Balance" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} />
            {(activeTab === "bepaaris" || activeTab === "dukandars") && (
              <input type="text" placeholder="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            )}
            {activeTab === "bepaaris" && <input type="number" placeholder="Commission %" value={form.commission_percent} onChange={(e) => setForm({ ...form, commission_percent: e.target.value })} />}
            {activeTab === "capital" && (
              <select value={form.partner_type} onChange={(e) => setForm({ ...form, partner_type: e.target.value })}>
                <option value="CAPITAL">CAPITAL</option><option value="LOAN">LOAN</option><option value="AMANAT">AMANAT</option>
              </select>
            )}
            <button type="submit" className="btn-primary">Add</button>
          </form>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  {(activeTab === "bepaaris" || activeTab === "dukandars") && <th>Phone</th>}
                  <th>Opening Balance</th>
                  {activeTab === "bepaaris" && <th>Commission %</th>}
                  {activeTab === "capital" && <th>Type</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {getActiveData().map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    {(activeTab === "bepaaris" || activeTab === "dukandars") && <td>{item.phone || "-"}</td>}
                    <td>{formatCurrency(item.opening_balance)}</td>
                    {activeTab === "bepaaris" && <td>{item.commission_percent}%</td>}
                    {activeTab === "capital" && <td>{item.partner_type}</td>}
                    <td>
                      <button className="btn-edit" onClick={() => handleEdit(item)} data-testid={`edit-${item.id}`}>Edit</button>
                      <button className="btn-delete" onClick={() => handleDelete(item.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div className="modal-overlay" onClick={() => setEditItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit {activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(1, -1)}</h3>
            <div className="edit-form">
              <label>
                Name:
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </label>
              {(activeTab === "bepaaris" || activeTab === "dukandars") && (
                <label>
                  Phone:
                  <input type="text" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </label>
              )}
              <label>
                Opening Balance:
                <input type="number" value={editForm.opening_balance} onChange={(e) => setEditForm({ ...editForm, opening_balance: e.target.value })} />
              </label>
              {activeTab === "bepaaris" && (
                <label>
                  Commission %:
                  <input type="number" value={editForm.commission_percent} onChange={(e) => setEditForm({ ...editForm, commission_percent: e.target.value })} />
                </label>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn-clear" onClick={() => setEditItem(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleEditSave}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============== MAIN APP ==============
function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/daily-sales" element={<DailySales />} />
            <Route path="/cash-book" element={<CashBook />} />
            <Route path="/adjustments" element={<Adjustments />} />
            <Route path="/balance-transfer" element={<BalanceTransfer />} />
            <Route path="/bepaari-ledger" element={<BepariLedger />} />
            <Route path="/dukandar-ledger" element={<DukandarLedger />} />
            <Route path="/balance-sheet" element={<BalanceSheet />} />
            <Route path="/bepaari-aakda" element={<BepariAakda />} />
            <Route path="/party-statement" element={<PartyStatement />} />
            <Route path="/masters" element={<Masters />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
