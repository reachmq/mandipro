import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import axios from "axios";
import "./App.css";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
};

// ============== SIDEBAR ==============
const Sidebar = () => {
  const navItems = [
    { path: "/", label: "Dashboard", icon: "📊" },
    { path: "/daily-sales", label: "Daily Sales", icon: "🐐" },
    { path: "/cash-book", label: "Cash Book", icon: "💰" },
    { path: "/bepaari-ledger", label: "Bepaari Ledger", icon: "📒" },
    { path: "/dukandar-ledger", label: "Dukandar Ledger", icon: "📗" },
    { path: "/balance-sheet", label: "Balance Sheet", icon: "📑" },
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
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
          >
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
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API}/balance-sheet`);
        setData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page" data-testid="dashboard-page">
      <h2>Dashboard</h2>
      <div className="dashboard-grid">
        <div className="card green">
          <h3>Cash Balance</h3>
          <p className="big-number">{formatCurrency(data?.assets?.cash_balance)}</p>
        </div>
        <div className="card blue">
          <h3>Bank Balance</h3>
          <p className="big-number">{formatCurrency(data?.assets?.bank_balance)}</p>
        </div>
        <div className="card orange">
          <h3>Patti (Receivable)</h3>
          <p className="big-number">{formatCurrency(data?.assets?.patti)}</p>
        </div>
        <div className="card red">
          <h3>Bepaari Payable</h3>
          <p className="big-number">{formatCurrency(data?.liabilities?.bepaari_payables)}</p>
        </div>
        <div className={`card ${data?.difference === 0 ? "green" : "red"}`}>
          <h3>Balance Sheet</h3>
          <p className="big-number">{data?.difference === 0 ? "TALLIED" : `Diff: ${formatCurrency(data?.difference)}`}</p>
        </div>
        <div className="card purple">
          <h3>Commission Earned</h3>
          <p className="big-number">{formatCurrency(data?.liabilities?.commission?.total)}</p>
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
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], bepaari_id: "", dukandar_id: "", quantity: "", rate: "", discount: "0" });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [salesRes, bepaariRes, dukandarRes] = await Promise.all([
        axios.get(`${API}/daily-sales`),
        axios.get(`${API}/bepaaris`),
        axios.get(`${API}/dukandars`)
      ]);
      setSales(salesRes.data);
      setBeparis(bepaariRes.data);
      setDukandars(dukandarRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/daily-sales`, {
        ...form,
        quantity: parseInt(form.quantity),
        rate: parseFloat(form.rate),
        discount: parseFloat(form.discount || 0)
      });
      setForm({ ...form, bepaari_id: "", dukandar_id: "", quantity: "", rate: "", discount: "0" });
      fetchData();
    } catch (err) {
      alert("Error adding sale: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this sale?")) {
      await axios.delete(`${API}/daily-sales/${id}`);
      fetchData();
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page" data-testid="daily-sales-page">
      <h2>Daily Sales</h2>
      
      <form className="entry-form" onSubmit={handleSubmit} data-testid="daily-sales-form">
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        <select value={form.bepaari_id} onChange={(e) => setForm({ ...form, bepaari_id: e.target.value })} required data-testid="bepaari-select">
          <option value="">Select Bepaari</option>
          {bepaaris.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={form.dukandar_id} onChange={(e) => setForm({ ...form, dukandar_id: e.target.value })} required data-testid="dukandar-select">
          <option value="">Select Dukandar</option>
          {dukandars.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input type="number" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required min="1" />
        <input type="number" placeholder="Rate" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} required min="0" step="0.01" />
        <input type="number" placeholder="Discount" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} min="0" />
        <button type="submit" className="btn-primary" data-testid="add-sale-btn">Add Sale</button>
      </form>

      <div className="table-container">
        <table data-testid="sales-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Bepaari</th>
              <th>Dukandar</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Gross</th>
              <th>Discount</th>
              <th>Net</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>{s.date}</td>
                <td>{s.bepaari_name}</td>
                <td>{s.dukandar_name}</td>
                <td>{s.quantity}</td>
                <td>{formatCurrency(s.rate)}</td>
                <td>{formatCurrency(s.gross_amount)}</td>
                <td>{formatCurrency(s.discount)}</td>
                <td>{formatCurrency(s.net_amount)}</td>
                <td><button className="btn-delete" onClick={() => handleDelete(s.id)}>Delete</button></td>
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
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], type: "", sub_type: "", party_id: "", amount: "", mode: "CASH", particulars: "" });
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
  const modes = ["CASH", "BANK", "UPI", "TRANSFER"];

  const fetchData = async () => {
    try {
      const [entriesRes, bepaarisRes, dukandarsRes, advRes, capRes] = await Promise.all([
        axios.get(`${API}/cash-book`),
        axios.get(`${API}/bepaaris`),
        axios.get(`${API}/dukandars`),
        axios.get(`${API}/advance-parties`),
        axios.get(`${API}/capital-partners`)
      ]);
      setEntries(entriesRes.data);
      const allParties = [
        ...bepaarisRes.data.map(p => ({ ...p, ptype: "BEPAARI" })),
        ...dukandarsRes.data.map(p => ({ ...p, ptype: "DUKANDAR" })),
        ...advRes.data.map(p => ({ ...p, ptype: "ADVANCE" })),
        ...capRes.data.map(p => ({ ...p, ptype: p.partner_type }))
      ];
      setParties(allParties);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredParties = parties.filter(p => {
    if (form.type === "BEPAARI") return p.ptype === "BEPAARI";
    if (form.type === "DUKANDAR") return p.ptype === "DUKANDAR";
    if (form.type === "ADVANCE") return p.ptype === "ADVANCE";
    if (["CAPITAL", "LOAN", "AMANAT"].includes(form.type)) return p.ptype === form.type;
    return false;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/cash-book`, {
        ...form,
        amount: parseFloat(form.amount)
      });
      setForm({ ...form, type: "", sub_type: "", party_id: "", amount: "", particulars: "" });
      fetchData();
    } catch (err) {
      alert("Error adding entry: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this entry?")) {
      await axios.delete(`${API}/cash-book/${id}`);
      fetchData();
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page" data-testid="cash-book-page">
      <h2>Cash Book</h2>
      
      <form className="entry-form cash-form" onSubmit={handleSubmit} data-testid="cash-book-form">
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, sub_type: "", party_id: "" })} required>
          <option value="">Type</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={form.sub_type} onChange={(e) => setForm({ ...form, sub_type: e.target.value })} required disabled={!form.type}>
          <option value="">Sub-Type</option>
          {(subTypes[form.type] || []).map((st) => <option key={st} value={st}>{st}</option>)}
        </select>
        <select value={form.party_id} onChange={(e) => setForm({ ...form, party_id: e.target.value })} disabled={!filteredParties.length}>
          <option value="">Party (Optional)</option>
          {filteredParties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required min="0" step="0.01" />
        <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} required>
          {modes.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="text" placeholder="Particulars (Optional)" value={form.particulars} onChange={(e) => setForm({ ...form, particulars: e.target.value })} />
        <button type="submit" className="btn-primary" data-testid="add-entry-btn">Add Entry</button>
      </form>

      <div className="table-container">
        <table data-testid="cash-book-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Sub-Type</th>
              <th>Party</th>
              <th>Amount</th>
              <th>Mode</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{e.date}</td>
                <td>{e.type}</td>
                <td>{e.sub_type}</td>
                <td>{e.party_name || "-"}</td>
                <td>{formatCurrency(e.amount)}</td>
                <td>{e.mode}</td>
                <td><button className="btn-delete" onClick={() => handleDelete(e.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============== BEPAARI LEDGER ==============
const BepariLedger = () => {
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API}/bepaari-ledger`);
        setLedger(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  const totals = ledger.reduce((acc, b) => ({
    gross: acc.gross + b.gross_sales,
    qty: acc.qty + b.quantity,
    comm: acc.comm + b.commission,
    kk: acc.kk + b.kk,
    jb: acc.jb + b.jb,
    ded: acc.ded + b.total_deductions,
    pay: acc.pay + b.payments,
    bal: acc.bal + b.balance
  }), { gross: 0, qty: 0, comm: 0, kk: 0, jb: 0, ded: 0, pay: 0, bal: 0 });

  return (
    <div className="page" data-testid="bepaari-ledger-page">
      <h2>Bepaari Ledger</h2>
      <div className="table-container">
        <table data-testid="bepaari-ledger-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Opening</th>
              <th>Gross Sales</th>
              <th>Qty</th>
              <th>Comm</th>
              <th>KK</th>
              <th>JB</th>
              <th>Deductions</th>
              <th>Payments</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {ledger.filter(b => b.gross_sales > 0 || b.opening > 0 || b.balance !== 0).map((b) => (
              <tr key={b.id}>
                <td><strong>{b.name}</strong></td>
                <td>{formatCurrency(b.opening)}</td>
                <td>{formatCurrency(b.gross_sales)}</td>
                <td>{b.quantity}</td>
                <td>{formatCurrency(b.commission)}</td>
                <td>{formatCurrency(b.kk)}</td>
                <td>{formatCurrency(b.jb)}</td>
                <td>{formatCurrency(b.total_deductions)}</td>
                <td>{formatCurrency(b.payments)}</td>
                <td className={b.balance >= 0 ? "positive" : "negative"}>{formatCurrency(b.balance)}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td><strong>TOTAL</strong></td>
              <td>-</td>
              <td><strong>{formatCurrency(totals.gross)}</strong></td>
              <td><strong>{totals.qty}</strong></td>
              <td><strong>{formatCurrency(totals.comm)}</strong></td>
              <td><strong>{formatCurrency(totals.kk)}</strong></td>
              <td><strong>{formatCurrency(totals.jb)}</strong></td>
              <td><strong>{formatCurrency(totals.ded)}</strong></td>
              <td><strong>{formatCurrency(totals.pay)}</strong></td>
              <td><strong>{formatCurrency(totals.bal)}</strong></td>
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API}/dukandar-ledger`);
        setLedger(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  const totals = ledger.reduce((acc, d) => ({
    purchases: acc.purchases + d.purchases,
    discounts: acc.discounts + d.discounts,
    receipts: acc.receipts + d.receipts,
    balance: acc.balance + d.balance
  }), { purchases: 0, discounts: 0, receipts: 0, balance: 0 });

  return (
    <div className="page" data-testid="dukandar-ledger-page">
      <h2>Dukandar Ledger (Patti)</h2>
      <div className="table-container">
        <table data-testid="dukandar-ledger-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Opening</th>
              <th>Purchases</th>
              <th>Discounts</th>
              <th>Net Receivable</th>
              <th>Receipts</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {ledger.filter(d => d.purchases > 0 || d.opening > 0 || d.balance !== 0).map((d) => (
              <tr key={d.id}>
                <td><strong>{d.name}</strong></td>
                <td>{formatCurrency(d.opening)}</td>
                <td>{formatCurrency(d.purchases)}</td>
                <td>{formatCurrency(d.discounts)}</td>
                <td>{formatCurrency(d.net_receivable)}</td>
                <td>{formatCurrency(d.receipts)}</td>
                <td className={d.balance >= 0 ? "positive" : "negative"}>{formatCurrency(d.balance)}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td><strong>TOTAL (PATTI)</strong></td>
              <td>-</td>
              <td><strong>{formatCurrency(totals.purchases)}</strong></td>
              <td><strong>{formatCurrency(totals.discounts)}</strong></td>
              <td>-</td>
              <td><strong>{formatCurrency(totals.receipts)}</strong></td>
              <td><strong>{formatCurrency(totals.balance)}</strong></td>
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API}/balance-sheet`);
        setData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  const { liabilities: L, assets: A, difference } = data;

  return (
    <div className="page" data-testid="balance-sheet-page">
      <h2>Balance Sheet</h2>
      <div className={`balance-status ${difference === 0 ? "tallied" : "not-tallied"}`}>
        {difference === 0 ? "BALANCE SHEET TALLIED" : `DIFFERENCE: ${formatCurrency(difference)}`}
      </div>
      
      <div className="bs-container">
        <div className="bs-section">
          <h3>LIABILITIES (We Owe)</h3>
          <table>
            <tbody>
              <tr><td>Capital</td><td>{formatCurrency(L.capital)}</td></tr>
              <tr><td>Loans</td><td>{formatCurrency(L.loans)}</td></tr>
              <tr><td>Amanat</td><td>{formatCurrency(L.amanat)}</td></tr>
              <tr><td>Bepaari Payables</td><td>{formatCurrency(L.bepaari_payables)}</td></tr>
              <tr><td>Dukandar Advances</td><td>{formatCurrency(L.dukandar_advances)}</td></tr>
              <tr className="sub-item"><td>JB (BF: {formatCurrency(L.jb.bf)} + Coll: {formatCurrency(L.jb.collected)} - Paid: {formatCurrency(L.jb.paid)})</td><td>{formatCurrency(L.jb.total)}</td></tr>
              <tr className="sub-item"><td>KK (BF: {formatCurrency(L.kk.bf)} + Coll: {formatCurrency(L.kk.collected)})</td><td>{formatCurrency(L.kk.total)}</td></tr>
              <tr className="sub-item"><td>Commission (BF: {formatCurrency(L.commission.bf)} + Earned: {formatCurrency(L.commission.earned)} - Disc: {formatCurrency(L.commission.discounts)})</td><td>{formatCurrency(L.commission.total)}</td></tr>
              <tr><td>Zakat Payable</td><td>{formatCurrency(L.zakat)}</td></tr>
              <tr className="total-row"><td><strong>TOTAL LIABILITIES</strong></td><td><strong>{formatCurrency(L.total)}</strong></td></tr>
            </tbody>
          </table>
        </div>

        <div className="bs-section">
          <h3>ASSETS (We Have / Owed To Us)</h3>
          <table>
            <tbody>
              <tr><td>Cash Balance</td><td>{formatCurrency(A.cash_balance)}</td></tr>
              <tr><td>Bank Balance</td><td>{formatCurrency(A.bank_balance)}</td></tr>
              <tr><td>Patti (Dukandar Receivable)</td><td>{formatCurrency(A.patti)}</td></tr>
              <tr><td>Bepaari Advances (Overpaid)</td><td>{formatCurrency(A.bepaari_advances)}</td></tr>
              <tr className="sub-item"><td>Mandi Expenses</td><td>{formatCurrency(A.mandi_expenses.total)}</td></tr>
              <tr className="sub-item"><td>BF Discount</td><td>{formatCurrency(A.bf_discount.total)}</td></tr>
              <tr className="sub-item"><td>MHN Personal</td><td>{formatCurrency(A.mhn_personal.total)}</td></tr>
              {A.advance_receivables.map((adv, i) => (
                <tr key={i}><td>{adv.name} Receivable</td><td>{formatCurrency(adv.amount)}</td></tr>
              ))}
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
  const [form, setForm] = useState({ name: "", opening_balance: "0", commission_percent: "4", partner_type: "CAPITAL" });
  const [activeTab, setActiveTab] = useState("bepaaris");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [b, d, a, c, s] = await Promise.all([
        axios.get(`${API}/bepaaris`),
        axios.get(`${API}/dukandars`),
        axios.get(`${API}/advance-parties`),
        axios.get(`${API}/capital-partners`),
        axios.get(`${API}/settings`)
      ]);
      setBeparis(b.data);
      setDukandars(d.data);
      setAdvParties(a.data);
      setCapPartners(c.data);
      setSettings(s.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const endpoints = {
      bepaaris: "/bepaaris",
      dukandars: "/dukandars",
      advance: "/advance-parties",
      capital: "/capital-partners"
    };
    try {
      await axios.post(`${API}${endpoints[activeTab]}`, {
        name: form.name,
        opening_balance: parseFloat(form.opening_balance || 0),
        commission_percent: parseFloat(form.commission_percent || 4),
        partner_type: form.partner_type
      });
      setForm({ name: "", opening_balance: "0", commission_percent: "4", partner_type: "CAPITAL" });
      fetchData();
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleSettingsUpdate = async () => {
    try {
      await axios.put(`${API}/settings`, settings);
      alert("Settings saved!");
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page" data-testid="masters-page">
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
          <h3>System Settings & Opening Balances</h3>
          <div className="settings-grid">
            <label>Commission Rate (%)<input type="number" value={settings.commission_rate || ""} onChange={(e) => setSettings({ ...settings, commission_rate: parseFloat(e.target.value) })} /></label>
            <label>KK Fixed (per Bepaari)<input type="number" value={settings.kk_fixed || ""} onChange={(e) => setSettings({ ...settings, kk_fixed: parseFloat(e.target.value) })} /></label>
            <label>JB Rate (per Goat)<input type="number" value={settings.jb_rate || ""} onChange={(e) => setSettings({ ...settings, jb_rate: parseFloat(e.target.value) })} /></label>
            <label>Opening Cash<input type="number" value={settings.opening_cash || ""} onChange={(e) => setSettings({ ...settings, opening_cash: parseFloat(e.target.value) })} /></label>
            <label>Opening Bank<input type="number" value={settings.opening_bank || ""} onChange={(e) => setSettings({ ...settings, opening_bank: parseFloat(e.target.value) })} /></label>
            <label>JB Opening<input type="number" value={settings.jb_opening || ""} onChange={(e) => setSettings({ ...settings, jb_opening: parseFloat(e.target.value) })} /></label>
            <label>KK Opening<input type="number" value={settings.kk_opening || ""} onChange={(e) => setSettings({ ...settings, kk_opening: parseFloat(e.target.value) })} /></label>
            <label>Commission Opening<input type="number" value={settings.commission_opening || ""} onChange={(e) => setSettings({ ...settings, commission_opening: parseFloat(e.target.value) })} /></label>
            <label>Zakat Opening<input type="number" value={settings.zakat_opening || ""} onChange={(e) => setSettings({ ...settings, zakat_opening: parseFloat(e.target.value) })} /></label>
            <label>Mandi Exp Opening<input type="number" value={settings.mandi_exp_opening || ""} onChange={(e) => setSettings({ ...settings, mandi_exp_opening: parseFloat(e.target.value) })} /></label>
            <label>BF Discount Opening<input type="number" value={settings.bf_disc_opening || ""} onChange={(e) => setSettings({ ...settings, bf_disc_opening: parseFloat(e.target.value) })} /></label>
            <label>MHN Personal Opening<input type="number" value={settings.mhn_personal_opening || ""} onChange={(e) => setSettings({ ...settings, mhn_personal_opening: parseFloat(e.target.value) })} /></label>
          </div>
          <button className="btn-primary" onClick={handleSettingsUpdate}>Save Settings</button>
        </div>
      ) : (
        <>
          <form className="entry-form" onSubmit={handleAdd}>
            <input type="text" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input type="number" placeholder="Opening Balance" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} />
            {activeTab === "bepaaris" && <input type="number" placeholder="Commission %" value={form.commission_percent} onChange={(e) => setForm({ ...form, commission_percent: e.target.value })} />}
            {activeTab === "capital" && (
              <select value={form.partner_type} onChange={(e) => setForm({ ...form, partner_type: e.target.value })}>
                <option value="CAPITAL">CAPITAL</option>
                <option value="LOAN">LOAN</option>
                <option value="AMANAT">AMANAT</option>
              </select>
            )}
            <button type="submit" className="btn-primary">Add</button>
          </form>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Opening Balance</th>
                  {activeTab === "bepaaris" && <th>Commission %</th>}
                  {activeTab === "capital" && <th>Type</th>}
                </tr>
              </thead>
              <tbody>
                {(activeTab === "bepaaris" ? bepaaris : activeTab === "dukandars" ? dukandars : activeTab === "advance" ? advParties : capPartners).map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{formatCurrency(item.opening_balance)}</td>
                    {activeTab === "bepaaris" && <td>{item.commission_percent}%</td>}
                    {activeTab === "capital" && <td>{item.partner_type}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
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
            <Route path="/bepaari-ledger" element={<BepariLedger />} />
            <Route path="/dukandar-ledger" element={<DukandarLedger />} />
            <Route path="/balance-sheet" element={<BalanceSheet />} />
            <Route path="/masters" element={<Masters />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
