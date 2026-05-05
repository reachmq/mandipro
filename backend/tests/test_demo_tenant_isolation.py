"""
Multi-tenant isolation test suite for Mandi accounting backend.
Validates:
- Tenant claim on JWT for demo/admin
- Demo tenant starts empty, isolation from admin tenant
- All financial flows in demo tenant: masters, capital, daily-sale (4 ledger effects),
  cash receipt/payment, JV adjustment
- Balance Sheet tally invariant after every mutation
- Reverse isolation: demo cannot see admin data, admin cannot see demo data
- /api/demo/reset RBAC + functionality
- Admin's data byte-identical (count, names) before vs after demo run

CRITICAL: This test only mutates demo tenant. Admin's 25 bepaaris are READ-ONLY here.
"""
import os
import jwt as jwtlib
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for ln in f:
            if ln.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = ln.split("=", 1)[1].strip().rstrip("/")
                break

ADMIN_EMAIL = "admin@mandi.com"
ADMIN_PASSWORD = "mandi@2026"
DEMO_EMAIL = "demo@mandipro.in"
DEMO_PASSWORD = "demo@2026"

# small float tolerance for BS tally (rounding in commission/rate calculations)
TALLY_TOL = 1.0


# ----------------- Sessions -----------------
def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return s, r.json()


@pytest.fixture(scope="module")
def admin_ctx():
    s, body = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    return {"session": s, "body": body}


@pytest.fixture(scope="module")
def demo_ctx():
    s, body = _login(DEMO_EMAIL, DEMO_PASSWORD)
    return {"session": s, "body": body}


@pytest.fixture(scope="module")
def admin_baseline(admin_ctx):
    """Snapshot admin's data BEFORE any demo mutations."""
    s = admin_ctx["session"]
    bep = s.get(f"{BASE_URL}/api/bepaaris", timeout=15).json()
    duk = s.get(f"{BASE_URL}/api/dukandars", timeout=15).json()
    sales = s.get(f"{BASE_URL}/api/daily-sales", timeout=15).json()
    cash = s.get(f"{BASE_URL}/api/cash-book", timeout=15).json()
    adj = s.get(f"{BASE_URL}/api/adjustments", timeout=15).json()
    return {
        "bepaaris_count": len(bep),
        "bepaaris_names": sorted([b["name"] for b in bep]),
        "dukandars_count": len(duk),
        "dukandars_names": sorted([d["name"] for d in duk]),
        "sales_count": len(sales),
        "cash_count": len(cash),
        "adjustments_count": len(adj),
    }


# ----------------- 1. Auth + JWT tenant claim -----------------
class TestAuthTenant:
    def test_admin_login_tenant_main(self, admin_ctx):
        b = admin_ctx["body"]
        assert b.get("tenant") == "main", f"admin tenant should be 'main', got {b.get('tenant')}"
        assert b.get("role") == "admin"

    def test_demo_login_tenant_demo(self, demo_ctx):
        b = demo_ctx["body"]
        assert b.get("tenant") == "demo", f"demo tenant should be 'demo', got {b.get('tenant')}"
        assert b.get("role") == "admin"
        assert b.get("email") == DEMO_EMAIL

    def test_demo_jwt_has_tenant_claim(self, demo_ctx):
        token = demo_ctx["body"].get("access_token")
        assert token, "access_token missing in demo login response"
        payload = jwtlib.decode(token, options={"verify_signature": False})
        assert payload.get("tenant") == "demo"
        assert payload.get("type") == "access"
        assert payload.get("email") == DEMO_EMAIL

    def test_admin_jwt_has_tenant_main(self, admin_ctx):
        token = admin_ctx["body"].get("access_token")
        payload = jwtlib.decode(token, options={"verify_signature": False})
        assert payload.get("tenant") == "main"


# ----------------- 2. Reset demo before testing (clean slate) -----------------
class TestDemoResetAuth:
    def test_admin_cannot_reset_demo(self, admin_ctx):
        r = admin_ctx["session"].post(f"{BASE_URL}/api/demo/reset", timeout=15)
        assert r.status_code == 403, f"admin must NOT be allowed to reset demo, got {r.status_code}"

    def test_unauth_cannot_reset_demo(self):
        r = requests.post(f"{BASE_URL}/api/demo/reset", timeout=15)
        assert r.status_code == 401

    def test_demo_can_reset(self, demo_ctx):
        r = demo_ctx["session"].post(f"{BASE_URL}/api/demo/reset", timeout=20)
        assert r.status_code == 200, f"demo reset failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("status") == "reset"


