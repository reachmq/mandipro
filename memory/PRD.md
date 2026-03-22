# Mandi Accounting System - Product Requirements Document

## Original Problem Statement
Build a software solution for managing accounting in a "Mandi" (livestock wholesale market in Mumbai). The user acts as a Commission Agent (Dalal/Aadatiya) bridging "Bepaaris" (Sellers/Goat owners) and "Dukandars" (Buyers).

**Approach**: Build a "Perfected Excel Prototype" first (Phase 1) to finalize complex accounting logic before transitioning to a full-stack SaaS Web Application (Phase 2).

## Current Phase: Excel Prototyping (Phase 1)

### Latest Version: V9 (December 2024)
**Download**: `/frontend/public/Mandi_Master_V9.xlsx`

### Core Features Implemented

#### Input Sheets (User enters data here):
1. **Masters** - Party master data
   - Bepaari Master (Name, Commission%, Opening Balance, Phone)
   - Dukandar Master (Name, Opening Balance, Phone)
   - Capital/Loan Parties (Name, Opening Balance, Type: CAPITAL/LOAN/AMANAT)
   - Advance Parties
   - Settings (Commission Rate, KK Fixed, JB Rate, Opening Cash/Bank, Zakat Opening)

2. **Daily_Sales** - Daily transactions
   - Date, Bepaari, Dukandar, Qty, Rate, Gross, Discount, Net

3. **Cash_Book** - All cash/bank transactions
   - Type-specific Sub-Type dropdowns (INDIRECT formula)
   - Dynamic Party dropdown based on Type
   - Single Amount column + Mode of Payment (CASH/BANK/UPI/TRANSFER)
   - Auto-calculated Cash/Bank summary

#### Auto-Calculated Sheets:
4. **Bepaari_Ledger** - Full bepaari accounting with deductions
5. **Dukandar_Ledger** - Dukandar receivables tracking
6. **Capital_Loan_Ledger** - NEW: Shows ALL investors/lenders with current balances
7. **Bepaari_Aakda** - Settlement slip generator
8. **Balance_Sheet** - Compact view (no blank rows), pulls from ledgers
9. **Commission_Summary** - Profit/Loss summary

### Key Accounting Logic:
- Commission: 4% default (per-piece override available)
- Deductions: KK (fixed per bepaari), JB (per goat), Motor, Bhussa, Gawali, Cash Advance
- JB Net = Collected - Paid (shown in Liabilities)
- Excess payments: Bepaari overpaid → Asset, Dukandar overpaid → Liability
- Zakat: Provisioned liability, paid out over time

### Technical Implementation:
- Dynamic dropdowns using INDIRECT formula
- Type-specific Sub-Type options
- SUMIF/SUMIFS for ledger calculations
- Named ranges for data validation

## Version History

| Version | Date | Key Changes |
|---------|------|-------------|
| V1-V5 | Mar 2024 | Initial iterations, structure refinement |
| V6 | Mar 2024 | Dependent dropdowns, JB in liabilities, Capital separation |
| V7 | Mar 2024 | Simplified Cash Book (Amount + Mode), removed 4 columns |
| V8 | Mar 2024 | Type-specific Sub-Types, excess payments in Balance Sheet |
| V9 | Dec 2024 | NEW Capital_Loan_Ledger sheet, COMPACT Balance Sheet (no blank rows) |

## Pending User Verification
- V9 Excel functionality testing (user away for couple of days)

## Phase 2: Web Application (Future)

### Planned Tech Stack:
- **Frontend**: React
- **Backend**: FastAPI (Python)
- **Database**: MongoDB

### Migration Plan:
- Masters → MongoDB collections (bepaaris, dukandars, capital_parties, settings)
- Cash_Book → transactions collection with same fields
- Daily_Sales → sales collection
- Ledger calculations → Python functions (same SUMIF logic)
- Balance Sheet → API endpoint returning calculated totals

**Note**: All Excel logic will directly translate to code. No restart needed.

## File Structure
```
/app/
├── backend/
│   ├── generate_mandi_excel.py (V1)
│   ├── generate_mandi_excel_v2.py
│   ├── generate_mandi_excel_v3.py
│   ├── generate_mandi_excel_v4.py
│   ├── generate_mandi_excel_v5.py
│   ├── generate_mandi_excel_v6.py
│   ├── generate_mandi_excel_v7.py
│   ├── generate_mandi_excel_v8.py
│   └── generate_mandi_excel_v9.py (CURRENT)
├── frontend/
│   └── public/
│       └── Mandi_Master_V9.xlsx (CURRENT)
└── memory/
    └── PRD.md (this file)
```

## User Preferences
- Language: English
- Simplified input workflow (only 2 main input sheets)
- Type-specific dropdowns for data entry
- Compact Balance Sheet without blank rows
- Individual party breakdown in separate ledger sheet
