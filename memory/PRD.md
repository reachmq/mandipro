# Mandi Accounting Software - Product Requirements Document

## Original Problem Statement
Build a software solution for managing accounting in a "Mandi" (livestock wholesale market in Mumbai). The user acts as a Commission Agent (Dalal/Aadatiya) bridging "Bepaaris" (Sellers/Goat owners) and "Dukandars" (Buyers).

## Development Phases

### Phase 1: Excel Prototype (COMPLETED)
Perfected Excel Prototype (V9.1) with two main input sheets (Daily Sales, Cash Book) that auto-calculates Bepaari/Dukandar Ledgers, Settlement Slips (Aakda), and Balance Sheet.

### Phase 2: Full-Stack Web Application (CURRENT - IN PROGRESS)
Migrated Excel logic to React + FastAPI + MongoDB application.

**Completed Features:**
- Dashboard with key metrics (Cash, Bank, Patti, Bepaari Payable, Commission)
- Daily Sales entry with Bepaari/Dukandar selection, filters, **EDIT functionality**
- Cash Book with Type-dependent Sub-Type dropdowns, Edit, Search, Sort
- Bepaari Ledger with full deduction calculations, clickable sortable headers
- Dukandar Ledger (Patti) with sortable headers
- Balance Sheet (Assets vs Liabilities) - **Now shows individual Capital/Loans/Amanat investor names**
- Party Statement with date filters & CSV export - **Now includes JV/Adjustments section**
- Masters management (Bepaaris, Dukandars, Advance Parties, Capital Partners) with Edit
- Soft delete functionality for Masters
- Phone number fields for Bepaaris/Dukandars
- Bepaari Aakda (Settlement Slip) - Daily settlement calculations per Bepaari with print functionality
- Adjustments / Journal Voucher (JV) for triangular settlements
- Balance Transfer module for moving balances between parties

---

## Current Architecture

### Tech Stack
- **Frontend**: React (create-react-app)
- **Backend**: FastAPI (Python)
- **Database**: MongoDB (Motor async driver)
- **Styling**: Custom CSS with card-based dashboard

### Key Files
- `/app/backend/server.py` - All API routes
- `/app/backend/models.py` - Pydantic models
- `/app/frontend/src/App.js` - Main React app with routing
- `/app/frontend/src/BepariAakda.js` - Settlement slip component
- `/app/frontend/src/App.css` - Styles

### API Endpoints (all prefixed with /api)
- GET/POST/PUT/DELETE `/bepaaris`, `/dukandars`, `/advance-parties`, `/capital-partners`
- GET/PUT `/settings`
- GET/POST/PUT/DELETE `/daily-sales`
- GET/POST/PUT/DELETE `/cash-book`
- GET/POST/PUT/DELETE `/adjustments`
- POST `/balance-transfer`
- PUT `/cash-book/reassign`
- GET `/bepaari-ledger`, `/dukandar-ledger`
- GET `/balance-sheet`
- GET `/bepaari-aakda?date=YYYY-MM-DD` - Settlement slips
- GET `/party-statement/{party_type}/{party_id}` - **Now includes JV adjustments**
- GET `/export/party-statement/{party_type}/{party_id}` - **CSV now includes adjustments section**

---

## Business Logic Summary

### Parties
- **Bepaaris**: Sellers who bring goats (we owe them after sale)
- **Dukandars**: Buyers who purchase goats (they owe us)
- **Advance Parties**: External individuals we give/receive advances from
- **Capital Partners**: Investors (Capital, Loan, Amanat types)

### Deductions from Bepaari (in Aakda)
- Commission (4% or flat per-piece override)
- KK (Fixed per Bepaari)
- JB (per goat rate)
- Motor, Bhussa, Gawali (from Cash Book)
- Cash Advance

### Balance Sheet Structure
**Liabilities:**
- Capital (individual investor names now shown)
- Loans (individual lender names now shown)
- Amanat (individual names now shown)
- Bepaari Payables
- Dukandar Advances
- JB, KK, Commission totals
- Zakat Payable

**Assets:**
- Cash & Bank Balance
- Patti (Dukandar Receivable)
- Bepaari Advances
- Mandi Expenses, BF Discount, MHN Personal
- Advance Receivables (individual)

---

## Completed Work Log

| Date | Work Done |
|------|-----------|
| Dec 2025 | Migrated from Excel to full-stack web app |
| Dec 2025 | Built Dashboard, Daily Sales, Cash Book, Ledgers, Balance Sheet |
| Dec 2025 | Added Party Statement with CSV export |
| Dec 2025 | Added phone numbers to Masters |
| 04 Dec 2025 | Fixed Bepaari Aakda 404 error |
| 04 Dec 2025 | Added EDIT button/modal for Masters |
| 04 Dec 2025 | Added Adjustments/Journal Voucher (JV) feature |
| 04 Dec 2025 | Added Balance Transfer module |
| 04 Dec 2025 | Added Search, Sort, Edit to Cash Book and Adjustments |
| 04 Dec 2025 | Fixed BF_Disc double-deduction bug |
| 04 Dec 2025 | Balance Sheet perfectly tallied |
| 08 Apr 2026 | Added Daily Sales Edit button and modal |
| 08 Apr 2026 | Party Statement now includes JV/Adjustments entries |
| 08 Apr 2026 | Balance Sheet shows individual Capital/Loans/Amanat investor names |
| 08 Apr 2026 | CSV export includes adjustments section |
| 08 Apr 2026 | **CRITICAL FIX: Balance Transfers now create audit records in `balance_transfers` collection** |
| 08 Apr 2026 | Party Statement now includes Balance Transfers section (IN/OUT) |
| 08 Apr 2026 | Added `/api/balance-transfers/backfill` endpoint for retroactive record creation |
| 08 Apr 2026 | Backfilled Siraj Kurla → Lala Andheri transfer (₹1,59,000) |

---

## Upcoming Tasks (Priority Order)

### P1 - High Priority
1. **Month-end Closing Workflow**
   - Calculate distributable profit (Commission - Expenses - Provisions)
   - Adjust balances and carry forward to next month

2. **Advance Repayment / JV Tracking**
   - Handle "Junaid Amanat" scenario (₹10K weekly repayment from sales)
   - Link Amanat accounts to main Bepaari accounts

### P2 - Future/Backlog
1. WhatsApp/SMS Integration for outstanding reports
2. Multi-user SaaS features (Role-based access)
3. Multiple Mandi management
4. Audit trail for all transactions

---

## Important Notes for Future Agents

1. All backend routes MUST be defined BEFORE `app.include_router(api_router)` or they won't be registered
2. Always exclude `_id` from MongoDB responses using `serialize_doc()` helper
3. User has REAL DATA in the database - do not add test records without cleaning up
4. The Balance Sheet is currently **PERFECTLY TALLIED** (diff=0, ₹78,85,496) - do not break this
5. Settings (commission rate, KK fixed, JB rate) are stored in MongoDB `settings` collection
6. Party Statement now returns `adjustments` array with JV entries and `total_adjustments` in summary
7. Balance Sheet returns `capital_list`, `loans_list`, `amanat_list` arrays for individual investor breakdown
8. **Balance Transfers now create records in `balance_transfers` collection** - these show in Party Statement
9. Use `/api/balance-transfers/backfill` endpoint to create audit records for past transfers (does NOT modify balances)

---

*Last Updated: 08 April 2026*
