from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from typing import List, Optional
from datetime import datetime
from models import (
    Bepaari, Dukandar, AdvanceParty, CapitalPartner, Settings,
    DailySale, CashBookEntry, DailySaleCreate, CashBookEntryCreate, MasterCreate
)
import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Mandi Accounting System")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def serialize_doc(doc):
    if doc and "_id" in doc:
        del doc["_id"]
    return doc

def serialize_docs(docs):
    return [serialize_doc(d) for d in docs]


# ============== SETTINGS ==============
@api_router.get("/settings")
async def get_settings():
    settings = await db.settings.find_one({"id": "settings"})
    if not settings:
        default = Settings().model_dump()
        await db.settings.insert_one(default)
        return default
    return serialize_doc(settings)

@api_router.put("/settings")
async def update_settings(updates: dict):
    updates["updated_at"] = datetime.utcnow().isoformat()
    await db.settings.update_one({"id": "settings"}, {"$set": updates}, upsert=True)
    return await get_settings()


# ============== BEPAARI ==============
@api_router.get("/bepaaris")
async def get_bepaaris():
    bepaaris = await db.bepaaris.find({"is_active": True}).to_list(500)
    return serialize_docs(bepaaris)

@api_router.post("/bepaaris")
async def create_bepaari(data: MasterCreate):
    bepaari = Bepaari(
        name=data.name,
        opening_balance=data.opening_balance,
        commission_percent=data.commission_percent or 4.0,
        flat_rate_per_goat=data.flat_rate,
        phone=data.phone
    )
    doc = bepaari.model_dump()
    doc["created_at"] = datetime.utcnow().isoformat()
    await db.bepaaris.insert_one(doc)
    return {"id": bepaari.id, "name": bepaari.name}

@api_router.delete("/bepaaris/{bepaari_id}")
async def delete_bepaari(bepaari_id: str):
    await db.bepaaris.update_one({"id": bepaari_id}, {"$set": {"is_active": False}})
    return {"status": "deleted"}


# ============== DUKANDAR ==============
@api_router.get("/dukandars")
async def get_dukandars():
    dukandars = await db.dukandars.find({"is_active": True}).to_list(500)
    return serialize_docs(dukandars)

@api_router.post("/dukandars")
async def create_dukandar(data: MasterCreate):
    dukandar = Dukandar(
        name=data.name,
        opening_balance=data.opening_balance,
        phone=data.phone
    )
    doc = dukandar.model_dump()
    doc["created_at"] = datetime.utcnow().isoformat()
    await db.dukandars.insert_one(doc)
    return {"id": dukandar.id, "name": dukandar.name}

@api_router.delete("/dukandars/{dukandar_id}")
async def delete_dukandar(dukandar_id: str):
    await db.dukandars.update_one({"id": dukandar_id}, {"$set": {"is_active": False}})
    return {"status": "deleted"}


# ============== ADVANCE PARTIES ==============
@api_router.get("/advance-parties")
async def get_advance_parties():
    parties = await db.advance_parties.find({"is_active": True}).to_list(100)
    return serialize_docs(parties)

@api_router.post("/advance-parties")
async def create_advance_party(data: MasterCreate):
    party = AdvanceParty(name=data.name, opening_balance=data.opening_balance)
    doc = party.model_dump()
    doc["created_at"] = datetime.utcnow().isoformat()
    await db.advance_parties.insert_one(doc)
    return {"id": party.id, "name": party.name}


# ============== CAPITAL PARTNERS ==============
@api_router.get("/capital-partners")
async def get_capital_partners():
    partners = await db.capital_partners.find({"is_active": True}).to_list(100)
    return serialize_docs(partners)

@api_router.post("/capital-partners")
async def create_capital_partner(data: MasterCreate):
    partner = CapitalPartner(
        name=data.name,
        partner_type=data.partner_type or "CAPITAL",
        opening_balance=data.opening_balance
    )
    doc = partner.model_dump()
    doc["created_at"] = datetime.utcnow().isoformat()
    await db.capital_partners.insert_one(doc)
    return {"id": partner.id, "name": partner.name}


# ============== DAILY SALES ==============
@api_router.get("/daily-sales")
async def get_daily_sales(date: Optional[str] = None):
    query = {}
    if date:
        query["date"] = date
    sales = await db.daily_sales.find(query).sort("date", -1).to_list(1000)
    return serialize_docs(sales)

