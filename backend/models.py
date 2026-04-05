from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from enum import Enum
import uuid

class TransactionMode(str, Enum):
    CASH = "CASH"
    BANK = "BANK"
    UPI = "UPI"
    TRANSFER = "TRANSFER"

class CashBookType(str, Enum):
    BEPAARI = "BEPAARI"
    DUKANDAR = "DUKANDAR"
    CAPITAL = "CAPITAL"
    LOAN = "LOAN"
    AMANAT = "AMANAT"
    ADVANCE = "ADVANCE"
    EXPENSE = "EXPENSE"
    ZAKAT = "ZAKAT"

class CashBookSubType(str, Enum):
    PAYMENT = "PAYMENT"
    MOTOR = "MOTOR"
    BHUSSA = "BHUSSA"
    GAWALI = "GAWALI"
    CASH_ADV = "CASH_ADV"
    RECEIPT = "RECEIPT"
    BF_DISC = "BF_DISC"
    TAKEN = "TAKEN"
    REPAID = "REPAID"
    WITHDRAWN = "WITHDRAWN"
    GIVEN = "GIVEN"
    RECEIVED = "RECEIVED"
    MANDI = "MANDI"
    TRAVEL = "TRAVEL"
    FOOD = "FOOD"
    SALARY = "SALARY"
    MISC = "MISC"
    OTHER = "OTHER"
    MHN_PERSONAL = "MHN_PERSONAL"
    JB_PAID = "JB_PAID"
    PROVISION = "PROVISION"
    PAID = "PAID"
    DISCOUNT = "DISCOUNT"

class Bepaari(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    commission_percent: float = 4.0
    flat_rate_per_goat: Optional[float] = None
    opening_balance: float = 0.0
    phone: Optional[str] = None
    is_active: bool = True

class Dukandar(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    opening_balance: float = 0.0
    phone: Optional[str] = None
    is_active: bool = True

class AdvanceParty(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    opening_balance: float = 0.0
    is_active: bool = True

class CapitalPartner(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    partner_type: str
    opening_balance: float = 0.0
    is_active: bool = True

class Settings(BaseModel):
    id: str = "settings"
    commission_rate: float = 4.0
    kk_fixed: float = 100.0
    jb_rate: float = 10.0
    opening_cash: float = 0.0
    opening_bank: float = 0.0
    jb_opening: float = 0.0
    kk_opening: float = 0.0
    zakat_opening: float = 0.0
    commission_opening: float = 0.0
    mandi_exp_opening: float = 0.0
    bf_disc_opening: float = 0.0
    mhn_personal_opening: float = 0.0

class DailySale(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    bepaari_id: str
    bepaari_name: str
    dukandar_id: str
    dukandar_name: str
    quantity: int
    rate: float
    gross_amount: float
    discount: float = 0.0
    net_amount: float

class CashBookEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    type: str
    sub_type: str
    party_id: Optional[str] = None
    party_name: Optional[str] = None
    particulars: Optional[str] = None
    amount: float
    bf_disc: float = 0.0  # Cash discount given (for DUKANDAR RECEIPT)
    mode: str

class DailySaleCreate(BaseModel):
    date: str
    bepaari_id: str
    dukandar_id: str
    quantity: int
    rate: float
    discount: float = 0.0

class CashBookEntryCreate(BaseModel):
    date: str
    type: str
    sub_type: str
    party_id: Optional[str] = None
    particulars: Optional[str] = None
    amount: float
    bf_disc: float = 0.0  # Cash discount given
    mode: str

class MasterCreate(BaseModel):
    name: str
    opening_balance: float = 0.0
    commission_percent: Optional[float] = None
    flat_rate: Optional[float] = None
    partner_type: Optional[str] = None
    phone: Optional[str] = None


# Journal Voucher / Adjustment Entry
class AdjustmentEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    debit_type: str  # BEPAARI, DUKANDAR, ADVANCE, etc.
    debit_party_id: str
    debit_party_name: str
    credit_type: str  # BEPAARI, DUKANDAR, ADVANCE, etc.
    credit_party_id: str
    credit_party_name: str
    amount: float
    narration: Optional[str] = None


class AdjustmentEntryCreate(BaseModel):
    date: str
    debit_type: str
    debit_party_id: str
    credit_type: str
    credit_party_id: str
    amount: float
    narration: Optional[str] = None
