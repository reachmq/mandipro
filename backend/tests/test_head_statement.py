"""Backend tests for Interactive Balance Sheet — head statement drilldowns.
Verifies (a) all 10 heads return correct schema, (b) closing_balance matches Balance Sheet exactly,
(c) unknown head → 404, (d) CSV export, (e) admin auth required, (f) date filter roll-forward,
(g) /cash-book/reassign route not shadowed by /cash-book/{entry_id}.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://commission-agent.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": "admin@mandi.com", "password": "mandi@2026"}
OPER = {"email": "operator@mandi.com", "password": "oper@2026"}

HEADS = ["MANDI_EXPENSE", "BF_DISCOUNT", "MHN_PERSONAL", "KK", "JB", "COMMISSION", "ZAKAT", "CASH", "BANK", "CAPITAL"]


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def operator_client():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=OPER, timeout=15)
    if r.status_code != 200:
        pytest.skip("operator login unavailable")
    tok = r.json().get("access_token")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def bs(admin_client):
    r = admin_client.get(f"{BASE_URL}/api/balance-sheet", timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


# ---------- Schema ----------
@pytest.mark.parametrize("head", HEADS)
def test_head_statement_schema(admin_client, head):
    r = admin_client.get(f"{BASE_URL}/api/head-statement/{head}", timeout=20)
    assert r.status_code == 200, f"{head}: {r.status_code} {r.text[:200]}"
    d = r.json()
    for k in ["head", "label", "normal_balance", "book_opening", "opening_balance",
              "entries", "subtype_summary", "closing_balance", "total_debit", "total_credit"]:
        assert k in d, f"{head} missing key {k}"
    assert d["head"] == head
    assert d["normal_balance"] in ("debit", "credit")
    assert isinstance(d["entries"], list)
    assert isinstance(d["subtype_summary"], list)
    # entries should have running_balance
    for e in d["entries"][:5]:
        assert "running_balance" in e


# ---------- Closing == BS values ----------
def _get(d, path):
    for p in path:
        d = d[p]
    return d


BS_MAP = {
    "MANDI_EXPENSE": ["assets", "mandi_expenses", "total"],
    "BF_DISCOUNT":   ["assets", "bf_discount", "total"],
    "MHN_PERSONAL":  ["assets", "mhn_personal", "total"],
    "KK":            ["liabilities", "kk", "total"],
    "JB":            ["liabilities", "jb", "total"],
    "COMMISSION":    ["liabilities", "commission", "total"],
    "ZAKAT":         ["liabilities", "zakat"],
    "CASH":          ["assets", "cash_balance"],
    "BANK":          ["assets", "bank_balance"],
    "CAPITAL":       ["liabilities", "capital"],
}


@pytest.mark.parametrize("head", HEADS)
def test_head_closing_matches_bs(admin_client, bs, head):
    r = admin_client.get(f"{BASE_URL}/api/head-statement/{head}", timeout=20)
    assert r.status_code == 200
    closing = r.json()["closing_balance"]
    bs_val = _get(bs, BS_MAP[head])
    assert abs(closing - bs_val) < 0.5, f"{head}: HS closing={closing} vs BS={bs_val}"


# ---------- Unknown head ----------
def test_unknown_head_404(admin_client):
    r = admin_client.get(f"{BASE_URL}/api/head-statement/BOGUS", timeout=15)
    assert r.status_code == 404
    assert "Unknown head" in r.text


# ---------- CSV export ----------
def test_csv_export(admin_client):
    r = admin_client.get(f"{BASE_URL}/api/head-statement/MANDI_EXPENSE/export", timeout=30)
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "").lower()
    cd = r.headers.get("content-disposition", "")
    assert "attachment" in cd and ".csv" in cd
    body = r.text
    assert "Head Statement" in body
    assert "Closing Balance" in body
    assert "Date" in body and "Debit" in body and "Credit" in body


# ---------- Auth ----------
def test_head_statement_requires_auth():
    r = requests.get(f"{BASE_URL}/api/head-statement/CASH", timeout=15)
    assert r.status_code in (401, 403)


def test_head_statement_non_admin_forbidden(operator_client):
    r = operator_client.get(f"{BASE_URL}/api/head-statement/CASH", timeout=15)
    assert r.status_code == 403


# ---------- Date-range filter ----------
def test_date_filter_rolls_opening_forward(admin_client):
    # Pick a head that has entries; MANDI_EXPENSE likely has many
    full = admin_client.get(f"{BASE_URL}/api/head-statement/MANDI_EXPENSE", timeout=20).json()
    if len(full["entries"]) < 2:
        pytest.skip("not enough entries to test date roll-forward")
    # pick a from_date after first entry
    dates = sorted({e["date"] for e in full["entries"]})
    if len(dates) < 2:
        pytest.skip("all entries on same date")
    mid = dates[len(dates) // 2]
    r2 = admin_client.get(f"{BASE_URL}/api/head-statement/MANDI_EXPENSE?from_date={mid}", timeout=20).json()
    # opening should have moved forward from book_opening
    assert r2["opening_balance"] != r2["book_opening"] or all(e["date"] >= mid for e in full["entries"])
    # all returned entries within range
    for e in r2["entries"]:
        assert e["date"] >= mid
    # closing_balance of full == closing of filtered when to_date is not set and from_date covers all
    # (roll-forward + returned entries should still sum to full closing)
    assert abs(r2["closing_balance"] - full["closing_balance"]) < 0.5


# ---------- Cash book reassign route (regression) ----------
def test_cash_book_reassign_route_not_shadowed(admin_client):
    # calling reassign with empty body should NOT be treated as /cash-book/{id} PUT
    # It should hit reassign endpoint. Response could be 400/422 for missing fields, NOT 404.
    r = admin_client.put(f"{BASE_URL}/api/cash-book/reassign", json={}, timeout=15)
    assert r.status_code != 404, f"route shadowed: got 404 with body {r.text[:200]}"
    # Expect 400/422 (validation) or 200 (if accepts empty). Any of those means route is reachable.
    assert r.status_code in (200, 400, 422, 500)
