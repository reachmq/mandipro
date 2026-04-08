"""
Backend API Tests for Mandi Accounting Software
Tests: Daily Sales Edit, Party Statement with JV, Balance Sheet with individual names, CSV Export
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test Bepaari ID with JV adjustments
TEST_BEPAARI_ID = "4355b776-51ed-48c1-b594-10fbfb19b494"


class TestDailySalesEdit:
    """Test Daily Sales PUT endpoint for editing sales"""
    
    def test_daily_sales_get(self):
        """Test GET daily sales endpoint"""
        response = requests.get(f"{BASE_URL}/api/daily-sales?bepaari_id={TEST_BEPAARI_ID}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ GET /api/daily-sales returned {len(data)} sales")
    
    def test_daily_sales_put_update_discount(self):
        """Test PUT endpoint to update discount and verify recalculation"""
        # Get existing sale
        response = requests.get(f"{BASE_URL}/api/daily-sales?bepaari_id={TEST_BEPAARI_ID}")
        assert response.status_code == 200
        sales = response.json()
        assert len(sales) > 0
        
        sale = sales[0]
        sale_id = sale['id']
        original_discount = sale['discount']
        original_net = sale['net_amount']
        original_gross = sale['gross_amount']
        
        # Update discount to 100
        test_discount = 100
        put_response = requests.put(
            f"{BASE_URL}/api/daily-sales/{sale_id}",
            json={"discount": test_discount}
        )
        assert put_response.status_code == 200
        assert put_response.json()['status'] == 'updated'
        print(f"✓ PUT /api/daily-sales/{sale_id} returned status: updated")
        
        # Verify the update
        verify_response = requests.get(f"{BASE_URL}/api/daily-sales?bepaari_id={TEST_BEPAARI_ID}")
        updated_sale = [s for s in verify_response.json() if s['id'] == sale_id][0]
        
        assert updated_sale['discount'] == test_discount
        expected_net = original_gross - test_discount
        assert updated_sale['net_amount'] == expected_net
        print(f"✓ Discount updated to {test_discount}, net_amount recalculated to {expected_net}")
        
        # Revert to original
        revert_response = requests.put(
            f"{BASE_URL}/api/daily-sales/{sale_id}",
            json={"discount": original_discount}
        )
        assert revert_response.status_code == 200
        print(f"✓ Reverted discount back to {original_discount}")
    
    def test_daily_sales_put_update_quantity_rate(self):
        """Test PUT endpoint to update quantity and rate"""
        response = requests.get(f"{BASE_URL}/api/daily-sales?bepaari_id={TEST_BEPAARI_ID}")
        sales = response.json()
        sale = sales[0]
        sale_id = sale['id']
        original_qty = sale['quantity']
        original_rate = sale['rate']
        
        # Update quantity
        new_qty = original_qty + 1
        put_response = requests.put(
            f"{BASE_URL}/api/daily-sales/{sale_id}",
            json={"quantity": new_qty}
        )
        assert put_response.status_code == 200
        
        # Verify
        verify_response = requests.get(f"{BASE_URL}/api/daily-sales?bepaari_id={TEST_BEPAARI_ID}")
        updated_sale = [s for s in verify_response.json() if s['id'] == sale_id][0]
        assert updated_sale['quantity'] == new_qty
        assert updated_sale['gross_amount'] == new_qty * original_rate
        print(f"✓ Quantity updated to {new_qty}, gross_amount recalculated")
        
        # Revert
        requests.put(f"{BASE_URL}/api/daily-sales/{sale_id}", json={"quantity": original_qty})
        print(f"✓ Reverted quantity back to {original_qty}")


class TestPartyStatementWithJV:
    """Test Party Statement includes JV/Adjustments"""
    
    def test_party_statement_bepaari_includes_adjustments(self):
        """Test that Bepaari party statement includes JV adjustments"""
        response = requests.get(f"{BASE_URL}/api/party-statement/bepaari/{TEST_BEPAARI_ID}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert 'party' in data
        assert 'sales' in data
        assert 'cash_entries' in data
        assert 'adjustments' in data
        assert 'summary' in data
        
        # Verify adjustments exist
        adjustments = data['adjustments']
        assert isinstance(adjustments, list)
        assert len(adjustments) >= 2, f"Expected at least 2 JV adjustments, got {len(adjustments)}"
        print(f"✓ Party statement includes {len(adjustments)} JV adjustments")
        
        # Verify adjustment structure
        for adj in adjustments:
            assert 'date' in adj
            assert 'direction' in adj
            assert 'effect' in adj
            assert 'amount' in adj
            assert adj['direction'] in ['CREDIT', 'DEBIT']
        print("✓ Adjustment entries have correct structure (date, direction, effect, amount)")
        
        # Verify summary includes total_adjustments
        summary = data['summary']
        assert 'total_adjustments' in summary
        total_adj = sum(a['amount'] for a in adjustments)
        assert summary['total_adjustments'] == total_adj
        print(f"✓ Summary total_adjustments = {summary['total_adjustments']}")
    
    def test_party_statement_dukandar(self):
        """Test Dukandar party statement endpoint"""
        # Get a dukandar ID
        dukandars_response = requests.get(f"{BASE_URL}/api/dukandars")
        dukandars = dukandars_response.json()
        if len(dukandars) > 0:
            dukandar_id = dukandars[0]['id']
            response = requests.get(f"{BASE_URL}/api/party-statement/dukandar/{dukandar_id}")
            assert response.status_code == 200
            data = response.json()
            assert 'adjustments' in data
            print(f"✓ Dukandar party statement includes adjustments field")


class TestBalanceSheetIndividualNames:
    """Test Balance Sheet shows individual Capital/Loans/Amanat names"""
    
    def test_balance_sheet_structure(self):
        """Test balance sheet returns correct structure with individual lists"""
        response = requests.get(f"{BASE_URL}/api/balance-sheet")
        assert response.status_code == 200
        data = response.json()
        
        # Verify main structure
        assert 'liabilities' in data
        assert 'assets' in data
        assert 'difference' in data
        
        liabilities = data['liabilities']
        
        # Verify individual lists exist
        assert 'capital_list' in liabilities
        assert 'loans_list' in liabilities
        assert 'amanat_list' in liabilities
        print("✓ Balance sheet includes capital_list, loans_list, amanat_list")
        
        # Verify capital_list structure
        capital_list = liabilities['capital_list']
        assert isinstance(capital_list, list)
        if len(capital_list) > 0:
            for item in capital_list:
                assert 'id' in item
                assert 'name' in item
                assert 'amount' in item
            print(f"✓ capital_list has {len(capital_list)} entries with id, name, amount")
        
        # Verify amanat_list structure
        amanat_list = liabilities['amanat_list']
        if len(amanat_list) > 0:
            for item in amanat_list:
                assert 'id' in item
                assert 'name' in item
                assert 'amount' in item
            print(f"✓ amanat_list has {len(amanat_list)} entries with id, name, amount")
    
    def test_balance_sheet_tallies(self):
        """Test that balance sheet difference is 0 (tallied)"""
        response = requests.get(f"{BASE_URL}/api/balance-sheet")
        assert response.status_code == 200
        data = response.json()
        
        liabilities_total = data['liabilities']['total']
        assets_total = data['assets']['total']
        difference = data['difference']
        
        assert difference == 0, f"Balance sheet not tallied! Diff: {difference}"
        assert liabilities_total == assets_total
        print(f"✓ Balance sheet TALLIED: Liabilities={liabilities_total}, Assets={assets_total}, Diff={difference}")
    
    def test_balance_sheet_totals_match_lists(self):
        """Test that totals match sum of individual lists"""
        response = requests.get(f"{BASE_URL}/api/balance-sheet")
        data = response.json()
        liabilities = data['liabilities']
        
        # Capital total should match sum of capital_list
        capital_list_sum = sum(p['amount'] for p in liabilities['capital_list'])
        assert liabilities['capital'] == capital_list_sum
        print(f"✓ Capital total ({liabilities['capital']}) matches capital_list sum")
        
        # Amanat total should match sum of amanat_list
        amanat_list_sum = sum(p['amount'] for p in liabilities['amanat_list'])
        assert liabilities['amanat'] == amanat_list_sum
        print(f"✓ Amanat total ({liabilities['amanat']}) matches amanat_list sum")


class TestCSVExportWithAdjustments:
    """Test CSV Export includes adjustments section"""
    
    def test_csv_export_includes_adjustments(self):
        """Test that CSV export includes ADJUSTMENTS (JV) section"""
        response = requests.get(f"{BASE_URL}/api/export/party-statement/bepaari/{TEST_BEPAARI_ID}")
        assert response.status_code == 200
        
        content = response.text
        
        # Verify adjustments section exists
        assert "=== ADJUSTMENTS (JV) ===" in content
        print("✓ CSV export includes '=== ADJUSTMENTS (JV) ===' section")
        
        # Verify adjustment headers
        assert "Date,Direction,Effect,Amount,Narration" in content
        print("✓ CSV export has adjustment column headers")
        
        # Verify summary includes adjustments
        assert "Total Adjustments (JV)" in content
        print("✓ CSV export summary includes 'Total Adjustments (JV)'")
    
    def test_csv_export_content_type(self):
        """Test CSV export returns correct content type"""
        response = requests.get(f"{BASE_URL}/api/export/party-statement/bepaari/{TEST_BEPAARI_ID}")
        assert response.status_code == 200
        assert 'text/csv' in response.headers.get('content-type', '')
        print("✓ CSV export returns text/csv content type")


class TestAdjustmentsEndpoint:
    """Test Adjustments/JV endpoint"""
    
    def test_get_adjustments(self):
        """Test GET adjustments endpoint"""
        response = requests.get(f"{BASE_URL}/api/adjustments")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/adjustments returned {len(data)} entries")
        
        if len(data) > 0:
            adj = data[0]
            assert 'debit_type' in adj
            assert 'debit_party_name' in adj
            assert 'credit_type' in adj
            assert 'credit_party_name' in adj
            assert 'amount' in adj
            print("✓ Adjustment entries have correct structure")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
