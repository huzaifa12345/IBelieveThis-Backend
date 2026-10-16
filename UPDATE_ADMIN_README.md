# Update User to Admin Role

## ⚠️ IMPORTANT: Database Migration Required

Since the User model was changed from ENUM to STRING, you need to run a migration before starting the server.

## Step 1: Run Database Migration

### Method A: Automated Migration Script
```bash
cd Backend
node scripts/migrateUserRole.js
```

### Method B: Manual SQL Execution
1. Connect to your PostgreSQL database
2. Run the SQL script: `scripts/migrateUserRole.sql`

### Method C: Copy-Paste SQL
```sql
-- Drop ENUM constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Update existing values
UPDATE users SET role = 'user' WHERE role = 'customer';

-- Convert to VARCHAR
ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(255);

-- Set default
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';
```

## Step 2: Start the Backend Server
```bash
cd Backend
npm start
```

## What was done:
1. ✅ Updated User model to use `DataTypes.STRING` for role field with default value `'user'`
2. ✅ Created migration script to handle ENUM to VARCHAR conversion
3. ✅ Created temporary admin routes at `/api/temp-admin`
4. ✅ Created script to update user role to admin

## Method 1: Using the API Endpoint

### Step 1: Start the backend server
```bash
cd Backend
npm start
```

### Step 2: Update user role using curl or Postman
```bash
curl -X POST http://localhost:3001/api/temp-admin/update-admin \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com"}'
```

### Step 3: Verify the update (optional)
```bash
curl -X GET http://localhost:3001/api/temp-admin/users
```

## Method 2: Using the Script

### Step 1: Run the script directly
```bash
cd Backend
node scripts/updateAdmin.js your-email@example.com
```

## Method 3: Manual Database Update

If you prefer to update directly in the database:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

## Important Notes:

1. **Database Migration**: MUST run migration before starting server
2. **Security**: Remember to remove or disable the temporary admin routes after you're done:
   - Delete the `tempAdmin.js` route file
   - Remove the route import from `server.js`

3. **Default Role**: All new users will now have `role: 'user'` by default

4. **Admin Privileges**: Make sure your authentication middleware checks for `role === 'admin'` to protect admin routes.

## Current User Model Structure:
```javascript
role: {
  type: DataTypes.STRING,
  defaultValue: 'user',
}
```

## Available Roles:
- `user` - Default role for regular customers (replaces 'customer')
- `admin` - Administrative privileges

## Migration Details:
The migration handles:
- Dropping the old ENUM constraint
- Converting existing 'customer' roles to 'user'
- Changing column type from ENUM to VARCHAR(255)
- Setting new default value to 'user'

## Verification:
After updating, you can verify the user's role by checking the database or using the GET users endpoint.
