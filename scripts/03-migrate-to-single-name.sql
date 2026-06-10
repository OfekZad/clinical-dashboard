-- Migration: Convert first_name and last_name to single name field
-- and make date_of_birth nullable

-- Step 1: Add new name column
ALTER TABLE patients 
ADD COLUMN name TEXT;

-- Step 2: Copy existing data (combine first_name and last_name)
UPDATE patients 
SET name = CONCAT(first_name, ' ', last_name);

-- Step 3: Make name NOT NULL after data is populated
ALTER TABLE patients 
ALTER COLUMN name SET NOT NULL;

-- Step 4: Drop old columns
ALTER TABLE patients 
DROP COLUMN first_name,
DROP COLUMN last_name;

-- Step 5: Make date_of_birth nullable
ALTER TABLE patients 
ALTER COLUMN date_of_birth DROP NOT NULL;
