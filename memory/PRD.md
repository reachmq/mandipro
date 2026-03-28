# Mandi Accounting Software - Product Requirements Document

## Original Problem Statement
Build a software solution for managing accounting in a "Mandi" (livestock wholesale market in Mumbai). The user acts as a Commission Agent (Dalal/Aadatiya) bridging "Bepaaris" (Sellers/Goat owners) and "Dukandars" (Buyers).

## Development Phases

### Phase 1: Excel Prototype (CURRENT - IN PROGRESS)
Perfected Excel Prototype with two main input sheets (Daily Sales, Cash Book) that auto-calculates:
- Bepaari/Dukandar Ledgers
- Settlement Slips (Aakda)
- Balance Sheet

### Phase 2: Full-Stack Web Application (FUTURE)
Migrate finalized Excel logic to React + FastAPI + MongoDB application with:
- Multi-user/SaaS capabilities
- Date-wise reporting
- Automated month-end profit distribution
- Journal Voucher (JV) screens
- Audit trail

---

## Current Excel Version: V9.1

### Input Sheets
1. **Daily_Sales** - Records all goat sales (Bepaari → Dukandar)
2. **Cash_Book** - All cash/bank transactions with Type/Sub-Type dropdowns

### Auto-Generated Sheets
- Bepaari_Ledger
- Dukandar_Ledger
- Capital_Loan_Ledger
- Bepaari_Aakda (Settlement calculations)
- Balance_Sheet
- Commission_Summary

### Key Features Implemented
- B/F (Brought Forward) opening balances in Masters sheet
- Flat commission rate (per goat) with override capability
- Type-specific Sub-Type dropdowns using INDIRECT
- Individual party receivables with formula: `Opening + GIVEN - RECEIVED`
- Real-time ledger generation
- Balance Sheet with Assets = Liabilities + Capital validation

---

## Business Logic Summary

### Parties
- **Bepaaris**: Sellers who bring goats (we owe them after sale)
- **Dukandars**: Buyers who purchase goats (they owe us)
- **Advance Parties**: External individuals we give/receive advances from

### Deductions from Bepaari
- Commission (4% or flat per-piece)
- KK (Fixed ₹100 per Bepaari)
- JB (₹10 per goat)
- Motor (transport)
- Bhussa (fodder)
- Gawali (labor)
- Cash Advance

### Balance Sheet Structure
**Liabilities (We Owe):**
- Capital (per investor)
- Loans
- Amanat
- Bepaari Payables
- Dukandar Advances (if overpaid)
- JB Collected
- KK Collected
- Commission Earned
- Zakat Payable

**Assets (We Have/Owed to Us):**
- Cash Balance
- Bank Balance
- Patti (Dukandar Receivable)
- Bepaari Advances (if overpaid)
- Mandi Expenses
- BF Discount
- MHN Personal
- Individual Receivables (Salim, Mudassir, KMN, Santosh, Shakil, Ayaan)

---

## Issues Fixed (Session: 29 March 2025)

### Issue: ₹200,000 Balance Sheet Discrepancy
- **Root Cause**: Cell E11 "ADVANCES GIVEN (Net)" was aggregating ALL advances given/received, duplicating amounts already tracked in individual receivable rows (28-33)
- **Solution**: Cleared contents of cells D11:E11
- **Status**: RESOLVED - Balance Sheet now tallies

---

## Pending Items

### User Testing in Progress
- User is entering real historical data (currently on March 26th)
- Testing against manual paper accounting records

### Future Simplifications Requested
- Sub-Type dropdown simplifications in Cash Book (details TBD)

---

## Files Reference

### Excel Files
- `/app/frontend/public/Mandi_Master_V9.1.xlsx` - Base generated version
- User's local copy with real data (uploaded for debugging)

### Python Generation Scripts
- `/app/backend/generate_mandi_excel_v91.py` - V9.1 generator

---

## Important Notes for Future Agents

1. **DO NOT generate new Excel versions or modify user's files** unless explicitly asked
2. **Provide exact Excel formulas** for user to paste themselves
3. **For debugging**: Ask user to upload file, analyze via read-only Python script, tell them what to change manually
4. User experienced frustration when agent created overly complex versions (V10) and altered business variables without permission

---

## Upcoming Tasks (Priority Order)

1. P0: Continue supporting manual Excel testing (provide formulas on request)
2. P0: Sub-Type dropdown simplifications (when user provides details)
3. P1: Build Full-Stack Web App (after Excel prototype is approved)
4. P2: Multi-user SaaS features

---

*Last Updated: 29 March 2025*
