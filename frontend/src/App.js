import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import axios from "axios";
import "./App.css";
import BepariAakda from "./BepariAakda";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
};

// ============== SIDEBAR ==============
const Sidebar = () => {
  const navItems = [
    { path: "/", label: "Dashboard", icon: "📊" },
    { path: "/daily-sales", label: "Daily Sales", icon: "🐐" },
    { path: "/cash-book", label: "Cash Book", icon: "💰" },
    { path: "/adjustments", label: "Adjustments (JV)", icon: "🔄" },
    { path: "/bepaari-ledger", label: "Bepaari Ledger", icon: "📒" },
    { path: "/dukandar-ledger", label: "Dukandar Ledger", icon: "📗" },
    { path: "/balance-sheet", label: "Balance Sheet", icon: "📑" },
    { path: "/bepaari-aakda", label: "Bepaari Aakda", icon: "🧾" },
    { path: "/party-statement", label: "Party Statement", icon: "📄" },
    { path: "/masters", label: "Masters", icon: "⚙️" },
  ];

  return (
    <aside className="sidebar" data-testid="sidebar">
      <div className="sidebar-header">
        <h1>Mandi</h1>
        <span>Accounting</span>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

// ============== DASHBOARD ==============
const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/balance-sheet`).then(res => setData(res.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page" data-testid="dashboard-page">
      <h2>Dashboard</h2>
      <div className="dashboard-grid">
        <div className="card green"><h3>Cash Balance</h3><p className="big-number">{formatCurrency(data?.assets?.cash_balance)}</p></div>
        <div className="card blue"><h3>Bank Balance</h3><p className="big-number">{formatCurrency(data?.assets?.bank_balance)}</p></div>
        <div className="card orange"><h3>Patti (Receivable)</h3><p className="big-number">{formatCurrency(data?.assets?.patti)}</p></div>
        <div className="card red"><h3>Bepaari Payable</h3><p className="big-number">{formatCurrency(data?.liabilities?.bepaari_payables)}</p></div>
        <div className={`card ${data?.difference === 0 ? "green" : "red"}`}><h3>Balance Sheet</h3><p className="big-number">{data?.difference === 0 ? "TALLIED" : `Diff: ${formatCurrency(data?.difference)}`}</p></div>
        <div className="card purple"><h3>Commission Earned</h3><p className="big-number">{formatCurrency(data?.liabilities?.commission?.total)}</p></div>
      </div>
    </div>
  );
};

// ============== DAILY SALES ==============
const DailySales = () => {
  const [sales, setSales] = useState([]);
  const [bepaaris, setBeparis] = useState([]);
  const [dukandars, setDukandars] = useState([]);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], bepaari_id: "", dukandar_id: "", quantity: "", rate: "", discount: "0" });
  const [filters, setFilters] = useState({ fromDate: "", toDate: "", bepaari_id: "", dukandar_id: "" });
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
    await axios.post(`${API}/daily-sales`, { ...form, quantity: parseInt(form.quantity), rate: parseFloat(form.rate), discount: parseFloat(form.discount || 0) });
    setForm({ ...form, bepaari_id: "", dukandar_id: "", quantity: "", rate: "", discount: "0" });
    fetchData();
  };

  const handleDelete = async (id) => { if (window.confirm("Delete?")) { await axios.delete(`${API}/daily-sales/${id}`); fetchData(); } };

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
        <input type="number" placeholder="Discount" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
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
          <thead><tr><th>Date</th><th>Bepaari</th><th>Dukandar</th><th>Qty</th><th>Rate</th><th>Gross</th><th>Disc</th><th>Net</th><th></th></tr></thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>{s.date}</td><td>{s.bepaari_name}</td><td>{s.dukandar_name}</td><td>{s.quantity}</td>
                <td>{formatCurrency(s.rate)}</td><td>{formatCurrency(s.gross_amount)}</td><td>{formatCurrency(s.discount)}</td><td>{formatCurrency(s.net_amount)}</td>
                <td><button className="btn-delete" onClick={() => handleDelete(s.id)}>X</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============== CASH BOOK ==============
const CashBook = () => {
  const [entries, setEntries] = useState([]);
  const [parties, setParties] = useState([]);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], type: "", sub_type: "", party_id: "", amount: "", mode: "CASH" });
  const [filters, setFilters] = useState({ fromDate: "", toDate: "", type: "" });
  const [loading, setLoading] = useState(true);

  const types = ["BEPAARI", "DUKANDAR", "CAPITAL", "LOAN", "AMANAT", "ADVANCE", "EXPENSE", "ZAKAT"];
  const subTypes = {
    BEPAARI: ["PAYMENT", "MOTOR", "BHUSSA", "GAWALI", "CASH_ADV"],
    DUKANDAR: ["RECEIPT", "BF_DISC"],
    CAPITAL: ["TAKEN", "REPAID", "WITHDRAWN"],
    LOAN: ["TAKEN", "REPAID"],
    AMANAT: ["TAKEN", "REPAID"],
    ADVANCE: ["GIVEN", "RECEIVED"],
    EXPENSE: ["MANDI", "TRAVEL", "FOOD", "SALARY", "MHN_PERSONAL", "JB_PAID", "MISC", "OTHER"],
    ZAKAT: ["PROVISION", "PAID"]
  };

  const fetchData = async () => {
    try {
      let url = `${API}/cash-book?`;
      if (filters.fromDate) url += `from_date=${filters.fromDate}&`;
      if (filters.toDate) url += `to_date=${filters.toDate}&`;
      if (filters.type) url += `type=${filters.type}&`;
      
      const [entriesRes, bepaarisRes, dukandarsRes, advRes, capRes] = await Promise.all([
        axios.get(url), axios.get(`${API}/bepaaris`), axios.get(`${API}/dukandars`),
        axios.get(`${API}/advance-parties`), axios.get(`${API}/capital-partners`)
      ]);
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

  useEffect(() => { fetchData(); }, [filters]);

  const filteredParties = parties.filter(p => {
    if (form.type === "BEPAARI") return p.ptype === "BEPAARI";
    if (form.type === "DUKANDAR") return p.ptype === "DUKANDAR";
    if (form.type === "ADVANCE") return p.ptype === "ADVANCE";
    if (["CAPITAL", "LOAN", "AMANAT"].includes(form.type)) return p.ptype === form.type;
    return false;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await axios.post(`${API}/cash-book`, { ...form, amount: parseFloat(form.amount) });
    setForm({ ...form, type: "", sub_type: "", party_id: "", amount: "" });
    fetchData();
  };

  const handleDelete = async (id) => { if (window.confirm("Delete?")) { await axios.delete(`${API}/cash-book/${id}`); fetchData(); } };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <h2>Cash Book</h2>
      
      <form className="entry-form" onSubmit={handleSubmit}>
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, sub_type: "", party_id: "" })} required>
          <option value="">Type</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={form.sub_type} onChange={(e) => setForm({ ...form, sub_type: e.target.value })} required disabled={!form.type}>
          <option value="">Sub-Type</option>
          {(subTypes[form.type] || []).map((st) => <option key={st} value={st}>{st}</option>)}
        </select>
        <select value={form.party_id} onChange={(e) => setForm({ ...form, party_id: e.target.value })}>
          <option value="">Party</option>
          {filteredParties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} required>
          {["CASH", "BANK", "UPI", "TRANSFER"].map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <button type="submit" className="btn-primary">Add</button>
      </form>

      <div className="filter-bar">
        <label>From:</label><input type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} />
        <label>To:</label><input type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} />
        <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
          <option value="">All Types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="btn-clear" onClick={() => setFilters({ fromDate: "", toDate: "", type: "" })}>Clear</button>
      </div>

      <div className="table-container">
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Sub-Type</th><th>Party</th><th>Amount</th><th>Mode</th><th></th></tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{e.date}</td><td>{e.type}</td><td>{e.sub_type}</td><td>{e.party_name || "-"}</td>
                <td>{formatCurrency(e.amount)}</td><td>{e.mode}</td>
                <td><button className="btn-delete" onClick={() => handleDelete(e.id)}>X</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============== ADJUSTMENTS / JOURNAL VOUCHER ==============
const Adjustments = () => {
  const [adjustments, setAdjustments] = useState([]);
  const [bepaaris, setBeparis] = useState([]);
  const [dukandars, setDukandars] = useState([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    debit_type: "",
    debit_party_id: "",
    credit_type: "",
    credit_party_id: "",
    amount: "",
    narration: ""
  });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [adjRes, bepaariRes, dukandarRes] = await Promise.all([
        axios.get(`${API}/adjustments`),
        axios.get(`${API}/bepaaris`),
        axios.get(`${API}/dukandars`)
      ]);
      setAdjustments(adjRes.data);
      setBeparis(bepaariRes.data);
      setDukandars(dukandarRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const getParties = (type) => {
    if (type === "BEPAARI") return bepaaris;
    if (type === "DUKANDAR") return dukandars;
    return [];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.debit_type || !form.debit_party_id || !form.credit_type || !form.credit_party_id) {
      alert("Please select both Debit and Credit parties");
      return;
    }
    await axios.post(`${API}/adjustments`, {
      ...form,
      amount: parseFloat(form.amount)
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

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <h2>Adjustments / Journal Voucher</h2>
      <p className="hint">Record triangular settlements where one party pays another on your behalf (no cash moves through you)</p>

      <form className="entry-form adjustment-form" onSubmit={handleSubmit}>
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        
        <div className="jv-row">
          <div className="jv-section debit-section">
            <label>DEBIT (Reduces our Payable)</label>
            <select value={form.debit_type} onChange={(e) => setForm({ ...form, debit_type: e.target.value, debit_party_id: "" })} required>
              <option value="">Select Type</option>
              <option value="BEPAARI">Bepaari</option>
              <option value="DUKANDAR">Dukandar</option>
            </select>
            <select value={form.debit_party_id} onChange={(e) => setForm({ ...form, debit_party_id: e.target.value })} required disabled={!form.debit_type}>
              <option value="">Select Party</option>
              {getParties(form.debit_type).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="jv-section credit-section">
            <label>CREDIT (Reduces their Receivable)</label>
            <select value={form.credit_type} onChange={(e) => setForm({ ...form, credit_type: e.target.value, credit_party_id: "" })} required>
              <option value="">Select Type</option>
              <option value="BEPAARI">Bepaari</option>
              <option value="DUKANDAR">Dukandar</option>
            </select>
            <select value={form.credit_party_id} onChange={(e) => setForm({ ...form, credit_party_id: e.target.value })} required disabled={!form.credit_type}>
              <option value="">Select Party</option>
              {getParties(form.credit_type).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <input type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required min="1" />
        <input type="text" placeholder="Narration (e.g., Jagdish paid Bepaari directly)" value={form.narration} onChange={(e) => setForm({ ...form, narration: e.target.value })} style={{minWidth: '300px'}} />
        <button type="submit" className="btn-primary">Add Adjustment</button>
      </form>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Debit (Payable ↓)</th>
              <th>Credit (Receivable ↓)</th>
              <th>Amount</th>
              <th>Narration</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {adjustments.map((a) => (
              <tr key={a.id}>
                <td>{a.date}</td>
                <td><span className="badge debit">{a.debit_type}</span> {a.debit_party_name}</td>
                <td><span className="badge credit">{a.credit_type}</span> {a.credit_party_name}</td>
                <td>{formatCurrency(a.amount)}</td>
                <td>{a.narration || "-"}</td>
                <td><button className="btn-delete" onClick={() => handleDelete(a.id)}>X</button></td>
              </tr>
            ))}
            {adjustments.length === 0 && (
              <tr><td colSpan="6" style={{textAlign: 'center', color: '#888'}}>No adjustments recorded yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
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

  const parties = partyType === "bepaari" ? bepaaris : dukandars;

  return (
    <div className="page">
      <h2>Party Statement</h2>
      <p className="hint">Get complete transaction history for any Bepaari or Dukandar. Useful for resolving disputes.</p>
      
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
        {statement && <button className="btn-excel" onClick={downloadExcel}>Download Excel</button>}
      </div>

      {loading && <div className="loading">Loading...</div>}

      {statement && (
        <div className="statement-container">
          <div className="party-info">
            <h3>{statement.party.name}</h3>
            <p>Phone: {statement.party.phone || "N/A"} | Opening Balance: {formatCurrency(statement.party.opening_balance)}</p>
          </div>

          <div className="statement-section">
            <h4>Sales ({statement.sales.length} entries)</h4>
            <table>
              <thead><tr><th>Date</th><th>{partyType === "bepaari" ? "Dukandar" : "Bepaari"}</th><th>Qty</th><th>Rate</th><th>Gross</th><th>Disc</th><th>Net</th></tr></thead>
              <tbody>
                {statement.sales.map((s, i) => (
                  <tr key={i}>
                    <td>{s.date}</td><td>{partyType === "bepaari" ? s.dukandar_name : s.bepaari_name}</td>
                    <td>{s.quantity}</td><td>{formatCurrency(s.rate)}</td><td>{formatCurrency(s.gross_amount)}</td>
                    <td>{formatCurrency(s.discount)}</td><td>{formatCurrency(s.net_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="statement-section">
            <h4>Payments/Receipts ({statement.cash_entries.length} entries)</h4>
            <table>
              <thead><tr><th>Date</th><th>Type</th><th>Sub-Type</th><th>Amount</th><th>Mode</th></tr></thead>
              <tbody>
                {statement.cash_entries.map((c, i) => (
                  <tr key={i}><td>{c.date}</td><td>{c.type}</td><td>{c.sub_type}</td><td>{formatCurrency(c.amount)}</td><td>{c.mode}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="summary-box">
            <h4>Summary</h4>
            <p>Total Sales: {formatCurrency(statement.summary.total_sales)} ({statement.summary.total_quantity} qty)</p>
            <p>Total Discount: {formatCurrency(statement.summary.total_discount)}</p>
            <p>Total {partyType === "bepaari" ? "Payments" : "Receipts"}: {formatCurrency(statement.summary.total_payments)}</p>
            <p>Opening Balance: {formatCurrency(statement.summary.opening_balance)}</p>
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
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const url = asOnDate ? `${API}/bepaari-ledger?as_on_date=${asOnDate}` : `${API}/bepaari-ledger`;
    const res = await axios.get(url);
    setLedger(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [asOnDate]);

  if (loading) return <div className="loading">Loading...</div>;

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
      </div>
      <div className="table-container">
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Opening</th><th>Sales</th><th>Qty</th><th>Comm</th><th>KK</th><th>JB</th><th>Deductions</th><th>Payments</th><th>Adj</th><th>Balance</th></tr></thead>
          <tbody>
            {ledger.filter(b => b.gross_sales > 0 || b.opening > 0 || b.balance !== 0).map((b) => (
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
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const url = asOnDate ? `${API}/dukandar-ledger?as_on_date=${asOnDate}` : `${API}/dukandar-ledger`;
    const res = await axios.get(url);
    setLedger(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [asOnDate]);

  if (loading) return <div className="loading">Loading...</div>;

  const totals = ledger.reduce((acc, d) => ({
    purchases: acc.purchases + d.purchases, discounts: acc.discounts + d.discounts, 
    receipts: acc.receipts + d.receipts, adj: acc.adj + (d.adjustments || 0), balance: acc.balance + d.balance
  }), { purchases: 0, discounts: 0, receipts: 0, adj: 0, balance: 0 });

  return (
    <div className="page">
      <h2>Dukandar Ledger (Patti)</h2>
      <div className="filter-bar">
        <label>As On Date:</label>
        <input type="date" value={asOnDate} onChange={(e) => setAsOnDate(e.target.value)} />
        {asOnDate && <button className="btn-clear" onClick={() => setAsOnDate("")}>Show Current</button>}
      </div>
      <div className="table-container">
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Opening</th><th>Purchases</th><th>Discounts</th><th>Net Receivable</th><th>Receipts</th><th>Adj</th><th>Balance</th></tr></thead>
          <tbody>
            {ledger.filter(d => d.purchases > 0 || d.opening > 0 || d.balance !== 0).map((d) => (
              <tr key={d.id}>
                <td><strong>{d.name}</strong></td><td>{d.phone || "-"}</td><td>{formatCurrency(d.opening)}</td><td>{formatCurrency(d.purchases)}</td>
                <td>{formatCurrency(d.discounts)}</td><td>{formatCurrency(d.net_receivable)}</td><td>{formatCurrency(d.receipts)}</td>
                <td className="adjustment-col">{d.adjustments > 0 ? formatCurrency(d.adjustments) : "-"}</td>
                <td className={d.balance >= 0 ? "positive" : "negative"}>{formatCurrency(d.balance)}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td><strong>TOTAL</strong></td><td></td><td>-</td><td><strong>{formatCurrency(totals.purchases)}</strong></td><td><strong>{formatCurrency(totals.discounts)}</strong></td>
              <td>-</td><td><strong>{formatCurrency(totals.receipts)}</strong></td>
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
              <tr><td>Capital</td><td>{formatCurrency(L.capital)}</td></tr>
              <tr><td>Loans</td><td>{formatCurrency(L.loans)}</td></tr>
              <tr><td>Amanat</td><td>{formatCurrency(L.amanat)}</td></tr>
              <tr><td>Bepaari Payables</td><td>{formatCurrency(L.bepaari_payables)}</td></tr>
              <tr><td>Dukandar Advances</td><td>{formatCurrency(L.dukandar_advances)}</td></tr>
              <tr className="sub-item"><td>JB Total</td><td>{formatCurrency(L.jb.total)}</td></tr>
              <tr className="sub-item"><td>KK Total</td><td>{formatCurrency(L.kk.total)}</td></tr>
              <tr className="sub-item"><td>Commission Total</td><td>{formatCurrency(L.commission.total)}</td></tr>
              <tr><td>Zakat Payable</td><td>{formatCurrency(L.zakat)}</td></tr>
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
              <tr><td>Bepaari Advances</td><td>{formatCurrency(A.bepaari_advances)}</td></tr>
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
