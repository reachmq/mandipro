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
            body { font-family: Arial, sans-serif; padding: 20px; }
            .aakda-slip { border: 2px solid #333; padding: 20px; max-width: 400px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
            .header h2 { margin: 0; font-size: 18px; }
            .header p { margin: 5px 0; font-size: 12px; color: #666; }
            .party-info { font-size: 16px; font-weight: bold; margin-bottom: 15px; }
            .sales-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px; }
            .sales-table th, .sales-table td { border: 1px solid #ddd; padding: 5px; text-align: left; }
            .sales-table th { background: #f5f5f5; }
            .summary-table { width: 100%; font-size: 13px; }
            .summary-table td { padding: 4px 0; }
            .summary-table td:last-child { text-align: right; font-weight: 500; }
            .total-row { border-top: 2px solid #333; font-weight: bold; font-size: 14px; }
            .closing-row { background: #f0f0f0; font-size: 16px; }
            .deduction { color: #c00; }
            .footer { text-align: center; margin-top: 15px; font-size: 10px; color: #666; border-top: 1px dashed #999; padding-top: 10px; }
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
                  <h2>BEPAARI AAKDA</h2>
                  <p>Settlement Slip</p>
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
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{selectedAakda.summary.quantity}</td>
                      <td>{formatCurrency(selectedAakda.summary.gross_sales)}</td>
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
                  <p>Thank you for your business!</p>
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
