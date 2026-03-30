# Mandi Accounting Software - Product Requirements Document

## Original Problem Statement
Build a software solution for managing accounting in a "Mandi" (livestock wholesale market in Mumbai). The user acts as a Commission Agent (Dalal/Aadatiya) bridging "Bepaaris" (Sellers/Goat owners) and "Dukandars" (Buyers).

## Development Phases

### Phase 1: Excel Prototype (CURRENT - IN PROGRESS)
Perfected Excel Prototype with two main input sheets (Daily Sales, Cash Book) that auto-calculates:
- Bepaari/Dukandar Ledgers
- Settlement Slips (Aakda)
- Balance Sheet

**Status:** User actively testing with real data. Month-end closing scheduled for 31st March 2025.

### Phase 2: Full-Stack Web Application (FUTURE)
Migrate finalized Excel logic to React + FastAPI + MongoDB application with:
- Multi-user/SaaS capabilities
- Date-wise reporting
- Automated month-end profit distribution
- Journal Voucher (JV) screens
- Audit trail
- Advance repayment tracking (see deferred features)

---

## Current Excel Version: V9.1

### Input Sheets
1. **Daily_Sales** - Records all goat sales (Bepaari → Dukandar)
2. **Cash_Book** - All cash/bank transactions with Type/Sub-Type dropdowns

### Auto-Generated Sheets
- Bepaari_Ledger
- Dukandar_Ledger (extended to 100 rows)
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
- Extended Dukandar_Ledger to support 100 Dukandars
- Named range DUKANDAR expanded to J3:J150

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

### Issue 1: Balance Sheet ₹200,000 Discrepancy (26 Mar data)
- **Root Cause**: Cell E11 "ADVANCES GIVEN (Net)" was double-counting advances
- **Solution**: Cleared contents of cells D11:E11
- **Status**: RESOLVED

### Issue 2: PATTI Missing ₹6,15,150 (28 Mar data)
- **Root Cause**: 5 new Dukandars (RAMESH KALAL, IMRAN MUMBRA, JAVED THANA, SHAHNAWAZ, PAROLA) added to Masters but Dukandar_Ledger only had 50 rows
- **Solution**: Added rows 54-58 with proper formulas for these Dukandars
- **Status**: RESOLVED

### Issue 3: Commission ₹2,100 Extra
- **Root Cause**: Same 5 Dukandars had discounts not being captured
- **Solution**: Fixed automatically when Dukandar_Ledger was extended
- **Status**: RESOLVED

### Issue 4: Future-proofing Dukandar_Ledger
- **Solution**: Extended Dukandar_Ledger to support 100 Dukandars (rows 4-103), updated TOTAL row to 104, updated Balance Sheet references
- **Status**: RESOLVED

### Issue 5: Total Liabilities ₹10,000 Difference
- **Root Cause**: User has manual adjustment for JUNAID AMANAT (₹10,000 weekly repayment from ₹100,000 advance)
- **Status**: NOTED - Deferred to Phase 2 as "Advance Repayment Feature"

---

## Deferred Features (For Phase 2 Web App)

### Advance Repayment/Adjustment Feature
**Business Scenario:** JUNAID has taken ₹100,000 advance (tracked as JUNAID AMANAT with -₹100,000 balance). He repays ₹10,000 weekly which should:
1. Reduce JUNAID AMANAT from -₹100,000 to -₹90,000
2. Reduce JUNAID's payable from ₹171,818 to ₹161,818

**Required Features:**
- Link "Amanat" accounts to main Bepaari accounts
- Automatic/manual periodic deductions
- Adjustment entries (JV) that debit advance and credit payable
- Audit trail for all adjustments

---

## Files Reference

### Excel Files
- `/app/frontend/public/Mandi_Master_V9.1.xlsx` - Base generated version
- User's local copy with real data (latest uploaded: 29 Mar 2025)

### Python Generation Scripts
- `/app/backend/generate_mandi_excel_v91.py` - V9.1 generator

---

## Important Notes for Future Agents

1. **DO NOT generate new Excel versions or modify user's files** unless explicitly asked
2. **Provide exact Excel formulas** for user to paste themselves
3. **For debugging**: Ask user to upload file, analyze via read-only Python script, tell them what to change manually
4. User experienced frustration when agent created overly complex versions or altered business variables without permission
5. When adding new Dukandars/Bepaaris, ensure corresponding Ledger rows exist with proper formulas

---

## Upcoming Tasks (Priority Order)

1. **P0**: Month-end closing on 31st March 2025 - User will test commission distribution, expense deductions, B/F adjustments
2. **P0**: Support any issues during month-end closing
3. **P1**: Build Full-Stack Web App (after Excel prototype is fully approved)
4. **P2**: Multi-user SaaS features
5. **P2**: Advance repayment tracking feature

---

## Testing Checkpoints

| Date | Test | Status |
|------|------|--------|
| 26 Mar 2025 | Daily Sales + Cash Book entry | ✅ Passed |
| 28 Mar 2025 | New Dukandars + Discounts | ✅ Passed (after fixes) |
| 29 Mar 2025 | Balance Sheet tally | ✅ Passed |
| 31 Mar 2025 | Month-end closing | ⏳ Pending |

---

*Last Updated: 29 March 2025*