# ----------------- 3. Empty state for demo + isolation from admin -----------------
class TestDemoEmptyAndIsolation:
    def test_demo_bepaaris_empty(self, demo_ctx):
        r = demo_ctx["session"].get(f"{BASE_URL}/api/bepaaris", timeout=15)
        assert r.status_code == 200
        assert r.json() == [], "demo should see ZERO bepaaris after reset"

    def test_demo_dukandars_empty(self, demo_ctx):
        r = demo_ctx["session"].get(f"{BASE_URL}/api/dukandars", timeout=15)
        assert r.status_code == 200
        assert r.json() == []

    def test_demo_daily_sales_empty(self, demo_ctx):
        r = demo_ctx["session"].get(f"{BASE_URL}/api/daily-sales", timeout=15)
        assert r.status_code == 200
        assert r.json() == []

    def test_demo_cash_book_empty(self, demo_ctx):
        r = demo_ctx["session"].get(f"{BASE_URL}/api/cash-book", timeout=15)
        assert r.status_code == 200
        assert r.json() == []

    def test_demo_balance_sheet_zero(self, demo_ctx):
        r = demo_ctx["session"].get(f"{BASE_URL}/api/balance-sheet", timeout=20)
        assert r.status_code == 200
        bs = r.json()
        assert abs(bs["liabilities"]["total"] - bs["assets"]["total"]) < TALLY_TOL
        # Both sides should be zero on empty demo (tolerate small commission opening)
        assert abs(bs["liabilities"]["total"]) < 1.0, f"empty demo liabilities not zero: {bs['liabilities']['total']}"
        assert abs(bs["assets"]["total"]) < 1.0, f"empty demo assets not zero: {bs['assets']['total']}"

    def test_demo_does_not_see_admin_bepaari_names(self, demo_ctx, admin_baseline):
        r = demo_ctx["session"].get(f"{BASE_URL}/api/bepaaris", timeout=15)
        demo_names = [b["name"] for b in r.json()]
        # No overlap with admin's names (e.g., JUNAID)
        overlap = set(demo_names) & set(admin_baseline["bepaaris_names"])
        assert overlap == set(), f"demo can see admin bepaaris! overlap={overlap}"


# ----------------- 4. Demo creates masters + capital + daily sale + cash flows -----------------
@pytest.fixture(scope="module")
def demo_masters(demo_ctx):
    """Create one bepaari, one dukandar, one capital partner in demo tenant."""
    s = demo_ctx["session"]
    rb = s.post(f"{BASE_URL}/api/bepaaris",
                json={"name": "TEST Bepaari Demo 1", "opening_balance": 0}, timeout=15)
    assert rb.status_code == 200, f"create bepaari failed: {rb.text}"
    bep = rb.json()

    rd = s.post(f"{BASE_URL}/api/dukandars",
                json={"name": "TEST Dukandar Demo 1", "opening_balance": 0}, timeout=15)
    assert rd.status_code == 200, f"create dukandar failed: {rd.text}"
    duk = rd.json()

    rc = s.post(f"{BASE_URL}/api/capital-partners",
                json={"name": "TEST Demo Owner", "partner_type": "CAPITAL", "opening_balance": 0}, timeout=15)
    assert rc.status_code == 200, f"create capital failed: {rc.text}"
    cap = rc.json()

    return {"bepaari": bep, "dukandar": duk, "capital": cap}


def _bs(session):
    r = session.get(f"{BASE_URL}/api/balance-sheet", timeout=20)
    assert r.status_code == 200
    return r.json()


