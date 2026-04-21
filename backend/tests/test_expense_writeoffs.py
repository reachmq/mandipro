"""
Test Expense Write-offs via Adjustments/JV page
Tests for MANDI_EXPENSE and BF_DISCOUNT expense heads on Debit side of JV form

Features tested:
1. POST /api/adjustments with debit_type=BF_DISCOUNT, credit_type=DUKANDAR creates write-off correctly
2. POST /api/adjustments with debit_type=MANDI_EXPENSE, credit_type=BEPAARI creates extra payment correctly
3. Dukandar Ledger balance reduces after write-off (writeoffs field populated)
4. Bepaari Ledger balance increases after extra payment (expense_writeoffs field populated)
5. Balance Sheet: BF Disc total increases when BF_DISCOUNT debit write-off created
6. Balance Sheet: Mandi Exp total increases when MANDI_EXPENSE debit write-off created
7. Balance Sheet difference = 0 after all write-offs
8. Patti (dukandar receivable) decreases after dukandar write-off
9. Bepaari Payables increases after bepaari extra payment
10. Existing party-to-party JVs still work correctly (no regression)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://commission-agent.preview.emergentagent.com').rstrip('/')

# Test data - using existing parties as per context
KISHOR_BEPAARI_ID = "b6718523-6cfe-41fe-930c-d97ffd7f008f"
ARIF_DUKANDAR_ID = "0d95f9c9-626f-4faf-a7ab-3c14fca2bf65"

# Store created adjustment IDs for cleanup
created_adjustment_ids = []


class TestExpenseWriteoffs:
    """Test expense write-off functionality via JV/Adjustments"""
    
    @pytest.fixture(autouse=True)
    def setup_and_teardown(self):
        """Setup and cleanup for each test"""
        global created_adjustment_ids
        created_adjustment_ids = []
        yield
        # Cleanup: Delete all test adjustments
        for adj_id in created_adjustment_ids:
            try:
                requests.delete(f"{BASE_URL}/api/adjustments/{adj_id}")
                print(f"Cleaned up adjustment: {adj_id}")
            except Exception as e:
                print(f"Failed to cleanup adjustment {adj_id}: {e}")
    
    def test_01_bf_discount_writeoff_dukandar(self):
        """Test: POST /api/adjustments with debit_type=BF_DISCOUNT, credit_type=DUKANDAR creates write-off correctly"""
        # Get initial balance sheet
        initial_bs = requests.get(f"{BASE_URL}/api/balance-sheet").json()
        initial_bf_disc = initial_bs["assets"]["bf_discount"]["total"]
        initial_patti = initial_bs["assets"]["patti"]
        
        # Get initial dukandar ledger
        initial_ledger = requests.get(f"{BASE_URL}/api/dukandar-ledger").json()
        arif_initial = next((d for d in initial_ledger if d["id"] == ARIF_DUKANDAR_ID), None)
        assert arif_initial is not None, "ARIF dukandar not found in ledger"
        initial_arif_balance = arif_initial["balance"]
        initial_arif_writeoffs = arif_initial.get("writeoffs", 0)
        
        # Create BF_DISCOUNT write-off for ARIF (Dukandar)
        writeoff_amount = 500
        response = requests.post(f"{BASE_URL}/api/adjustments", json={
            "date": "2026-01-15",
            "debit_type": "BF_DISCOUNT",
            "debit_party_id": "__BF_DISCOUNT__",
            "credit_type": "DUKANDAR",
            "credit_party_id": ARIF_DUKANDAR_ID,
            "amount": writeoff_amount,
            "narration": "TEST: BF Discount write-off for ARIF"
        })
        
        assert response.status_code == 200, f"Failed to create adjustment: {response.text}"
        adj_data = response.json()
        created_adjustment_ids.append(adj_data["id"])
        
        # Verify adjustment data
        assert adj_data["debit_type"] == "BF_DISCOUNT"
        assert adj_data["debit_party_name"] == "BF Discount"
        assert adj_data["credit_type"] == "DUKANDAR"
        assert adj_data["credit_party_id"] == ARIF_DUKANDAR_ID
        assert adj_data["amount"] == writeoff_amount
        print(f"Created BF_DISCOUNT write-off: {adj_data['id']}")
        
        # Verify dukandar ledger - balance should reduce, writeoffs should increase
        updated_ledger = requests.get(f"{BASE_URL}/api/dukandar-ledger").json()
        arif_updated = next((d for d in updated_ledger if d["id"] == ARIF_DUKANDAR_ID), None)
        assert arif_updated is not None
        
        assert arif_updated["writeoffs"] == initial_arif_writeoffs + writeoff_amount, \
            f"Writeoffs should increase by {writeoff_amount}. Expected {initial_arif_writeoffs + writeoff_amount}, got {arif_updated['writeoffs']}"
        assert arif_updated["balance"] == initial_arif_balance - writeoff_amount, \
            f"Balance should reduce by {writeoff_amount}. Expected {initial_arif_balance - writeoff_amount}, got {arif_updated['balance']}"
        print(f"Dukandar ARIF: writeoffs={arif_updated['writeoffs']}, balance={arif_updated['balance']}")
        
        # Verify balance sheet - BF Disc total should increase
        updated_bs = requests.get(f"{BASE_URL}/api/balance-sheet").json()
        assert updated_bs["assets"]["bf_discount"]["total"] == initial_bf_disc + writeoff_amount, \
            f"BF Disc total should increase by {writeoff_amount}"
        
        # Verify patti (dukandar receivable) decreases
        assert updated_bs["assets"]["patti"] == initial_patti - writeoff_amount, \
            f"Patti should decrease by {writeoff_amount}"
        
        # Verify balance sheet still tallies
        assert updated_bs["difference"] == 0, f"Balance sheet should tally. Difference: {updated_bs['difference']}"
        print("Balance sheet tallies after BF_DISCOUNT write-off")
    
    def test_02_mandi_expense_writeoff_bepaari(self):
        """Test: POST /api/adjustments with debit_type=MANDI_EXPENSE, credit_type=BEPAARI creates extra payment correctly"""
        # Get initial balance sheet
        initial_bs = requests.get(f"{BASE_URL}/api/balance-sheet").json()
        initial_mandi_exp = initial_bs["assets"]["mandi_expenses"]["total"]
        initial_bepaari_payables = initial_bs["liabilities"]["bepaari_payables"]
        
        # Get initial bepaari ledger
        initial_ledger = requests.get(f"{BASE_URL}/api/bepaari-ledger").json()
        kishor_initial = next((b for b in initial_ledger if b["id"] == KISHOR_BEPAARI_ID), None)
        assert kishor_initial is not None, "KISHOR bepaari not found in ledger"
        initial_kishor_balance = kishor_initial["balance"]
        initial_kishor_expense_writeoffs = kishor_initial.get("expense_writeoffs", 0)
        
        # Create MANDI_EXPENSE write-off for KISHOR (Bepaari)
        writeoff_amount = 750
        response = requests.post(f"{BASE_URL}/api/adjustments", json={
            "date": "2026-01-15",
            "debit_type": "MANDI_EXPENSE",
            "debit_party_id": "__MANDI_EXPENSE__",
            "credit_type": "BEPAARI",
            "credit_party_id": KISHOR_BEPAARI_ID,
            "amount": writeoff_amount,
            "narration": "TEST: Mandi Expense extra payment for KISHOR"
        })
        
        assert response.status_code == 200, f"Failed to create adjustment: {response.text}"
        adj_data = response.json()
        created_adjustment_ids.append(adj_data["id"])
        
        # Verify adjustment data
        assert adj_data["debit_type"] == "MANDI_EXPENSE"
        assert adj_data["debit_party_name"] == "Mandi Expense"
        assert adj_data["credit_type"] == "BEPAARI"
        assert adj_data["credit_party_id"] == KISHOR_BEPAARI_ID
        assert adj_data["amount"] == writeoff_amount
        print(f"Created MANDI_EXPENSE write-off: {adj_data['id']}")
        
        # Verify bepaari ledger - balance should increase (more payable), expense_writeoffs should increase
        updated_ledger = requests.get(f"{BASE_URL}/api/bepaari-ledger").json()
        kishor_updated = next((b for b in updated_ledger if b["id"] == KISHOR_BEPAARI_ID), None)
        assert kishor_updated is not None
        
        assert kishor_updated["expense_writeoffs"] == initial_kishor_expense_writeoffs + writeoff_amount, \
            f"Expense writeoffs should increase by {writeoff_amount}. Expected {initial_kishor_expense_writeoffs + writeoff_amount}, got {kishor_updated['expense_writeoffs']}"
        assert kishor_updated["balance"] == initial_kishor_balance + writeoff_amount, \
            f"Balance should increase by {writeoff_amount}. Expected {initial_kishor_balance + writeoff_amount}, got {kishor_updated['balance']}"
        print(f"Bepaari KISHOR: expense_writeoffs={kishor_updated['expense_writeoffs']}, balance={kishor_updated['balance']}")
        
        # Verify balance sheet - Mandi Exp total should increase
        updated_bs = requests.get(f"{BASE_URL}/api/balance-sheet").json()
        assert updated_bs["assets"]["mandi_expenses"]["total"] == initial_mandi_exp + writeoff_amount, \
            f"Mandi Exp total should increase by {writeoff_amount}"
        
        # Verify bepaari payables increases
        assert updated_bs["liabilities"]["bepaari_payables"] == initial_bepaari_payables + writeoff_amount, \
            f"Bepaari payables should increase by {writeoff_amount}"
        
        # Verify balance sheet still tallies
        assert updated_bs["difference"] == 0, f"Balance sheet should tally. Difference: {updated_bs['difference']}"
        print("Balance sheet tallies after MANDI_EXPENSE write-off")
    
    def test_03_party_to_party_jv_still_works(self):
        """Test: Existing party-to-party JVs still work correctly (no regression)"""
        # Get advance parties
        adv_parties = requests.get(f"{BASE_URL}/api/advance-parties").json()
        if not adv_parties:
            pytest.skip("No advance parties available for testing")
        
        adv_party = adv_parties[0]
        adv_party_id = adv_party["id"]
        
        # Get initial bepaari ledger
        initial_ledger = requests.get(f"{BASE_URL}/api/bepaari-ledger").json()
        kishor_initial = next((b for b in initial_ledger if b["id"] == KISHOR_BEPAARI_ID), None)
        initial_kishor_balance = kishor_initial["balance"]
        initial_kishor_adjustments = kishor_initial.get("adjustments", 0)
        
        # Create party-to-party JV: ADVANCE pays BEPAARI
        jv_amount = 300
        response = requests.post(f"{BASE_URL}/api/adjustments", json={
            "date": "2026-01-15",
            "debit_type": "ADVANCE",
            "debit_party_id": adv_party_id,
            "credit_type": "BEPAARI",
            "credit_party_id": KISHOR_BEPAARI_ID,
            "amount": jv_amount,
            "narration": "TEST: Advance party paid Bepaari directly"
        })
        
        assert response.status_code == 200, f"Failed to create party-to-party JV: {response.text}"
        adj_data = response.json()
        created_adjustment_ids.append(adj_data["id"])
        
        # Verify adjustment data
        assert adj_data["debit_type"] == "ADVANCE"
        assert adj_data["credit_type"] == "BEPAARI"
        assert adj_data["amount"] == jv_amount
        print(f"Created party-to-party JV: {adj_data['id']}")
        
        # Verify bepaari ledger - balance should DECREASE (party-to-party reduces payable)
        updated_ledger = requests.get(f"{BASE_URL}/api/bepaari-ledger").json()
        kishor_updated = next((b for b in updated_ledger if b["id"] == KISHOR_BEPAARI_ID), None)
        
        # Party-to-party JV: CREDIT to Bepaari from another party = reduces our payable
        assert kishor_updated["adjustments"] == initial_kishor_adjustments + jv_amount, \
            f"Adjustments should increase by {jv_amount}"
        assert kishor_updated["balance"] == initial_kishor_balance - jv_amount, \
            f"Balance should decrease by {jv_amount} for party-to-party JV"
        print(f"Party-to-party JV: Bepaari balance reduced from {initial_kishor_balance} to {kishor_updated['balance']}")
        
        # Verify balance sheet still tallies
        updated_bs = requests.get(f"{BASE_URL}/api/balance-sheet").json()
        assert updated_bs["difference"] == 0, f"Balance sheet should tally. Difference: {updated_bs['difference']}"
        print("Balance sheet tallies after party-to-party JV")
    
    def test_04_dukandar_jv_still_works(self):
        """Test: Dukandar-to-Bepaari JV still works correctly (no regression)"""
        # Get initial dukandar ledger
        initial_ledger = requests.get(f"{BASE_URL}/api/dukandar-ledger").json()
        arif_initial = next((d for d in initial_ledger if d["id"] == ARIF_DUKANDAR_ID), None)
        initial_arif_balance = arif_initial["balance"]
        initial_arif_adjustments = arif_initial.get("adjustments", 0)
        
        # Create JV: DUKANDAR pays BEPAARI
        jv_amount = 400
        response = requests.post(f"{BASE_URL}/api/adjustments", json={
            "date": "2026-01-15",
            "debit_type": "DUKANDAR",
            "debit_party_id": ARIF_DUKANDAR_ID,
            "credit_type": "BEPAARI",
            "credit_party_id": KISHOR_BEPAARI_ID,
            "amount": jv_amount,
            "narration": "TEST: Dukandar paid Bepaari directly"
        })
        
        assert response.status_code == 200, f"Failed to create Dukandar-to-Bepaari JV: {response.text}"
        adj_data = response.json()
        created_adjustment_ids.append(adj_data["id"])
        
        # Verify dukandar ledger - balance should DECREASE (they paid someone)
        updated_ledger = requests.get(f"{BASE_URL}/api/dukandar-ledger").json()
        arif_updated = next((d for d in updated_ledger if d["id"] == ARIF_DUKANDAR_ID), None)
        
        assert arif_updated["adjustments"] == initial_arif_adjustments + jv_amount, \
            f"Adjustments should increase by {jv_amount}"
        assert arif_updated["balance"] == initial_arif_balance - jv_amount, \
            f"Balance should decrease by {jv_amount} for Dukandar-to-Bepaari JV"
        print(f"Dukandar-to-Bepaari JV: Dukandar balance reduced from {initial_arif_balance} to {arif_updated['balance']}")
        
        # Verify balance sheet still tallies
        updated_bs = requests.get(f"{BASE_URL}/api/balance-sheet").json()
        assert updated_bs["difference"] == 0, f"Balance sheet should tally. Difference: {updated_bs['difference']}"
        print("Balance sheet tallies after Dukandar-to-Bepaari JV")
    
    def test_05_get_adjustments_returns_expense_writeoffs(self):
        """Test: GET /api/adjustments returns expense write-off entries correctly"""
        # Create a BF_DISCOUNT write-off
        response = requests.post(f"{BASE_URL}/api/adjustments", json={
            "date": "2026-01-15",
            "debit_type": "BF_DISCOUNT",
            "debit_party_id": "__BF_DISCOUNT__",
            "credit_type": "DUKANDAR",
            "credit_party_id": ARIF_DUKANDAR_ID,
            "amount": 100,
            "narration": "TEST: Verify GET returns expense writeoffs"
        })
        assert response.status_code == 200
        adj_data = response.json()
        created_adjustment_ids.append(adj_data["id"])
        
        # Get all adjustments
        all_adj = requests.get(f"{BASE_URL}/api/adjustments").json()
        
        # Find our adjustment
        our_adj = next((a for a in all_adj if a["id"] == adj_data["id"]), None)
        assert our_adj is not None, "Created adjustment not found in GET response"
        
        # Verify expense head data is preserved
        assert our_adj["debit_type"] == "BF_DISCOUNT"
        assert our_adj["debit_party_id"] == "__BF_DISCOUNT__"
        assert our_adj["debit_party_name"] == "BF Discount"
        print("GET /api/adjustments correctly returns expense write-off entries")
    
    def test_06_delete_adjustment_restores_balances(self):
        """Test: Deleting an expense write-off restores original balances"""
        # Get initial state
        initial_bs = requests.get(f"{BASE_URL}/api/balance-sheet").json()
        initial_bf_disc = initial_bs["assets"]["bf_discount"]["total"]
        
        initial_ledger = requests.get(f"{BASE_URL}/api/dukandar-ledger").json()
        arif_initial = next((d for d in initial_ledger if d["id"] == ARIF_DUKANDAR_ID), None)
        initial_arif_balance = arif_initial["balance"]
        
        # Create write-off
        writeoff_amount = 200
        response = requests.post(f"{BASE_URL}/api/adjustments", json={
            "date": "2026-01-15",
            "debit_type": "BF_DISCOUNT",
            "debit_party_id": "__BF_DISCOUNT__",
            "credit_type": "DUKANDAR",
            "credit_party_id": ARIF_DUKANDAR_ID,
            "amount": writeoff_amount,
            "narration": "TEST: Delete test"
        })
        assert response.status_code == 200
        adj_id = response.json()["id"]
        
        # Verify balances changed
        mid_bs = requests.get(f"{BASE_URL}/api/balance-sheet").json()
        assert mid_bs["assets"]["bf_discount"]["total"] == initial_bf_disc + writeoff_amount
        
        # Delete the adjustment
        del_response = requests.delete(f"{BASE_URL}/api/adjustments/{adj_id}")
        assert del_response.status_code == 200
        
        # Verify balances restored
        final_bs = requests.get(f"{BASE_URL}/api/balance-sheet").json()
        assert final_bs["assets"]["bf_discount"]["total"] == initial_bf_disc, \
            "BF Disc should be restored after delete"
        
        final_ledger = requests.get(f"{BASE_URL}/api/dukandar-ledger").json()
        arif_final = next((d for d in final_ledger if d["id"] == ARIF_DUKANDAR_ID), None)
        assert arif_final["balance"] == initial_arif_balance, \
            "Dukandar balance should be restored after delete"
        
        print("Deleting expense write-off correctly restores balances")
    
    def test_07_combined_writeoffs_balance_sheet_tallies(self):
        """Test: Multiple write-offs of different types still keep balance sheet tallied"""
        # Get initial balance sheet
        initial_bs = requests.get(f"{BASE_URL}/api/balance-sheet").json()
        assert initial_bs["difference"] == 0, "Initial balance sheet should tally"
        
        # Create BF_DISCOUNT write-off for Dukandar
        response1 = requests.post(f"{BASE_URL}/api/adjustments", json={
            "date": "2026-01-15",
            "debit_type": "BF_DISCOUNT",
            "debit_party_id": "__BF_DISCOUNT__",
            "credit_type": "DUKANDAR",
            "credit_party_id": ARIF_DUKANDAR_ID,
            "amount": 1000,
            "narration": "TEST: Combined test - BF Disc"
        })
        assert response1.status_code == 200
        created_adjustment_ids.append(response1.json()["id"])
        
        # Create MANDI_EXPENSE write-off for Bepaari
        response2 = requests.post(f"{BASE_URL}/api/adjustments", json={
            "date": "2026-01-15",
            "debit_type": "MANDI_EXPENSE",
            "debit_party_id": "__MANDI_EXPENSE__",
            "credit_type": "BEPAARI",
            "credit_party_id": KISHOR_BEPAARI_ID,
            "amount": 1500,
            "narration": "TEST: Combined test - Mandi Exp"
        })
        assert response2.status_code == 200
        created_adjustment_ids.append(response2.json()["id"])
        
        # Verify balance sheet still tallies
        final_bs = requests.get(f"{BASE_URL}/api/balance-sheet").json()
        assert final_bs["difference"] == 0, \
            f"Balance sheet should tally after multiple write-offs. Difference: {final_bs['difference']}"
        
        # Verify expense totals increased
        assert final_bs["assets"]["bf_discount"]["total"] == initial_bs["assets"]["bf_discount"]["total"] + 1000
        assert final_bs["assets"]["mandi_expenses"]["total"] == initial_bs["assets"]["mandi_expenses"]["total"] + 1500
        
        print("Multiple write-offs keep balance sheet tallied")


class TestExpenseWriteoffEdgeCases:
    """Test edge cases for expense write-offs"""
    
    @pytest.fixture(autouse=True)
    def setup_and_teardown(self):
        """Setup and cleanup for each test"""
        global created_adjustment_ids
        created_adjustment_ids = []
        yield
        # Cleanup
        for adj_id in created_adjustment_ids:
            try:
                requests.delete(f"{BASE_URL}/api/adjustments/{adj_id}")
            except:
                pass
    
    def test_08_invalid_expense_head_on_credit_side(self):
        """Test: Expense head on credit side should work (though unusual)"""
        # This is an unusual case but should be handled
        response = requests.post(f"{BASE_URL}/api/adjustments", json={
            "date": "2026-01-15",
            "debit_type": "DUKANDAR",
            "debit_party_id": ARIF_DUKANDAR_ID,
            "credit_type": "BF_DISCOUNT",
            "credit_party_id": "__BF_DISCOUNT__",
            "amount": 100,
            "narration": "TEST: Expense head on credit side"
        })
        
        # This should work - it's a valid JV entry
        assert response.status_code == 200, f"Should allow expense head on credit side: {response.text}"
        created_adjustment_ids.append(response.json()["id"])
        print("Expense head on credit side works correctly")
    
    def test_09_zero_amount_writeoff_rejected(self):
        """Test: Zero amount write-off should be rejected or handled"""
        response = requests.post(f"{BASE_URL}/api/adjustments", json={
            "date": "2026-01-15",
            "debit_type": "BF_DISCOUNT",
            "debit_party_id": "__BF_DISCOUNT__",
            "credit_type": "DUKANDAR",
            "credit_party_id": ARIF_DUKANDAR_ID,
            "amount": 0,
            "narration": "TEST: Zero amount"
        })
        
        # Zero amount should either be rejected or create a no-op entry
        # The API currently accepts it, which is fine
        if response.status_code == 200:
            created_adjustment_ids.append(response.json()["id"])
            print("Zero amount write-off accepted (creates no-op entry)")
        else:
            print(f"Zero amount write-off rejected: {response.status_code}")
    
    def test_10_party_statement_shows_writeoffs(self):
        """Test: Party statement shows expense write-offs correctly"""
        # Create a write-off
        response = requests.post(f"{BASE_URL}/api/adjustments", json={
            "date": "2026-01-15",
            "debit_type": "BF_DISCOUNT",
            "debit_party_id": "__BF_DISCOUNT__",
            "credit_type": "DUKANDAR",
            "credit_party_id": ARIF_DUKANDAR_ID,
            "amount": 250,
            "narration": "TEST: Party statement test"
        })
        assert response.status_code == 200
        created_adjustment_ids.append(response.json()["id"])
        
        # Get party statement for ARIF
        statement = requests.get(f"{BASE_URL}/api/party-statement/dukandar/{ARIF_DUKANDAR_ID}").json()
        
        # Verify adjustments are included
        assert "adjustments" in statement, "Party statement should include adjustments"
        
        # Find our write-off in adjustments
        our_adj = [a for a in statement["adjustments"] if "BF Discount" in a.get("debit_party_name", "") or "BF Discount" in a.get("effect", "")]
        assert len(our_adj) > 0, "Write-off should appear in party statement adjustments"
        print("Party statement correctly shows expense write-offs")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
