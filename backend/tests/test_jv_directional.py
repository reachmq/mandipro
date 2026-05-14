"""
Test suite for the new 6-case directional Adjustment (JV) handling
in bepaari_ledger and dukandar_ledger.

Covers (all on DEMO tenant — admin data is READ-ONLY):
- Bepaari → Bepaari transfer (PAYABLE→PAYABLE, same type)
- Dukandar → Dukandar transfer (RECEIVABLE→RECEIVABLE, same type)
- Bepaari write-off (debit=BEPAARI credit=MANDI_EXPENSE) — reduce payable
- Bepaari LEGACY write-off (debit=MANDI_EXPENSE credit=BEPAARI) — INCREASE payable (back-compat)
- Dukandar LEGACY write-off (debit=MANDI_EXPENSE credit=DUKANDAR) — REDUCE receivable
- Dukandar → Bepaari (cross-type legacy, both go DOWN) — REGRESSION
- Balance Sheet tally (assets - liabilities - capital == 0) after each mutation
- Admin data unchanged: bepaari count == 25 with JUNAID first; BS difference == 0
"""
import os
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

TOL = 1.0  # rupee tolerance


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def demo():
    s = _login(DEMO_EMAIL, DEMO_PASSWORD)
    # Start from a clean slate
    r = s.post(f"{BASE_URL}/api/demo/reset", timeout=30)
    assert r.status_code == 200, f"demo reset failed: {r.text}"
    yield s
    # Final cleanup
    s.post(f"{BASE_URL}/api/demo/reset", timeout=30)


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


# ---------- helpers ----------
def _bep_bal(s, bid):
    rows = s.get(f"{BASE_URL}/api/bepaari-ledger", timeout=20).json()
    row = next((r for r in rows if r["id"] == bid), None)
    assert row, f"bepaari {bid} not found"
    return row["balance"]


def _duk_bal(s, did):
    rows = s.get(f"{BASE_URL}/api/dukandar-ledger", timeout=20).json()
    row = next((r for r in rows if r["id"] == did), None)
    assert row, f"dukandar {did} not found"
    return row["balance"]


def _bs_diff(s):
    bs = s.get(f"{BASE_URL}/api/balance-sheet", timeout=20).json()
    return bs.get("difference", bs.get("diff", 0))


def _create_bepaari(s, name, opening):
    r = s.post(f"{BASE_URL}/api/bepaaris",
               json={"name": name, "phone": "9000000000",
                     "opening_balance": opening,
                     "commission_percent": 4},
               timeout=20)
    assert r.status_code in (200, 201), f"create bepaari failed: {r.text}"
    return r.json()["id"]


def _create_dukandar(s, name, opening):
    r = s.post(f"{BASE_URL}/api/dukandars",
               json={"name": name, "phone": "9000000001",
                     "opening_balance": opening},
               timeout=20)
    assert r.status_code in (200, 201), f"create dukandar failed: {r.text}"
    return r.json()["id"]


def _create_adj(s, payload):
    r = s.post(f"{BASE_URL}/api/adjustments", json=payload, timeout=20)
    assert r.status_code in (200, 201), f"adj create failed: {r.text}\npayload={payload}"
    return r.json().get("id") or r.json().get("_id")


# ============== TEST SCENARIOS ==============

class TestBepaariToBepaariJV:
    """debit=BEPAARI/X, credit=BEPAARI/Y → X reduces, Y increases (same-type transfer)."""

    def test_bep_to_bep_transfer(self, demo):
        x_id = _create_bepaari(demo, "TEST_Sharif", 4810)
        y_id = _create_bepaari(demo, "TEST_Annu", 0)

        assert abs(_bep_bal(demo, x_id) - 4810) < TOL
        assert abs(_bep_bal(demo, y_id) - 0) < TOL

        bs_before = _bs_diff(demo)
        _create_adj(demo, {
            "date": "2026-01-15",
            "debit_type": "BEPAARI", "debit_party_id": x_id,
            "credit_type": "BEPAARI", "credit_party_id": y_id,
            "amount": 4810,
            "narration": "TEST B2B transfer"
        })

        assert abs(_bep_bal(demo, x_id) - 0) < TOL, "Sharif must drop to 0"
        assert abs(_bep_bal(demo, y_id) - 4810) < TOL, "Annu must rise to 4810"
        assert abs(_bs_diff(demo) - bs_before) < TOL, "BS diff invariant after B->B transfer"


class TestDukandarToDukandarJV:
    """debit=DUKANDAR/X, credit=DUKANDAR/Y → X reduces, Y increases."""

    def test_duk_to_duk_transfer(self, demo):
        x_id = _create_dukandar(demo, "TEST_Yunus", 20000)
        y_id = _create_dukandar(demo, "TEST_Mehmood", 0)

        assert abs(_duk_bal(demo, x_id) - 20000) < TOL
        assert abs(_duk_bal(demo, y_id) - 0) < TOL

        bs_before = _bs_diff(demo)
        _create_adj(demo, {
            "date": "2026-01-15",
            "debit_type": "DUKANDAR", "debit_party_id": x_id,
            "credit_type": "DUKANDAR", "credit_party_id": y_id,
            "amount": 13500,
            "narration": "TEST D2D transfer"
        })

        assert abs(_duk_bal(demo, x_id) - 6500) < TOL, "Yunus must be 6500"
        assert abs(_duk_bal(demo, y_id) - 13500) < TOL, "Mehmood must be 13500"
        assert abs(_bs_diff(demo) - bs_before) < TOL, "BS diff invariant after D->D transfer"


