# Test Credentials

## Admin Account
- Email: admin@mandi.com
- Password: mandi@2026
- Role: admin

## Operator Account
- Email: operator@mandi.com
- Password: oper@2026
- Role: user (operator — data entry only, no balance sheet/settings/export)

## Demo Account (isolated tenant)
- Email: demo@mandipro.in
- Password: demo@2026
- Role: admin (within demo tenant only)
- Tenant: demo (data lives in `<DB_NAME>_demo` MongoDB database — fully isolated from production data)
- Can call POST /api/demo/reset to wipe demo data
