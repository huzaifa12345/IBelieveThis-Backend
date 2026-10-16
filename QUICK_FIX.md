# QUICK FIX FOR USER ROLE ENUM ERROR

## The Problem
Sequelize is trying to migrate from ENUM to STRING but the database has existing ENUM constraints that are blocking the change.

## Solution Steps

### Step 1: Revert User Model (Temporary)
I've already reverted the User model back to ENUM. Your server should start now.

### Step 2: Start the Server
```bash
cd Backend
npm start
```

### Step 3: Run the Fix Script
In a NEW terminal (while server is running):
```bash
cd Backend
node scripts/fixUserRole.js
```

### Step 4: Stop Server & Update Model
Stop the server (Ctrl+C) and then update the User model back to STRING:

Change this in `models/User.js`:
```javascript
role: {
  type: DataTypes.STRING,
  defaultValue: 'user',
},
```

### Step 5: Start Server Again
```bash
npm start
```

## Alternative: Aggressive Fix (Last Resort)
If the above doesn't work, you can use the aggressive approach:

```bash
# Backup your data first!
cd Backend
node scripts/aggressiveFix.js
```

## What the Fix Script Does:
1. Drops existing ENUM constraints
2. Updates data to use valid enum values
3. Converts column to VARCHAR
4. Sets new default to 'user'
5. Updates all 'customer' to 'user'

## After Fix:
- All existing 'customer' users become 'user'
- New users default to 'user'
- You can use the admin update scripts

## Verification:
Check that users have the correct roles:
```bash
curl -X GET http://localhost:3001/api/temp-admin/users
```