@api_router.post("/daily-sales")
async def create_daily_sale(data: DailySaleCreate):
    bepaari = await db.bepaaris.find_one({"id": data.bepaari_id})
    dukandar = await db.dukandars.find_one({"id": data.dukandar_id})
    
    if not bepaari or not dukandar:
        raise HTTPException(status_code=400, detail="Invalid bepaari or dukandar ID")
    
    gross = data.quantity * data.rate
    net = gross - data.discount
    
    sale = DailySale(
        date=data.date,
        bepaari_id=data.bepaari_id,
        bepaari_name=bepaari["name"],
        dukandar_id=data.dukandar_id,
        dukandar_name=dukandar["name"],
        quantity=data.quantity,
        rate=data.rate,
        gross_amount=gross,
        discount=data.discount,
        net_amount=net
    )
    doc = sale.model_dump()
    doc["created_at"] = datetime.utcnow().isoformat()
    await db.daily_sales.insert_one(doc)
    return serialize_doc(doc)

@api_router.delete("/daily-sales/{sale_id}")
async def delete_daily_sale(sale_id: str):
    await db.daily_sales.delete_one({"id": sale_id})
    return {"status": "deleted"}


# ============== CASH BOOK ==============
@api_router.get("/cash-book")
async def get_cash_book(date: Optional[str] = None):
    query = {}
    if date:
        query["date"] = date
    entries = await db.cash_book.find(query).sort("date", -1).to_list(2000)
    return serialize_docs(entries)

@api_router.post("/cash-book")
async def create_cash_book_entry(data: CashBookEntryCreate):
    party_name = None
    if data.party_id:
        for coll in ["bepaaris", "dukandars", "advance_parties", "capital_partners"]:
            party = await db[coll].find_one({"id": data.party_id})
            if party:
                party_name = party.get("name")
                break
    
    entry = CashBookEntry(
        date=data.date,
        type=data.type,
        sub_type=data.sub_type,
        party_id=data.party_id,
        party_name=party_name,
        particulars=data.particulars,
        amount=data.amount,
        mode=data.mode
    )
    doc = entry.model_dump()
    doc["created_at"] = datetime.utcnow().isoformat()
    await db.cash_book.insert_one(doc)
    return serialize_doc(doc)

@api_router.delete("/cash-book/{entry_id}")
async def delete_cash_book_entry(entry_id: str):
    await db.cash_book.delete_one({"id": entry_id})
    return {"status": "deleted"}


# ============== BEPAARI LEDGER ==============
@api_router.get("/bepaari-ledger")
async def get_bepaari_ledger():
    bepaaris = await db.bepaaris.find({"is_active": True}).to_list(500)
    sales = await db.daily_sales.find({}).to_list(5000)
    cash_entries = await db.cash_book.find({"type": "BEPAARI"}).to_list(5000)
    settings = await get_settings()
    
    ledger = []
    for b in serialize_docs(bepaaris):
        b_sales = [s for s in serialize_docs(sales) if s["bepaari_id"] == b["id"]]
        b_cash = [c for c in serialize_docs(cash_entries) if c.get("party_id") == b["id"]]
        
        gross = sum(s["gross_amount"] for s in b_sales)
        qty = sum(s["quantity"] for s in b_sales)
        
        if b.get("flat_rate_per_goat"):
            commission = b["flat_rate_per_goat"] * qty
        else:
            commission = gross * (b.get("commission_percent", settings.get("commission_rate", 4)) / 100)
        
        kk = settings.get("kk_fixed", 100) if qty > 0 else 0
        jb = qty * settings.get("jb_rate", 10)
        
        motor = sum(c["amount"] for c in b_cash if c.get("sub_type") == "MOTOR")
        bhussa = sum(c["amount"] for c in b_cash if c.get("sub_type") == "BHUSSA")
        gawali = sum(c["amount"] for c in b_cash if c.get("sub_type") == "GAWALI")
        cash_adv = sum(c["amount"] for c in b_cash if c.get("sub_type") == "CASH_ADV")
        payments = sum(c["amount"] for c in b_cash if c.get("sub_type") == "PAYMENT")
        
        total_ded = commission + kk + jb + motor + bhussa + gawali + cash_adv
        net_payable = b.get("opening_balance", 0) + gross - total_ded
        balance = net_payable - payments
        
        ledger.append({
            "id": b["id"],
            "name": b["name"],
            "opening": b.get("opening_balance", 0),
            "gross_sales": gross,
            "quantity": qty,
            "commission": commission,
            "kk": kk,
            "jb": jb,
            "motor": motor,
            "bhussa": bhussa,
            "gawali": gawali,
            "cash_adv": cash_adv,
            "total_deductions": total_ded,
            "net_payable": net_payable,
            "payments": payments,
            "balance": balance
        })
    
    return ledger