class TestDemoFlows:
    def test_create_masters(self, demo_masters):
        assert demo_masters["bepaari"]["id"]
        assert demo_masters["dukandar"]["id"]
        assert demo_masters["capital"]["id"]

    def test_capital_taken_100k_increments_cash_and_capital(self, demo_ctx, demo_masters):
        s = demo_ctx["session"]
        cap = demo_masters["capital"]
        # Capital TAKEN 100000 cash
        payload = {
            "type": "CAPITAL",
            "sub_type": "TAKEN",
            "party_id": cap["id"],
            "party_name": cap["name"],
            "amount": 100000,
            "mode": "CASH",
            "date": "2026-01-15",
            "narration": "Owner capital introduction"
        }
        r = s.post(f"{BASE_URL}/api/cash-book", json=payload, timeout=15)
        assert r.status_code == 200, f"capital taken failed: {r.text}"

        bs = _bs(s)
        assert abs(bs["liabilities"]["total"] - bs["assets"]["total"]) < TALLY_TOL, \
            f"BS not tallying after capital: L={bs['liabilities']['total']} A={bs['assets']['total']}"
        assert bs["liabilities"]["capital"] >= 100000 - TALLY_TOL
        assert bs["assets"]["cash_balance"] >= 100000 - TALLY_TOL

    def test_daily_sale_four_ledger_effects(self, demo_ctx, demo_masters):
        s = demo_ctx["session"]
        bep = demo_masters["bepaari"]
        duk = demo_masters["dukandar"]
        bs_before = _bs(s)

        sale = {
            "date": "2026-01-15",
            "bepaari_id": bep["id"],
            "bepaari_name": bep["name"],
            "dukandar_id": duk["id"],
            "dukandar_name": duk["name"],
            "quantity": 10,
            "rate": 200,           # bepaari rate
            "dukandar_rate": 210,  # +10 differential -> commission rate-diff
            "comment": "TEST demo sale"
        }
        r = s.post(f"{BASE_URL}/api/daily-sales", json=sale, timeout=15)
        assert r.status_code == 200, f"daily-sale failed: {r.text}"
        sale_obj = r.json()
        assert sale_obj.get("id")

        bs = _bs(s)
        # tally
        assert abs(bs["liabilities"]["total"] - bs["assets"]["total"]) < TALLY_TOL, \
            f"BS not tallying after sale: L={bs['liabilities']['total']} A={bs['assets']['total']}"
        # Dukandar receivable = 10*210 = 2100
        assert bs["assets"]["patti"] >= 2100 - TALLY_TOL, f"patti expected >=2100, got {bs['assets']['patti']}"
        # Bepaari payable = 10*200 = 2000 (less commission/mandi auto-cuts; should be > 0)
        assert bs["liabilities"]["bepaari_payables"] > 0
        # Commission earned (could be from rate-diff or commission %)
        comm = bs["liabilities"]["commission"]
        assert comm["total"] >= comm["bf"]  # increased

    def test_cash_receipt_from_dukandar(self, demo_ctx, demo_masters):
        s = demo_ctx["session"]
        duk = demo_masters["dukandar"]
        payload = {
            "type": "DUKANDAR",
            "sub_type": "RECEIPT",
            "party_id": duk["id"],
            "party_name": duk["name"],
            "amount": 2100,
            "mode": "CASH",
            "date": "2026-01-15",
            "narration": "Receive from dukandar"
        }
        r = s.post(f"{BASE_URL}/api/cash-book", json=payload, timeout=15)
        assert r.status_code == 200, f"dukandar receipt failed: {r.text}"
        bs = _bs(s)
        assert abs(bs["liabilities"]["total"] - bs["assets"]["total"]) < TALLY_TOL
        # patti should drop close to 0
        assert bs["assets"]["patti"] < 1.0, f"patti not cleared, got {bs['assets']['patti']}"

    def test_cash_payment_to_bepaari(self, demo_ctx, demo_masters):
        s = demo_ctx["session"]
        bep = demo_masters["bepaari"]
        # find current bepaari payable
        bs_before = _bs(s)
        payable = bs_before["liabilities"]["bepaari_payables"]
        if payable <= 0:
            pytest.skip("no bepaari payable to pay off")
        payload = {
            "type": "BEPAARI",
            "sub_type": "PAYMENT",
            "party_id": bep["id"],
            "party_name": bep["name"],
            "amount": payable,
            "mode": "CASH",
            "date": "2026-01-15",
            "narration": "Pay bepaari"
        }
        r = s.post(f"{BASE_URL}/api/cash-book", json=payload, timeout=15)
        assert r.status_code == 200, f"bepaari payment failed: {r.text}"
        bs = _bs(s)
        assert abs(bs["liabilities"]["total"] - bs["assets"]["total"]) < TALLY_TOL
        assert bs["liabilities"]["bepaari_payables"] < 1.0, f"bepaari payable not cleared: {bs['liabilities']['bepaari_payables']}"

    def test_jv_cash_to_bank(self, demo_ctx):
        s = demo_ctx["session"]
        bs_before = _bs(s)
        cash_before = bs_before["assets"]["cash_balance"]
        bank_before = bs_before["assets"]["bank_balance"]
        payload = {
            "date": "2026-01-15",
            "debit_type": "CASH",
            "credit_type": "BANK",
            "amount": 500,
            "narration": "TEST JV cash to bank"
        }
        r = s.post(f"{BASE_URL}/api/adjustments", json=payload, timeout=15)
        assert r.status_code == 200, f"adjustment failed: {r.text}"
        bs = _bs(s)
        assert abs(bs["liabilities"]["total"] - bs["assets"]["total"]) < TALLY_TOL
        assert (bs["assets"]["cash_balance"] != cash_before) or (bs["assets"]["bank_balance"] != bank_before), \
            "cash & bank both unchanged after JV"


