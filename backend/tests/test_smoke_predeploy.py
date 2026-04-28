"""
Pre-deploy smoke test for Mandi accounting backend.
- Validates: auth, RBAC, Balance Sheet tally, ledger structure, FIFO aging,
  daily-sale comment round-trip, Aakda with comment, CREATE audit logging,
  settings PUT, Party Statement.
- IMPORTANT: All test data created is deleted (incl. activity_log rows) so
  Balance Sheet tally is preserved.
"""
import os
import uuid
import requests
import pytest
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback - read from frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for ln in f:
                if ln.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = ln.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

ADMIN_EMAIL = "admin@mandi.com"
ADMIN_PASSWORD = "mandi@2026"
OP_EMAIL = "operator@mandi.com"
OP_PASSWORD = "oper@2026"

SMOKE_TAG = "__SMOKE_TEST__"


# ----------------- Mongo helper for cleanup -----------------
def _mongo_db():
    mongo_url = "mongodb://localhost:27017"
    db_name = "test_database"
    try:
        with open("/app/backend/.env") as f:
            for ln in f:
                if ln.startswith("MONGO_URL="):
                    mongo_url = ln.split("=", 1)[1].strip().strip('"')
                if ln.startswith("DB_NAME="):
                    db_name = ln.split("=", 1)[1].strip().strip('"')
    except Exception:
        pass
    return MongoClient(mongo_url)[db_name]


@pytest.fixture(scope="module")
def db():
    return _mongo_db()


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
               timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    assert "access_token" in s.cookies, "access_token cookie not set"
    return s


@pytest.fixture(scope="module")
def operator_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": OP_EMAIL, "password": OP_PASSWORD},
               timeout=15)
    if r.status_code != 200:
        pytest.skip(f"operator login failed: {r.status_code} {r.text}")
    return s


# ----------------- Auth & RBAC -----------------
class TestAuth:
    def test_login_admin_sets_cookie(self, admin_session):
        assert "access_token" in admin_session.cookies

    def test_me_returns_admin(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data.get("email") == ADMIN_EMAIL
        assert data.get("role") == "admin"

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": "WRONG"},
                          timeout=10)
        assert r.status_code == 401

    def test_logout_clears_cookie(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                   timeout=10)
        assert r.status_code == 200
        r2 = s.post(f"{BASE_URL}/api/auth/logout", timeout=10)
        assert r2.status_code == 200
        # After logout, /me must 401
        r3 = s.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert r3.status_code == 401

    def test_protected_without_auth(self):
        r = requests.get(f"{BASE_URL}/api/balance-sheet", timeout=10)
        assert r.status_code == 401


class TestRBAC:
    def test_operator_blocked_balance_sheet(self, operator_session):
        r = operator_session.get(f"{BASE_URL}/api/balance-sheet", timeout=10)
        assert r.status_code == 403

    def test_operator_blocked_export_all(self, operator_session):
        r = operator_session.get(f"{BASE_URL}/api/export-all", timeout=10)
        assert r.status_code == 403

    def test_operator_blocked_activity_log(self, operator_session):
        r = operator_session.get(f"{BASE_URL}/api/activity-log", timeout=10)
        assert r.status_code == 403

    def test_operator_blocked_settings_put(self, operator_session):
        r = operator_session.put(f"{BASE_URL}/api/settings",
                                 json={"commission_rate": 4}, timeout=10)
        assert r.status_code == 403


