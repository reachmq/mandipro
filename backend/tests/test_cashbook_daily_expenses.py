"""
Tests for the new "DAILY_EXPENSES" composite cash-book feature and the Party
Statement netting invariant.

Backend was NOT changed for these features. This suite verifies:
  1. POST /api/cash-book accepts MOTOR/BHUSSA/GAWALI/CASH_ADV/PAYMENT
     sub_types for BEPAARI as before (regression).
  2. The closing-balance math invariant: regardless of how same-day
     Motor/Bhussa/Gawali are presented in the Party Statement (netted
     into Sales vs separate debit lines), the closing balance returned
     by /api/bepaari-aakda for that party MUST be unchanged.
  3. Tenant isolation regression: admin's bepaari list (25 entries
     incl. JUNAID) must not be polluted by any demo-tenant write.

All write operations target the DEMO tenant only.  /api/demo/reset is
called at the start AND end of the suite so we never leave residue.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://commission-agent.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@mandi.com"
ADMIN_PASSWORD = "mandi@2026"
DEMO_EMAIL = "demo@mandipro.in"
DEMO_PASSWORD = "demo@2026"

TEST_DATE_SALE = "2026-05-02"      # date with sale + Motor/Bhussa/Gawali/CashAdv
TEST_DATE_NONSALE = "2026-05-03"   # date with Motor only (no sale)


# ---------- session helpers ----------

def _login(email: str, password: str) -> requests.Session:
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    token = r.json().get("access_token") or r.json().get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def admin_client():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def demo_client():
    s = _login(DEMO_EMAIL, DEMO_PASSWORD)
    # clean any prior demo state
    s.post(f"{API}/demo/reset", timeout=30)
    yield s
    # teardown - leave demo tenant clean
    s.post(f"{API}/demo/reset", timeout=30)


@pytest.fixture(scope="module")
def demo_bepaari(demo_client):
    """Create a single bepaari in the demo tenant for use across tests."""
    payload = {
        "name": "TEST_NetBepaari",
        "phone": "9000000001",
        "address": "Test",
        "commission_percent": 4.0,
    }
    r = demo_client.post(f"{API}/bepaaris", json=payload, timeout=15)
    assert r.status_code in (200, 201), f"create bepaari failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def demo_dukandar(demo_client):
    payload = {"name": "TEST_NetDukandar", "phone": "9000000002", "address": "Test"}
    r = demo_client.post(f"{API}/dukandars", json=payload, timeout=15)
    assert r.status_code in (200, 201), f"create dukandar failed: {r.status_code} {r.text}"
    return r.json()


# ---------- 1. Cash-book POST regression ----------

class TestCashBookSubTypes:
    """POST /api/cash-book should still accept all expected BEPAARI sub_types."""

    @pytest.mark.parametrize("sub_type,amount", [
        ("MOTOR", 7500.0),
        ("BHUSSA", 150.0),
        ("GAWALI", 1920.0),
        ("CASH_ADV", 5000.0),
        ("PAYMENT", 100000.0),
    ])
    def test_post_each_subtype(self, demo_client, demo_bepaari, sub_type, amount):
        payload = {
            "date": TEST_DATE_SALE,
            "type": "BEPAARI",
            "sub_type": sub_type,
            "party_id": demo_bepaari["id"],
            "amount": amount,
            "bf_disc": 0,
            "mode": "CASH",
            "particulars": f"TEST {sub_type}",
        }
        r = demo_client.post(f"{API}/cash-book", json=payload, timeout=15)
        assert r.status_code in (200, 201), f"{sub_type} failed: {r.status_code} {r.text}"
        body = r.json()
        assert body["sub_type"] == sub_type
        assert body["type"] == "BEPAARI"
        assert body["party_id"] == demo_bepaari["id"]
        assert float(body["amount"]) == amount
        assert body["mode"] == "CASH"

        # Verify persistence via GET
        g = demo_client.get(f"{API}/cash-book?type=BEPAARI&sub_type={sub_type}", timeout=15)
        assert g.status_code == 200
        ids = [e["id"] for e in g.json()]
        assert body["id"] in ids, f"created {sub_type} entry not returned by GET"


# ---------- 2. Math invariant: closing balance unchanged ----------

class TestNettingMathInvariant:
    """The Party Statement netting is purely a frontend re-presentation.
    The closing balance returned by /api/bepaari-aakda MUST match what we
    compute by summing raw rows.
    """

    @pytest.fixture(scope="class")
    def populated(self, demo_client, demo_bepaari, demo_dukandar):
        """Create the canonical scenario from the problem statement:
        - Sale: 32 pcs gross 320000 commission 4%, on 2026-05-02
        - Same-day Motor 7500, Bhussa 150, Gawali 1920, Cash Adv 5000
        - Non-sale-date Motor 1000 on 2026-05-03
        """
        # Daily sale
        sale = {
            "date": TEST_DATE_SALE,
            "bepaari_id": demo_bepaari["id"],
            "dukandar_id": demo_dukandar["id"],
            "quantity": 32,
            "rate": 10000,         # gross = qty * rate = 320000
            "discount": 0,
        }
        r = demo_client.post(f"{API}/daily-sales", json=sale, timeout=15)
        assert r.status_code in (200, 201), f"daily-sale create failed: {r.status_code} {r.text}"

        # Same-day Motor/Bhussa/Gawali/CashAdv (the 4 POSTs the frontend makes for DAILY_EXPENSES)
        for st, amt in [("MOTOR", 7500), ("BHUSSA", 150), ("GAWALI", 1920), ("CASH_ADV", 5000)]:
            r = demo_client.post(f"{API}/cash-book", json={
                "date": TEST_DATE_SALE, "type": "BEPAARI", "sub_type": st,
                "party_id": demo_bepaari["id"], "amount": amt, "bf_disc": 0,
                "mode": "CASH", "particulars": "TEST",
            }, timeout=15)
            assert r.status_code in (200, 201), f"{st} failed: {r.status_code} {r.text}"

        # Non-sale-date Motor
        r = demo_client.post(f"{API}/cash-book", json={
            "date": TEST_DATE_NONSALE, "type": "BEPAARI", "sub_type": "MOTOR",
            "party_id": demo_bepaari["id"], "amount": 1000, "bf_disc": 0,
            "mode": "CASH", "particulars": "TEST nonsale motor",
        }, timeout=15)
        assert r.status_code in (200, 201)
        return True

    def test_party_statement_and_aakda_agree(self, demo_client, demo_bepaari, populated):
        """The closing balance computed from raw /api/party-statement data must
        EQUAL the closing balance returned by /api/bepaari-ledger.  This is the
        netting invariant: the frontend may re-present same-day Motor/Bhussa/Gawali
        as netted into the Sales line, but the underlying math (and therefore the
        closing balance) must be unchanged.
        """
        r1 = demo_client.get(f"{API}/party-statement/bepaari/{demo_bepaari['id']}", timeout=15)
        assert r1.status_code == 200
        st = r1.json()
        sales = st.get("sales", [])
        cash = st.get("cash_entries", [])
        gross = sum(s["gross_amount"] for s in sales)
        qty = sum(s["quantity"] for s in sales)
        market_days = len(set(s["date"] for s in sales))
        commission = round(gross * 0.04, 2)
        jb = qty * 10
        kk = 100 * market_days
        deductions = sum(c["amount"] for c in cash if c.get("sub_type") in ("MOTOR", "BHUSSA", "GAWALI", "CASH_ADV"))
        payments = sum(c["amount"] for c in cash if c.get("sub_type") == "PAYMENT")
        opening = st.get("summary", {}).get("opening_balance", 0)
        closing_from_statement = opening + gross - commission - jb - kk - deductions - payments

        r2 = demo_client.get(f"{API}/bepaari-ledger", timeout=15)
        assert r2.status_code == 200
        match = next((row for row in r2.json() if row.get("id") == demo_bepaari["id"]), None)
        assert match is not None
        closing_from_aakda = float(match["balance"])

        # The CRITICAL invariant: both must be identical (within Rs 1 for FP rounding)
        assert abs(closing_from_statement - closing_from_aakda) <= 1, (
            f"party-statement-derived closing {closing_from_statement} != "
            f"bepaari-ledger closing {closing_from_aakda} — netting refactor broke math!"
        )

    def test_netting_breakdown_components(self, demo_client, demo_bepaari, populated):
        """Verify per-deduction breakdown matches what we POSTed."""
        r = demo_client.get(f"{API}/bepaari-ledger", timeout=15)
        assert r.status_code == 200
        match = next((row for row in r.json() if row.get("id") == demo_bepaari["id"]), None)
        assert match is not None
        # Parameterized cash-book test created one of each; netting test created another set
        # plus a non-sale-date motor (1000). So:
        #   motor    = 7500 (cb) + 7500 (netting) + 1000 (non-sale) = 16000
        #   bhussa   = 150  + 150  = 300
        #   gawali   = 1920 + 1920 = 3840
        #   cash_adv = 5000 + 5000 = 10000
        #   payments = 100000
        assert match["motor"] == 16000, f"motor={match['motor']}"
        assert match["bhussa"] == 300, f"bhussa={match['bhussa']}"
        assert match["gawali"] == 3840, f"gawali={match['gawali']}"
        assert match["cash_adv"] == 10000, f"cash_adv={match['cash_adv']}"
        assert match["payments"] == 100000, f"payments={match['payments']}"


# ---------- 3. Tenant isolation regression ----------

class TestTenantIsolation:
    def test_admin_bepaari_count_unchanged(self, admin_client):
        r = admin_client.get(f"{API}/bepaaris", timeout=15)
        assert r.status_code == 200
        names = [b["name"] for b in r.json()]
        assert "JUNAID" in names, "admin's JUNAID bepaari missing — admin tenant polluted!"
        # must be at least 25 (per problem statement); strict equality might shift if
        # admin added new bepaari themselves, so we use >=
        assert len(names) >= 25, f"admin tenant should have >=25 bepaaris, got {len(names)}"

    def test_demo_test_bepaari_invisible_to_admin(self, admin_client):
        r = admin_client.get(f"{API}/bepaaris", timeout=15)
        assert r.status_code == 200
        names = [b["name"] for b in r.json()]
        assert "TEST_NetBepaari" not in names, "demo tenant data leaked into admin!"
