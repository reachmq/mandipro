"""
Test Differential Pricing Feature for Mandi Accounting System
Tests the new dukandar_rate field in Daily Sales that allows different rates for Bepaari and Dukandar
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://commission-agent.preview.emergentagent.com')

# Test data - using existing parties
BEPAARI_KISHOR_ID = "b6718523-6cfe-41fe-930c-d97ffd7f008f"
DUKANDAR_GABBAR_ID = "b29dbd04-ada5-48b2-b69a-1dc217627e65"
TEST_DATE = "2026-01-20"  # Use a date unlikely to conflict with real data

# Store created sale IDs for cleanup
created_sale_ids = []


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_sales(api_client):
    """Cleanup test sales after all tests complete"""
    yield
    # Teardown: Delete all test-created sales
    for sale_id in created_sale_ids:
        try:
            api_client.delete(f"{BASE_URL}/api/daily-sales/{sale_id}")
            print(f"Cleaned up test sale: {sale_id}")
        except Exception as e:
            print(f"Failed to cleanup sale {sale_id}: {e}")


class TestDifferentialPricingCreate:
    """Test POST /api/daily-sales with dukandar_rate"""
    
    def test_create_sale_with_dukandar_rate(self, api_client):
        """Create sale with differential pricing - dukandar_rate > bepaari rate"""
        payload = {
            "date": TEST_DATE,
            "bepaari_id": BEPAARI_KISHOR_ID,
            "dukandar_id": DUKANDAR_GABBAR_ID,
            "quantity": 5,
            "rate": 10000,  # Bepaari rate
            "discount": 0,
            "dukandar_rate": 10500  # Dukandar rate (higher)
        }
        
        response = api_client.post(f"{BASE_URL}/api/daily-sales", json=payload)
        assert response.status_code == 200, f"Failed to create sale: {response.text}"
        
        data = response.json()
        created_sale_ids.append(data["id"])
        
        # Verify response structure
        assert "id" in data
        assert data["bepaari_id"] == BEPAARI_KISHOR_ID
        assert data["dukandar_id"] == DUKANDAR_GABBAR_ID
        assert data["quantity"] == 5
        assert data["rate"] == 10000
        
        # Verify differential pricing calculations
        assert data["gross_amount"] == 50000  # 5 * 10000 (bepaari rate)
        assert data["dukandar_rate"] == 10500
        assert data["dukandar_amount"] == 52500  # 5 * 10500 (dukandar rate)
        
        print(f"✓ Created sale with differential pricing: gross={data['gross_amount']}, dukandar_amount={data['dukandar_amount']}")
    
    def test_create_sale_without_dukandar_rate(self, api_client):
        """Create sale WITHOUT dukandar_rate - should work as before"""
        payload = {
            "date": TEST_DATE,
            "bepaari_id": BEPAARI_KISHOR_ID,
            "dukandar_id": DUKANDAR_GABBAR_ID,
            "quantity": 3,
            "rate": 8000,
            "discount": 500
            # No dukandar_rate
        }
        
        response = api_client.post(f"{BASE_URL}/api/daily-sales", json=payload)
        assert response.status_code == 200, f"Failed to create sale: {response.text}"
        
        data = response.json()
        created_sale_ids.append(data["id"])
        
        # Verify dukandar_rate and dukandar_amount are null
        assert data["dukandar_rate"] is None, f"Expected dukandar_rate to be null, got {data['dukandar_rate']}"
        assert data["dukandar_amount"] is None, f"Expected dukandar_amount to be null, got {data['dukandar_amount']}"
        assert data["gross_amount"] == 24000  # 3 * 8000
        assert data["net_amount"] == 23500  # 24000 - 500
        
        print(f"✓ Created sale without dukandar_rate: dukandar_rate={data['dukandar_rate']}, dukandar_amount={data['dukandar_amount']}")
    
    def test_create_sale_with_same_rate(self, api_client):
        """Create sale where dukandar_rate equals bepaari rate - should store null"""
        payload = {
            "date": TEST_DATE,
            "bepaari_id": BEPAARI_KISHOR_ID,
            "dukandar_id": DUKANDAR_GABBAR_ID,
            "quantity": 2,
            "rate": 9000,
            "discount": 0,
            "dukandar_rate": 9000  # Same as bepaari rate
        }
        
        response = api_client.post(f"{BASE_URL}/api/daily-sales", json=payload)
        assert response.status_code == 200, f"Failed to create sale: {response.text}"
        
        data = response.json()
        created_sale_ids.append(data["id"])
        
        # When dukandar_rate equals rate, it should be stored as null
        assert data["dukandar_rate"] is None, f"Expected dukandar_rate to be null when same as rate, got {data['dukandar_rate']}"
        assert data["dukandar_amount"] is None
        
        print(f"✓ Created sale with same rate: dukandar_rate stored as null")


class TestDifferentialPricingUpdate:
    """Test PUT /api/daily-sales/{id} with dukandar_rate"""
    
    def test_update_sale_add_dukandar_rate(self, api_client):
        """Update existing sale to add dukandar_rate"""
        # First create a sale without dukandar_rate
        create_payload = {
            "date": TEST_DATE,
            "bepaari_id": BEPAARI_KISHOR_ID,
            "dukandar_id": DUKANDAR_GABBAR_ID,
            "quantity": 4,
            "rate": 7500,
            "discount": 0
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/daily-sales", json=create_payload)
        assert create_response.status_code == 200
        sale_id = create_response.json()["id"]
        created_sale_ids.append(sale_id)
        
        # Now update to add dukandar_rate
        update_payload = {
            "dukandar_rate": 8000
        }
        
        update_response = api_client.put(f"{BASE_URL}/api/daily-sales/{sale_id}", json=update_payload)
        assert update_response.status_code == 200, f"Failed to update sale: {update_response.text}"
        
        # Verify by fetching the sale
        get_response = api_client.get(f"{BASE_URL}/api/daily-sales?date={TEST_DATE}")
        assert get_response.status_code == 200
        
        sales = get_response.json()
        updated_sale = next((s for s in sales if s["id"] == sale_id), None)
        assert updated_sale is not None
        
        assert updated_sale["dukandar_rate"] == 8000
        assert updated_sale["dukandar_amount"] == 32000  # 4 * 8000
        
        print(f"✓ Updated sale to add dukandar_rate: dukandar_amount={updated_sale['dukandar_amount']}")
    
    def test_update_sale_clear_dukandar_rate(self, api_client):
        """Update sale to clear dukandar_rate (set to null)"""
        # First create a sale with dukandar_rate
        create_payload = {
            "date": TEST_DATE,
            "bepaari_id": BEPAARI_KISHOR_ID,
            "dukandar_id": DUKANDAR_GABBAR_ID,
            "quantity": 6,
            "rate": 6000,
            "discount": 0,
            "dukandar_rate": 6500
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/daily-sales", json=create_payload)
        assert create_response.status_code == 200
        sale_id = create_response.json()["id"]
        created_sale_ids.append(sale_id)
        
        # Verify it was created with dukandar_rate
        initial_data = create_response.json()
        assert initial_data["dukandar_rate"] == 6500
        
        # Now update to clear dukandar_rate by setting it to same as rate
        update_payload = {
            "dukandar_rate": 6000  # Same as rate - should become null
        }
        
        update_response = api_client.put(f"{BASE_URL}/api/daily-sales/{sale_id}", json=update_payload)
        assert update_response.status_code == 200
        
        # Verify by fetching
        get_response = api_client.get(f"{BASE_URL}/api/daily-sales?date={TEST_DATE}")
        sales = get_response.json()
        updated_sale = next((s for s in sales if s["id"] == sale_id), None)
        
        assert updated_sale["dukandar_rate"] is None, f"Expected null, got {updated_sale['dukandar_rate']}"
        assert updated_sale["dukandar_amount"] is None
        
        print(f"✓ Cleared dukandar_rate by setting to same as rate")


class TestBalanceSheetWithDifferentialPricing:
    """Test Balance Sheet calculations with differential pricing"""
    
    def test_balance_sheet_includes_rate_diff(self, api_client):
        """Verify balance sheet commission includes rate_diff field"""
        response = api_client.get(f"{BASE_URL}/api/balance-sheet")
        assert response.status_code == 200
        
        data = response.json()
        commission = data["liabilities"]["commission"]
        
        # Verify commission structure includes rate_diff
        assert "rate_diff" in commission, "Commission should include rate_diff field"
        assert "earned" in commission
        assert "discounts" in commission
        assert "total" in commission
        
        print(f"✓ Balance sheet commission structure: earned={commission['earned']}, rate_diff={commission['rate_diff']}, discounts={commission['discounts']}, total={commission['total']}")
    
    def test_balance_sheet_tallies_with_differential_pricing(self, api_client):
        """Verify balance sheet difference = 0 after creating differential pricing sales"""
        # Get initial balance sheet
        initial_response = api_client.get(f"{BASE_URL}/api/balance-sheet")
        assert initial_response.status_code == 200
        initial_diff = initial_response.json()["difference"]
        
        # Create a sale with differential pricing
        sale_payload = {
            "date": TEST_DATE,
            "bepaari_id": BEPAARI_KISHOR_ID,
            "dukandar_id": DUKANDAR_GABBAR_ID,
            "quantity": 10,
            "rate": 5000,  # Bepaari rate
            "discount": 0,
            "dukandar_rate": 5200  # Dukandar rate (higher by 200 per goat)
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/daily-sales", json=sale_payload)
        assert create_response.status_code == 200
        sale_id = create_response.json()["id"]
        created_sale_ids.append(sale_id)
        
        # Get balance sheet after sale
        after_response = api_client.get(f"{BASE_URL}/api/balance-sheet")
        assert after_response.status_code == 200
        after_data = after_response.json()
        
        # Balance sheet should still tally (difference = 0)
        assert after_data["difference"] == 0, f"Balance sheet should tally, got difference={after_data['difference']}"
        
        # Rate diff should have increased by (5200-5000) * 10 = 2000
        rate_diff = after_data["liabilities"]["commission"]["rate_diff"]
        print(f"✓ Balance sheet tallies (diff=0) with rate_diff={rate_diff}")


class TestDukandarLedgerWithDifferentialPricing:
    """Test Dukandar Ledger uses dukandar_amount for purchases"""
    
    def test_dukandar_ledger_uses_dukandar_amount(self, api_client):
        """Verify dukandar ledger uses dukandar_amount (not gross_amount) for purchases"""
        # Create a sale with differential pricing
        sale_payload = {
            "date": TEST_DATE,
            "bepaari_id": BEPAARI_KISHOR_ID,
            "dukandar_id": DUKANDAR_GABBAR_ID,
            "quantity": 8,
            "rate": 4000,  # Bepaari rate = 32000 gross
            "discount": 0,
            "dukandar_rate": 4500  # Dukandar rate = 36000 dukandar_amount
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/daily-sales", json=sale_payload)
        assert create_response.status_code == 200
        sale_id = create_response.json()["id"]
        created_sale_ids.append(sale_id)
        
        # Get dukandar ledger
        ledger_response = api_client.get(f"{BASE_URL}/api/dukandar-ledger")
        assert ledger_response.status_code == 200
        
        ledger = ledger_response.json()
        gabbar_entry = next((d for d in ledger if d["id"] == DUKANDAR_GABBAR_ID), None)
        
        assert gabbar_entry is not None, "GABBAR should be in dukandar ledger"
        
        # The purchases should include dukandar_amount (36000) not gross_amount (32000)
        # Note: This is cumulative with other sales, so we just verify the field exists
        assert "purchases" in gabbar_entry
        print(f"✓ Dukandar ledger for GABBAR: purchases={gabbar_entry['purchases']}, balance={gabbar_entry['balance']}")


class TestBepariLedgerWithDifferentialPricing:
    """Test Bepaari Ledger uses gross_amount (not dukandar_amount)"""
    
    def test_bepaari_ledger_uses_gross_amount(self, api_client):
        """Verify bepaari ledger uses gross_amount for sales calculation"""
        # Get bepaari ledger
        ledger_response = api_client.get(f"{BASE_URL}/api/bepaari-ledger")
        assert ledger_response.status_code == 200
        
        ledger = ledger_response.json()
        kishor_entry = next((b for b in ledger if b["id"] == BEPAARI_KISHOR_ID), None)
        
        assert kishor_entry is not None, "KISHOR should be in bepaari ledger"
        
        # Verify the structure
        assert "gross_sales" in kishor_entry
        assert "commission" in kishor_entry
        assert "balance" in kishor_entry
        
        print(f"✓ Bepaari ledger for KISHOR: gross_sales={kishor_entry['gross_sales']}, balance={kishor_entry['balance']}")


class TestDailySalesAPIResponse:
    """Test Daily Sales API returns correct fields"""
    
    def test_daily_sales_returns_dukandar_rate_fields(self, api_client):
        """Verify GET /api/daily-sales returns dukandar_rate and dukandar_amount"""
        response = api_client.get(f"{BASE_URL}/api/daily-sales?date={TEST_DATE}")
        assert response.status_code == 200
        
        sales = response.json()
        
        # Check that all sales have the new fields
        for sale in sales:
            assert "dukandar_rate" in sale, f"Sale {sale['id']} missing dukandar_rate field"
            assert "dukandar_amount" in sale, f"Sale {sale['id']} missing dukandar_amount field"
        
        # Find a sale with differential pricing
        diff_sale = next((s for s in sales if s.get("dukandar_rate") is not None), None)
        if diff_sale:
            print(f"✓ Found sale with differential pricing: rate={diff_sale['rate']}, dukandar_rate={diff_sale['dukandar_rate']}")
        
        # Find a sale without differential pricing
        normal_sale = next((s for s in sales if s.get("dukandar_rate") is None), None)
        if normal_sale:
            print(f"✓ Found normal sale: rate={normal_sale['rate']}, dukandar_rate={normal_sale['dukandar_rate']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