# ============== DUKANDAR LEDGER ==============
@api_router.get("/dukandar-ledger")
async def get_dukandar_ledger():
    dukandars = await db.dukandars.find({"is_active": True}).to_list(500)
    sales = await db.daily_sales.find({}).to_list(5000)
    cash_entries = await db.cash_book.find({"type": "DUKANDAR"}).to_list(5000)
    
    ledger = []
    for d in serialize_docs(dukandars):
        d_sales = [s for s in serialize_docs(sales) if s["dukandar_id"] == d["id"]]
        d_cash = [c for c in serialize_docs(cash_entries) if c.get("party_id") == d["id"]]
        
        purchases = sum(s["gross_amount"] for s in d_sales)
        discounts = sum(s["discount"] for s in d_sales)
        receipts = sum(c["amount"] for c in d_cash if c.get("sub_type") == "RECEIPT")
        
        net_receivable = d.get("opening_balance", 0) + purchases - discounts
        balance = net_receivable - receipts
        
        ledger.append({
            "id": d["id"],
            "name": d["name"],
            "opening": d.get("opening_balance", 0),
            "purchases": purchases,
            "discounts": discounts,
            "net_receivable": net_receivable,
            "receipts": receipts,
            "balance": balance
        })
    
    return ledger


# ============== BALANCE SHEET ==============
@api_router.get("/balance-sheet")
async def get_balance_sheet():
    settings = await get_settings()
    bepaari_ledger = await get_bepaari_ledger()
    dukandar_ledger = await get_dukandar_ledger()
    cash_entries = serialize_docs(await db.cash_book.find({}).to_list(5000))
    capital_partners = serialize_docs(await db.capital_partners.find({"is_active": True}).to_list(100))
    advance_parties = serialize_docs(await db.advance_parties.find({"is_active": True}).to_list(100))
    
    capital = sum(p.get("opening_balance", 0) for p in capital_partners if p.get("partner_type") == "CAPITAL")
    loans = sum(p.get("opening_balance", 0) for p in capital_partners if p.get("partner_type") == "LOAN")
    amanat = sum(p.get("opening_balance", 0) for p in capital_partners if p.get("partner_type") == "AMANAT")
    
    for c in cash_entries:
        t, st, amt = c.get("type"), c.get("sub_type"), c.get("amount", 0)
        if t == "CAPITAL":
            if st == "TAKEN": capital += amt
            elif st in ["REPAID", "WITHDRAWN"]: capital -= amt
        elif t == "LOAN":
            if st == "TAKEN": loans += amt
            elif st == "REPAID": loans -= amt
        elif t == "AMANAT":
            if st == "TAKEN": amanat += amt
            elif st == "REPAID": amanat -= amt
    
    bepaari_payables = sum(b["balance"] for b in bepaari_ledger if b["balance"] > 0)
    bepaari_advances = sum(-b["balance"] for b in bepaari_ledger if b["balance"] < 0)
    patti = sum(d["balance"] for d in dukandar_ledger if d["balance"] > 0)
    dukandar_advances = sum(-d["balance"] for d in dukandar_ledger if d["balance"] < 0)
    
    jb_collected = sum(b["jb"] for b in bepaari_ledger)
    kk_collected = sum(b["kk"] for b in bepaari_ledger)
    commission_earned = sum(b["commission"] for b in bepaari_ledger)
    discounts_given = sum(d["discounts"] for d in dukandar_ledger)
    
    jb_paid = sum(c["amount"] for c in cash_entries if c.get("sub_type") == "JB_PAID")
    jb_total = settings.get("jb_opening", 0) + jb_collected - jb_paid
    kk_total = settings.get("kk_opening", 0) + kk_collected
    commission_total = settings.get("commission_opening", 0) + commission_earned - discounts_given
    
    zakat_prov = sum(c["amount"] for c in cash_entries if c.get("type") == "ZAKAT" and c.get("sub_type") == "PROVISION")
    zakat_paid = sum(c["amount"] for c in cash_entries if c.get("type") == "ZAKAT" and c.get("sub_type") == "PAID")
    zakat_total = settings.get("zakat_opening", 0) + zakat_prov - zakat_paid
    
    cash_in_types = ["RECEIPT", "TAKEN", "RECEIVED"]
    cash_in = sum(c["amount"] for c in cash_entries if c.get("mode") == "CASH" and c.get("sub_type") in cash_in_types)
    cash_out = sum(c["amount"] for c in cash_entries if c.get("mode") == "CASH" and c.get("sub_type") not in cash_in_types)
    cash_balance = settings.get("opening_cash", 0) + cash_in - cash_out
    
    bank_modes = ["BANK", "UPI", "TRANSFER"]
    bank_in = sum(c["amount"] for c in cash_entries if c.get("mode") in bank_modes and c.get("sub_type") in cash_in_types)
    bank_out = sum(c["amount"] for c in cash_entries if c.get("mode") in bank_modes and c.get("sub_type") not in cash_in_types)
    bank_balance = settings.get("opening_bank", 0) + bank_in - bank_out
    
    exp_types = ["MANDI", "TRAVEL", "FOOD", "SALARY", "MISC", "OTHER"]
    mandi_exp = sum(c["amount"] for c in cash_entries if c.get("sub_type") in exp_types)
    bf_disc = sum(c["amount"] for c in cash_entries if c.get("sub_type") == "BF_DISC")
    mhn_personal = sum(c["amount"] for c in cash_entries if c.get("sub_type") == "MHN_PERSONAL")
    
    mandi_total = settings.get("mandi_exp_opening", 0) + mandi_exp
    bf_disc_total = settings.get("bf_disc_opening", 0) + bf_disc
    mhn_total = settings.get("mhn_personal_opening", 0) + mhn_personal
    
    adv_receivables = []
    for ap in advance_parties:
        given = sum(c["amount"] for c in cash_entries if c.get("type") == "ADVANCE" and c.get("sub_type") == "GIVEN" and c.get("party_name") == ap["name"])
        received = sum(c["amount"] for c in cash_entries if c.get("type") == "ADVANCE" and c.get("sub_type") == "RECEIVED" and c.get("party_name") == ap["name"])
        bal = ap.get("opening_balance", 0) + given - received
        if bal != 0:
            adv_receivables.append({"name": ap["name"], "amount": bal})
    
    adv_total = sum(a["amount"] for a in adv_receivables if a["amount"] > 0)
    
    total_liab = capital + loans + amanat + bepaari_payables + dukandar_advances + jb_total + kk_total + commission_total + zakat_total
    total_assets = cash_balance + bank_balance + patti + bepaari_advances + mandi_total + bf_disc_total + mhn_total + adv_total
    
    return {
        "liabilities": {
            "capital": capital, "loans": loans, "amanat": amanat,
            "bepaari_payables": bepaari_payables, "dukandar_advances": dukandar_advances,
            "jb": {"bf": settings.get("jb_opening", 0), "collected": jb_collected, "paid": jb_paid, "total": jb_total},
            "kk": {"bf": settings.get("kk_opening", 0), "collected": kk_collected, "total": kk_total},
            "commission": {"bf": settings.get("commission_opening", 0), "earned": commission_earned, "discounts": discounts_given, "total": commission_total},
            "zakat": zakat_total, "total": total_liab
        },
        "assets": {
            "cash_balance": cash_balance, "bank_balance": bank_balance,
            "patti": patti, "bepaari_advances": bepaari_advances,
            "mandi_expenses": {"bf": settings.get("mandi_exp_opening", 0), "current": mandi_exp, "total": mandi_total},
            "bf_discount": {"bf": settings.get("bf_disc_opening", 0), "current": bf_disc, "total": bf_disc_total},
            "mhn_personal": {"bf": settings.get("mhn_personal_opening", 0), "current": mhn_personal, "total": mhn_total},
            "advance_receivables": adv_receivables, "total": total_assets
        },
        "difference": total_liab - total_assets
    }


@api_router.get("/dashboard")
async def get_dashboard():
    today = datetime.utcnow().strftime("%Y-%m-%d")
    today_sales = serialize_docs(await db.daily_sales.find({"date": today}).to_list(100))
    balance_sheet = await get_balance_sheet()
    
    return {
        "today": {"sales_count": len(today_sales), "sales_amount": sum(s["gross_amount"] for s in today_sales)},
        "summary": {
            "cash_balance": balance_sheet["assets"]["cash_balance"],
            "bank_balance": balance_sheet["assets"]["bank_balance"],
            "patti": balance_sheet["assets"]["patti"],
            "bepaari_payable": balance_sheet["liabilities"]["bepaari_payables"],
            "balance_diff": balance_sheet["difference"]
        }
    }


app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