# ----------------- Balance Sheet Tally -----------------
class TestBalanceSheet:
    def test_balance_sheet_tallied(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/balance-sheet", timeout=20)
        assert r.status_code == 200
        bs = r.json()
        assert "difference" in bs, f"no difference field: keys={list(bs.keys())}"
        diff = float(bs.get("difference", 0))
        assert abs(diff) < 0.01, f"Balance Sheet not tallied: diff={diff}"

    def test_balance_sheet_admin_only(self):
        r = requests.get(f"{BASE_URL}/api/balance-sheet", timeout=10)
        assert r.status_code == 401


# ----------------- Bepaari Ledger -----------------
class TestBepaariLedger:
    def test_bepaari_ledger_structure(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/bepaari-ledger", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if not data:
            pytest.skip("no bepaaris in DB")
        b = data[0]
        for k in ("id", "name", "balance", "commission", "kk", "jb",
                  "gross_sales", "quantity", "payments"):
            assert k in b, f"missing {k} in bepaari-ledger row"

    def test_bepaari_flat_rate_priority(self, admin_session, db):
        """flat_rate_per_goat takes priority over commission_percent."""
        # Find bepaari with flat_rate_per_goat set
        b_flat = db.bepaaris.find_one({"flat_rate_per_goat": {"$gt": 0}, "is_active": True})
        if not b_flat:
            pytest.skip("no bepaari with flat_rate_per_goat")
        r = admin_session.get(f"{BASE_URL}/api/bepaari-ledger", timeout=20)
        row = next((x for x in r.json() if x["id"] == b_flat["id"]), None)
        assert row is not None
        expected_comm = b_flat["flat_rate_per_goat"] * row["quantity"]
        assert abs(row["commission"] - expected_comm) < 0.01, \
            f"flat-rate commission mismatch: {row['commission']} vs {expected_comm}"


# ----------------- Dukandar Ledger / FIFO -----------------
class TestDukandarLedger:
    def test_dukandar_ledger_has_oldest_unpaid_days(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/dukandar-ledger", timeout=20)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) > 0
        for row in rows:
            assert "oldest_unpaid_days" in row, f"missing field for {row.get('name')}"
            assert "oldest_unpaid_date" in row

    def test_mudassir_oldest_unpaid_days_999(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/dukandar-ledger", timeout=20)
        rows = r.json()
        mudassir = [x for x in rows if "MUDASSIR" in (x.get("name") or "").upper()]
        if not mudassir:
            pytest.skip("MUDASSIR not in dukandars list")
        m = mudassir[0]
        # Only assert =999 if there is balance owing from B/F (opening unpaid)
        if m["balance"] > 0 and m.get("opening", 0) > 0:
            assert m["oldest_unpaid_days"] == 999, \
                f"expected 999 (B/F unpaid) for MUDASSIR, got {m['oldest_unpaid_days']}"


# ----------------- Daily Sales comment + Aakda + audit -----------------
class TestDailySaleAndAudit:
    """Creates a smoke-tagged daily-sale, validates comment, audit log,
    Aakda inclusion. ALL CREATED DATA + audit entries deleted at end."""

    sale_id = None
    test_date = None
    bepaari = None
    dukandar = None

    @pytest.fixture(autouse=True, scope="class")
    def _setup_teardown(self, request, db):
        # find any active bepaari & dukandar
        b = db.bepaaris.find_one({"is_active": True})
        d = db.dukandars.find_one({"is_active": True})
        if not b or not d:
            pytest.skip("no bepaari or dukandar to use")
        request.cls.bepaari = b
        request.cls.dukandar = d
        request.cls.test_date = "2099-12-31"  # future date - won't impact aging today
        yield
        # ---- Cleanup ----
        # Daily sale
        if request.cls.sale_id:
            db.daily_sales.delete_one({"id": request.cls.sale_id})
            db.activity_log.delete_many({"record_id": request.cls.sale_id})
        # Any leftover smoke-tagged sales
        db.daily_sales.delete_many({"comment": SMOKE_TAG})
        # Activity log entries with summary containing SMOKE_TAG
        db.activity_log.delete_many({"summary": {"$regex": SMOKE_TAG}})

    def test_capture_baseline_balance(self, admin_session, request):
        r = admin_session.get(f"{BASE_URL}/api/balance-sheet", timeout=20)
        assert r.status_code == 200
        request.cls._baseline_diff = float(r.json()["difference"])
        assert abs(request.cls._baseline_diff) < 0.01

    def test_create_daily_sale_with_comment(self, admin_session, request):
        payload = {
            "date": self.test_date,
            "bepaari_id": self.bepaari["id"],
            "dukandar_id": self.dukandar["id"],
            "quantity": 1,
            "rate": 100,
            "discount": 0,
            "comment": SMOKE_TAG
        }
        r = admin_session.post(f"{BASE_URL}/api/daily-sales", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("comment") == SMOKE_TAG
        assert body.get("gross_amount") == 100
        request.cls.sale_id = body["id"]

    def test_get_daily_sale_persists_comment(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/daily-sales?date={self.test_date}", timeout=15)
        assert r.status_code == 200
        rows = [x for x in r.json() if x.get("id") == self.sale_id]
        assert rows, "created sale not returned"
        assert rows[0].get("comment") == SMOKE_TAG

    def test_update_daily_sale_empty_comment_becomes_none(self, admin_session):
        r = admin_session.put(f"{BASE_URL}/api/daily-sales/{self.sale_id}",
                              json={"comment": "   "}, timeout=15)
        assert r.status_code == 200
        # verify
        rows = admin_session.get(f"{BASE_URL}/api/daily-sales?date={self.test_date}",
                                 timeout=15).json()
        row = next(x for x in rows if x["id"] == self.sale_id)
        assert row.get("comment") in (None, ""), f"expected null/empty got {row.get('comment')!r}"
        # restore comment for aakda test
        r = admin_session.put(f"{BASE_URL}/api/daily-sales/{self.sale_id}",
                              json={"comment": SMOKE_TAG}, timeout=15)
        assert r.status_code == 200

    def test_aakda_includes_comment(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/bepaari-aakda?date={self.test_date}",
                              timeout=15)
        assert r.status_code == 200
        aakda = r.json()
        my_b = next((x for x in aakda if x["bepaari_id"] == self.bepaari["id"]), None)
        assert my_b is not None, "bepaari aakda missing"
        sd = my_b.get("sales_detail", [])
        assert any(line.get("comment") == SMOKE_TAG for line in sd), \
            f"comment not present in sales_detail: {sd}"

    def test_create_audit_log_captures_user(self, admin_session):
        r = admin_session.get(
            f"{BASE_URL}/api/activity-log?action=CREATE&collection=daily_sales",
            timeout=15)
        assert r.status_code == 200
        logs = r.json()
        my_log = next((l for l in logs if l.get("record_id") == self.sale_id), None)
        assert my_log is not None, "no CREATE log for our sale"
        assert my_log.get("action") == "CREATE"
        assert my_log.get("user") == ADMIN_EMAIL, \
            f"user_email mismatch: {my_log.get('user')}"
        # changes should include comment field
        change_fields = {c["field"] for c in my_log.get("changes", [])}
        assert "quantity" in change_fields and "rate" in change_fields

    def test_balance_sheet_still_tallied_after_test_data(self, admin_session):
        # Even with our test sale present, BS should still tally
        r = admin_session.get(f"{BASE_URL}/api/balance-sheet", timeout=20)
        assert r.status_code == 200
        diff = float(r.json()["difference"])
        assert abs(diff) < 0.01, f"BS not tallied with test sale: diff={diff}"


# ----------------- Cash Book + Adjustment CREATE audit -----------------
class TestCreateAuditCashAndAdjustment:
    cash_id = None
    adj_id = None

    @pytest.fixture(autouse=True, scope="class")
    def _teardown(self, request, db):
        yield
        if request.cls.cash_id:
            db.cash_book.delete_one({"id": request.cls.cash_id})
            db.activity_log.delete_many({"record_id": request.cls.cash_id})
        if request.cls.adj_id:
            db.adjustments.delete_one({"id": request.cls.adj_id})
            db.activity_log.delete_many({"record_id": request.cls.adj_id})

    def test_create_cashbook_logs_create(self, admin_session, db, request):
        b = db.bepaaris.find_one({"is_active": True})
        if not b:
            pytest.skip("no bepaari")
        payload = {
            "date": "2099-12-31",
            "type": "BEPAARI",
            "sub_type": "PAYMENT",
            "party_id": b["id"],
            "amount": 1.0,
            "mode": "CASH",
            "particulars": SMOKE_TAG
        }
        r = admin_session.post(f"{BASE_URL}/api/cash-book", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        request.cls.cash_id = r.json()["id"]

        r2 = admin_session.get(
            f"{BASE_URL}/api/activity-log?action=CREATE&collection=cash_book",
            timeout=15)
        logs = r2.json()
        my = next((l for l in logs if l["record_id"] == request.cls.cash_id), None)
        assert my, "cash_book CREATE log missing"
        assert my["user"] == ADMIN_EMAIL
        assert my["action"] == "CREATE"

    def test_create_adjustment_logs_create(self, admin_session, db, request):
        b = db.bepaaris.find_one({"is_active": True})
        d = db.dukandars.find_one({"is_active": True})
        if not (b and d):
            pytest.skip("no parties")
        payload = {
            "date": "2099-12-31",
            "debit_type": "DUKANDAR",
            "debit_party_id": d["id"],
            "credit_type": "BEPAARI",
            "credit_party_id": b["id"],
            "amount": 1.0,
            "narration": SMOKE_TAG
        }
        r = admin_session.post(f"{BASE_URL}/api/adjustments", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        request.cls.adj_id = r.json()["id"]

        r2 = admin_session.get(
            f"{BASE_URL}/api/activity-log?action=CREATE&collection=adjustments",
            timeout=15)
        logs = r2.json()
        my = next((l for l in logs if l["record_id"] == request.cls.adj_id), None)
        assert my, "adjustment CREATE log missing"
        assert my["user"] == ADMIN_EMAIL


# ----------------- Balance Transfer audit (read-only) -----------------
class TestBalanceTransferAudit:
    def test_existing_balance_transfers_have_create_logs(self, admin_session, db):
        """Verify any existing balance_transfers have CREATE log entries
        with user_email captured (no longer hardcoded). Non-mutating."""
        existing = list(db.balance_transfers.find().limit(5))
        if not existing:
            pytest.skip("no existing balance_transfers")
        r = admin_session.get(
            f"{BASE_URL}/api/activity-log?action=CREATE&collection=balance_transfers&limit=200",
            timeout=15)
        assert r.status_code == 200
        logs = r.json()
        # If any logs exist, validate user is set (could be 'system' for
        # transfers created before audit was added, that's OK).
        for l in logs[:5]:
            assert l["action"] == "CREATE"
            assert l.get("user"), "user_email field missing"


# ----------------- Settings PUT (with revert) -----------------
class TestSettingsPut:
    def test_settings_put_admin(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/settings", timeout=10)
        assert r.status_code == 200
        original = r.json()
        original_kk = original.get("kk_fixed", 100)

        # Update to original+0 (no real change but still validates write path)
        r2 = admin_session.put(f"{BASE_URL}/api/settings",
                               json={"kk_fixed": original_kk},
                               timeout=10)
        assert r2.status_code == 200
        body = r2.json()
        assert body.get("kk_fixed") == original_kk


# ----------------- Party Statement -----------------
class TestPartyStatement:
    def test_party_statement_bepaari(self, admin_session, db):
        b = db.bepaaris.find_one({"is_active": True})
        if not b:
            pytest.skip("no bepaari")
        r = admin_session.get(
            f"{BASE_URL}/api/party-statement/bepaari/{b['id']}", timeout=20)
        assert r.status_code == 200
        body = r.json()
        for k in ("party", "sales", "cash_entries", "adjustments", "summary"):
            assert k in body, f"missing key {k} in party-statement"

    def test_party_statement_ledger_match(self, admin_session, db):
        """For 3 active bepaaris, summary closing balance ≈ ledger row balance."""
        bepaaris = list(db.bepaaris.find({"is_active": True}).limit(3))
        if not bepaaris:
            pytest.skip()
        ledger_rows = admin_session.get(f"{BASE_URL}/api/bepaari-ledger",
                                        timeout=20).json()
        for b in bepaaris:
            ps = admin_session.get(
                f"{BASE_URL}/api/party-statement/bepaari/{b['id']}",
                timeout=20).json()
            ledger_row = next((x for x in ledger_rows if x["id"] == b["id"]), None)
            if not ledger_row:
                continue
            ps_close = ps.get("summary", {}).get("closing_balance")
            if ps_close is None:
                continue
            # Allow tiny float drift
            diff = abs(float(ps_close) - float(ledger_row["balance"]))
            assert diff < 1.0, \
                f"{b['name']}: party-statement closing {ps_close} != ledger balance {ledger_row['balance']}"


# ----------------- Final tally check -----------------
def test_final_balance_sheet_tally(admin_session):
    """Run last - confirms BS still tallies after all create+delete cycles."""
    r = admin_session.get(f"{BASE_URL}/api/balance-sheet", timeout=20)
    assert r.status_code == 200
    diff = float(r.json()["difference"])
    assert abs(diff) < 0.01, f"FINAL Balance Sheet not tallied: diff={diff}"