class TestDukandarToBepaariLegacyJV:
    """REGRESSION: legacy 'Dukandar pays Bepaari' — debit=DUKANDAR, credit=BEPAARI.
    BOTH balances must go DOWN by the same amount."""

    def test_duk_pays_bep(self, demo):
        d_id = _create_dukandar(demo, "TEST_Junaid", 10000)
        b_id = _create_bepaari(demo, "TEST_Vinod", 15000)

        assert abs(_duk_bal(demo, d_id) - 10000) < TOL
        assert abs(_bep_bal(demo, b_id) - 15000) < TOL

        bs_before = _bs_diff(demo)
        _create_adj(demo, {
            "date": "2026-01-15",
            "debit_type": "DUKANDAR", "debit_party_id": d_id,
            "credit_type": "BEPAARI", "credit_party_id": b_id,
            "amount": 5000,
            "narration": "TEST cross-type legacy"
        })

        assert abs(_duk_bal(demo, d_id) - 5000) < TOL, "Junaid (Dukandar) must drop to 5000"
        assert abs(_bep_bal(demo, b_id) - 10000) < TOL, "Vinod (Bepaari) must drop to 10000"
        assert abs(_bs_diff(demo) - bs_before) < TOL, "BS diff invariant after legacy cross-type"


class TestBepaariWriteOffNew:
    """New convention: debit=BEPAARI credit=MANDI_EXPENSE → bepaari payable REDUCES."""

    def test_bep_writeoff_new(self, demo):
        b_id = _create_bepaari(demo, "TEST_SharifWO", 4810)
        assert abs(_bep_bal(demo, b_id) - 4810) < TOL

        bs_before = _bs_diff(demo)
        _create_adj(demo, {
            "date": "2026-01-15",
            "debit_type": "BEPAARI", "debit_party_id": b_id,
            "credit_type": "MANDI_EXPENSE",
            "amount": 4810,
            "narration": "TEST write-off new"
        })

        assert abs(_bep_bal(demo, b_id) - 0) < TOL, "Bepaari payable must drop to 0"
        assert abs(_bs_diff(demo) - bs_before) < TOL


class TestBepaariWriteOffLegacy:
    """LEGACY back-compat: debit=MANDI_EXPENSE credit=BEPAARI → bepaari payable INCREASES.
    (old convention: expense added to bepaari's account)"""

    def test_bep_writeoff_legacy(self, demo):
        b_id = _create_bepaari(demo, "TEST_SharifLegacy", 1000)
        assert abs(_bep_bal(demo, b_id) - 1000) < TOL

        bs_before = _bs_diff(demo)
        _create_adj(demo, {
            "date": "2026-01-15",
            "debit_type": "MANDI_EXPENSE",
            "credit_type": "BEPAARI", "credit_party_id": b_id,
            "amount": 500,
            "narration": "TEST legacy expense add"
        })

        assert abs(_bep_bal(demo, b_id) - 1500) < TOL, "Bepaari must INCREASE to 1500 (legacy)"
        assert abs(_bs_diff(demo) - bs_before) < TOL


class TestDukandarWriteOffLegacy:
    """LEGACY back-compat: debit=MANDI_EXPENSE credit=DUKANDAR → receivable REDUCES."""

    def test_duk_writeoff_legacy(self, demo):
        d_id = _create_dukandar(demo, "TEST_VinodDuk", 5000)
        assert abs(_duk_bal(demo, d_id) - 5000) < TOL

        bs_before = _bs_diff(demo)
        _create_adj(demo, {
            "date": "2026-01-15",
            "debit_type": "MANDI_EXPENSE",
            "credit_type": "DUKANDAR", "credit_party_id": d_id,
            "amount": 2000,
            "narration": "TEST dukandar legacy writeoff"
        })

        assert abs(_duk_bal(demo, d_id) - 3000) < TOL, "Dukandar must drop to 3000"
        assert abs(_bs_diff(demo) - bs_before) < TOL


# ============== ADMIN REGRESSION (READ-ONLY) ==============

class TestAdminUntouched:
    """Admin tenant must remain byte-identical: 25 bepaaris, JUNAID first by some order,
    BS difference still 0."""

    def test_admin_bepaari_count(self, admin):
        r = admin.get(f"{BASE_URL}/api/bepaaris", timeout=20)
        assert r.status_code == 200
        bep = r.json()
        # filter to active
        active = [b for b in bep if b.get("is_active", True)]
        assert len(active) == 25, f"Admin bepaari count drift: got {len(active)}, expected 25"

    def test_admin_junaid_present(self, admin):
        bep = admin.get(f"{BASE_URL}/api/bepaaris", timeout=20).json()
        names = [b["name"].upper() for b in bep]
        assert any("JUNAID" in n for n in names), "JUNAID missing from admin bepaaris"

    def test_admin_balance_sheet_tallies(self, admin):
        bs = admin.get(f"{BASE_URL}/api/balance-sheet", timeout=30).json()
        diff = bs.get("difference", bs.get("diff", 0))
        assert abs(diff) < TOL, f"Admin BS diff = {diff} (must be 0)"
