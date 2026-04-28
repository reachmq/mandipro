import { useState, useEffect, useRef } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
};

const BepariAakda = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [aakdaList, setAakdaList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAakda, setSelectedAakda] = useState(null);
  const printRef = useRef();

  const fetchAakda = async () => {
    if (!date) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/bepaari-aakda?date=${date}`);
      setAakdaList(res.data);
    } catch (err) {
      console.error(err);
      alert("Error fetching Aakda");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Bepaari Aakda - ${selectedAakda.bepaari_name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
            body { font-family: 'IBM Plex Sans', Arial, sans-serif; padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .aakda-slip { border: 2px solid #1B2A4A; padding: 20px; max-width: 420px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 3px solid #C5A55A; padding-bottom: 10px; margin-bottom: 15px; }
            .header h2 { margin: 0; font-size: 18px; font-family: 'Cormorant Garamond', Georgia, serif; color: #1B2A4A; }
            .header .firm-name { font-size: 14px; color: #C5A55A; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0; }
            .header p { margin: 3px 0; font-size: 11px; color: #475569; }
            .party-info { font-size: 16px; font-weight: bold; color: #1B2A4A; margin-bottom: 15px; }
            .sales-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px; }
            .sales-table th, .sales-table td { border: 1px solid #E2E0D8; padding: 5px; text-align: right; }
            .sales-table th:first-child, .sales-table td:first-child { text-align: left; }
            .sales-table th { background: #1B2A4A; color: white; font-size: 10px; text-transform: uppercase; }
            .sales-table .total-row td { border-top: 2px solid #C5A55A; background: rgba(197,165,90,0.08); font-weight: 700; }
            .sale-comment-row td { background: #F4F2EC; font-style: italic; color: #475569; font-size: 11px; padding: 4px 8px; text-align: left; border-top: none; border-bottom: 1px solid #E2E0D8; }
            .sale-comment-label { color: #C5A55A; font-weight: 700; font-style: normal; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; margin-right: 4px; }
            .summary-table { width: 100%; font-size: 13px; }
            .summary-table td { padding: 4px 0; }
            .summary-table td:last-child { text-align: right; font-weight: 500; }
            .total-row { border-top: 3px solid #C5A55A; font-weight: bold; font-size: 14px; }
            .closing-row { background: rgba(27,42,74,0.06); font-size: 16px; }
            .deduction { color: #991B1B; }
            .footer { text-align: center; margin-top: 15px; font-size: 9px; color: #94a3b8; border-top: 1px dashed #C5A55A; padding-top: 8px; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="page">
      <h2>Bepaari Aakda (Settlement Slip)</h2>
      <p className="hint">Generate daily settlement slips for Bepaaris after each market day</p>
      
      <div className="filter-bar">
        <label>Market Date:</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn-primary" onClick={fetchAakda}>Get Aakda</button>
      </div>

      {loading && <div className="loading">Loading...</div>}

      {!loading && aakdaList.length > 0 && !selectedAakda && (
        <div className="aakda-grid">
          {/* Daily Summary Banner */}
          {(() => {
            const totals = aakdaList.reduce((acc, a) => ({
              qty: acc.qty + (a.summary.quantity || 0),
              gross: acc.gross + (a.summary.gross_sales || 0),
              commission: acc.commission + (a.summary.commission || 0),
              rateDiff: acc.rateDiff + (a.summary.rate_diff || 0),
              discounts: acc.discounts + (a.sales_detail || []).reduce((s, d) => s + (d.discount || 0), 0),
              net: acc.net + (a.summary.net_amount || 0),
            }), { qty: 0, gross: 0, commission: 0, rateDiff: 0, discounts: 0, net: 0 });
            const netCommission = totals.commission + totals.rateDiff - totals.discounts;
            return (
              <div className="daily-summary-banner" data-testid="daily-summary-banner">
                <div className="daily-summary-header">
                  <h3>Day's Summary — {new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</h3>
                  <span className="bepaari-count">{aakdaList.length} Bepaaris</span>
                </div>
                <div className="daily-summary-cards">
                  <div className="summary-stat" data-testid="daily-total-goats">
                    <span className="stat-label">Total Goats</span>
                    <span className="stat-value goats">{totals.qty}</span>
                  </div>
                  <div className="summary-stat" data-testid="daily-gross-sales">
                    <span className="stat-label">Gross Sales</span>
                    <span className="stat-value gross">{formatCurrency(totals.gross)}</span>
                  </div>
                  <div className="summary-stat" data-testid="daily-commission">
                    <span className="stat-label">Net Commission</span>
                    <span className="stat-value commission">{formatCurrency(netCommission)}</span>
                    <span className="stat-detail">Gross: {formatCurrency(totals.commission)}{totals.rateDiff > 0 ? ` + Rate Diff: ${formatCurrency(totals.rateDiff)}` : ''} | Disc: -{formatCurrency(totals.discounts)}</span>
                  </div>
                  <div className="summary-stat" data-testid="daily-net-amount">
                    <span className="stat-label">Net Payable</span>
                    <span className="stat-value net">{formatCurrency(totals.net)}</span>
                  </div>
                </div>
              </div>
            );
          })()}
          <h3>Bepaaris with transactions on {date} ({aakdaList.length})</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Bepaari</th>
                  <th>Qty</th>
                  <th>Gross Sales</th>
                  <th>Deductions</th>
                  <th>Net</th>
                  <th>Balance</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {aakdaList.map((a) => (
                  <tr key={a.bepaari_id}>
                    <td><strong>{a.bepaari_name}</strong></td>
                    <td>{a.summary.quantity}</td>
                    <td>{formatCurrency(a.summary.gross_sales)}</td>
                    <td className="deduction">{formatCurrency(a.summary.total_deductions)}</td>
                    <td>{formatCurrency(a.summary.net_amount)}</td>
                    <td className={a.summary.closing_balance >= 0 ? "positive" : "negative"}>
                      {formatCurrency(a.summary.closing_balance)}
                    </td>
                    <td>
                      <button className="btn-primary btn-small" onClick={() => setSelectedAakda(a)}>
                        View Aakda
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && aakdaList.length === 0 && date && (
        <div className="no-data">No transactions found for {date}</div>
      )}

      {selectedAakda && (
        <div className="aakda-modal">
          <div className="aakda-modal-content">
            <div className="aakda-actions">
              <button className="btn-clear" onClick={() => setSelectedAakda(null)}>Back to List</button>
              <button className="btn-primary" onClick={handlePrint}>Print Aakda</button>
            </div>

            <div ref={printRef} className="aakda-slip-preview">
              <div className="aakda-slip">
                <div className="header">
                  <p className="firm-name">Haji Mushtaq Nana & Sons</p>
                  <h2>BEPAARI AAKDA</h2>
                  <p>Date: {selectedAakda.date}</p>
                </div>

                <div className="party-info">
                  <p><strong>{selectedAakda.bepaari_name}</strong></p>
                  {selectedAakda.phone && <p>Phone: {selectedAakda.phone}</p>}
                </div>

                <table className="sales-table">
                  <thead>
                    <tr>
                      <th>Qty</th>
                      <th>Rate</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedAakda.sales_detail || []).flatMap((s, i) => {
                      const rows = [
                        <tr key={`r-${i}`}>
                          <td>{s.quantity}</td>
                          <td>{formatCurrency(s.rate)}</td>
                          <td>{formatCurrency(s.amount)}</td>
                        </tr>
                      ];
                      if (s.comment) {
                        rows.push(
                          <tr key={`c-${i}`} className="sale-comment-row">
                            <td colSpan={3} className="sale-comment-cell">
                              <span className="sale-comment-label">Note:</span> {s.comment}
                            </td>
                          </tr>
                        );
                      }
                      return rows;
                    })}
                    <tr className="total-row">
                      <td><strong>{selectedAakda.summary.quantity}</strong></td>
                      <td>—</td>
                      <td><strong>{formatCurrency(selectedAakda.summary.gross_sales)}</strong></td>
                    </tr>
                  </tbody>
                </table>

                <table className="summary-table">
                  <tbody>
                    <tr>
                      <td>Opening Balance (B/F)</td>
                      <td>{formatCurrency(selectedAakda.opening_balance)}</td>
                    </tr>
                    <tr>
                      <td>Gross Sales ({selectedAakda.summary.quantity} qty)</td>
                      <td>{formatCurrency(selectedAakda.summary.gross_sales)}</td>
                    </tr>
                    <tr className="deduction">
                      <td>(-) Commission @ {selectedAakda.summary.commission_pct}%</td>
                      <td>{formatCurrency(selectedAakda.summary.commission)}</td>
                    </tr>
                    <tr className="deduction">
                      <td>(-) KK (Fixed)</td>
                      <td>{formatCurrency(selectedAakda.summary.kk)}</td>
                    </tr>
                    <tr className="deduction">
                      <td>(-) JB @ {formatCurrency(selectedAakda.summary.jb_rate)}/goat</td>
                      <td>{formatCurrency(selectedAakda.summary.jb)}</td>
                    </tr>
                    {selectedAakda.summary.motor > 0 && (
                      <tr className="deduction"><td>(-) Motor</td><td>{formatCurrency(selectedAakda.summary.motor)}</td></tr>
                    )}
                    {selectedAakda.summary.bhussa > 0 && (
                      <tr className="deduction"><td>(-) Bhussa</td><td>{formatCurrency(selectedAakda.summary.bhussa)}</td></tr>
                    )}
                    {selectedAakda.summary.gawali > 0 && (
                      <tr className="deduction"><td>(-) Gawali</td><td>{formatCurrency(selectedAakda.summary.gawali)}</td></tr>
                    )}
                    {selectedAakda.summary.cash_advance > 0 && (
                      <tr className="deduction"><td>(-) Cash Advance</td><td>{formatCurrency(selectedAakda.summary.cash_advance)}</td></tr>
                    )}
                    <tr className="total-row">
                      <td>Total Deductions</td>
                      <td>{formatCurrency(selectedAakda.summary.total_deductions)}</td>
                    </tr>
                    <tr>
                      <td>Net Amount</td>
                      <td>{formatCurrency(selectedAakda.summary.net_amount)}</td>
                    </tr>
                    {selectedAakda.summary.payments > 0 && (
                      <tr><td>(-) Payment Made</td><td>{formatCurrency(selectedAakda.summary.payments)}</td></tr>
                    )}
                    {selectedAakda.summary.jv_adjustment > 0 && (
                      <tr className="jv-row"><td>(-) JV Adjustment</td><td>{formatCurrency(selectedAakda.summary.jv_adjustment)}</td></tr>
                    )}
                    <tr className="closing-row">
                      <td><strong>CLOSING BALANCE</strong></td>
                      <td><strong>{formatCurrency(selectedAakda.summary.closing_balance)}</strong></td>
                    </tr>
                  </tbody>
                </table>

                <div className="footer">
                  <p>Haji Mushtaq Nana & Sons | Mandi Accounting App</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BepariAakda;