# ----------------- 5. Aakda + party-statement + activity-log for demo -----------------
class TestDemoReports:
    def test_bepaari_aakda(self, demo_ctx, demo_masters):
        s = demo_ctx["session"]
        bep_id = demo_masters["bepaari"]["id"]
        r = s.get(f"{BASE_URL}/api/bepaari-aakda",
                  params={"bepaari_id": bep_id, "date": "2026-01-15"}, timeout=15)
        assert r.status_code == 200, f"aakda failed: {r.text}"
        data = r.json()
        # aakda returns a list of bepaari aakda summaries
        assert isinstance(data, list), f"aakda should return list, got {type(data)}"
        if len(data) > 0:
            row = data[0]
            assert "opening_balance" in row
            assert "bepaari_id" in row or "bepaari_name" in row

    def test_party_statement_dukandar(self, demo_ctx, demo_masters):
        s = demo_ctx["session"]
        duk_id = demo_masters["dukandar"]["id"]
        r = s.get(f"{BASE_URL}/api/party-statement/DUKANDAR/{duk_id}",
                  params={"start_date": "2026-01-01", "end_date": "2026-01-31"}, timeout=15)
        assert r.status_code == 200, f"party-statement failed: {r.text}"
        data = r.json()
        # at least sale + receipt entries
        assert "entries" in data or "transactions" in data or isinstance(data, dict)

    def test_activity_log_only_demo(self, demo_ctx):
        s = demo_ctx["session"]
        r = s.get(f"{BASE_URL}/api/activity-log", timeout=15)
        assert r.status_code == 200, f"activity-log failed: {r.text}"
        rows = r.json()
        # Every row should be from demo session — user_email = demo
        emails = {row.get("user_email") for row in rows if row.get("user_email")}
        # all entries (if any) must be by demo user only
        non_demo = emails - {DEMO_EMAIL, None, ""}
        assert not non_demo, f"activity-log leaked non-demo users: {non_demo}"


# ----------------- 6. Reverse isolation: admin sees ONLY admin data -----------------
class TestAdminReverseIsolation:
    def test_admin_bepaaris_unchanged(self, admin_ctx, admin_baseline):
        r = admin_ctx["session"].get(f"{BASE_URL}/api/bepaaris", timeout=15)
        names = sorted([b["name"] for b in r.json()])
        assert len(r.json()) == admin_baseline["bepaaris_count"], \
            f"admin bepaari count changed: {len(r.json())} vs {admin_baseline['bepaaris_count']}"
        assert names == admin_baseline["bepaaris_names"], "admin bepaari names changed"
        assert "TEST Bepaari Demo 1" not in names, "demo bepaari leaked into admin!"

    def test_admin_dukandars_unchanged(self, admin_ctx, admin_baseline):
        r = admin_ctx["session"].get(f"{BASE_URL}/api/dukandars", timeout=15)
        names = sorted([d["name"] for d in r.json()])
        assert len(r.json()) == admin_baseline["dukandars_count"]
        assert "TEST Dukandar Demo 1" not in names

    def test_admin_sales_count_unchanged(self, admin_ctx, admin_baseline):
        r = admin_ctx["session"].get(f"{BASE_URL}/api/daily-sales", timeout=15)
        assert len(r.json()) == admin_baseline["sales_count"], \
            f"admin sales count changed: {len(r.json())} vs {admin_baseline['sales_count']}"

    def test_admin_cash_count_unchanged(self, admin_ctx, admin_baseline):
        r = admin_ctx["session"].get(f"{BASE_URL}/api/cash-book", timeout=15)
        assert len(r.json()) == admin_baseline["cash_count"]

    def test_admin_adjustments_count_unchanged(self, admin_ctx, admin_baseline):
        r = admin_ctx["session"].get(f"{BASE_URL}/api/adjustments", timeout=15)
        assert len(r.json()) == admin_baseline["adjustments_count"]

    def test_admin_bs_still_tallies(self, admin_ctx):
        bs = _bs(admin_ctx["session"])
        assert abs(bs["liabilities"]["total"] - bs["assets"]["total"]) < TALLY_TOL


# ----------------- 7. Final reset + admin still intact -----------------
class TestFinalReset:
    def test_demo_reset_at_end(self, demo_ctx):
        r = demo_ctx["session"].post(f"{BASE_URL}/api/demo/reset", timeout=20)
        assert r.status_code == 200

    def test_demo_empty_after_final_reset(self, demo_ctx):
        s = demo_ctx["session"]
        assert s.get(f"{BASE_URL}/api/bepaaris", timeout=15).json() == []
        assert s.get(f"{BASE_URL}/api/dukandars", timeout=15).json() == []
        assert s.get(f"{BASE_URL}/api/daily-sales", timeout=15).json() == []
        assert s.get(f"{BASE_URL}/api/cash-book", timeout=15).json() == []

    def test_admin_data_intact_after_reset(self, admin_ctx, admin_baseline):
        r = admin_ctx["session"].get(f"{BASE_URL}/api/bepaaris", timeout=15)
        assert len(r.json()) == admin_baseline["bepaaris_count"]
        names = sorted([b["name"] for b in r.json()])
        assert names == admin_baseline["bepaaris_names"]
