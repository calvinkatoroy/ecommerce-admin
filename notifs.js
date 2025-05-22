const { createClient } = require('@supabase/supabase-js');
const Papa = require('papaparse');
const fs = require('fs');

// Supabase configuration
const supabaseUrl = 'https://dcrvzyhfdruhleffqrgz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjcnZ6eWhmZHJ1aGxlZmZxcmd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzgzNTU5OSwiZXhwIjoyMDYzNDExNTk5fQ.XDTdXJRygbmi01HkGfyYe6rVWl7IgLr7U0ZDf8dXgic'; // Replace with your service role key
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to read and parse CSV
function readCSV(filename) {
  try {
    console.log(`📖 Reading ${filename}...`);
    const csvContent = fs.readFileSync(filename, 'utf8');
    const { data } = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true
    });
    console.log(`✅ Successfully loaded ${data.length} records from ${filename}`);
    return data;
  } catch (error) {
    console.error(`❌ Error reading ${filename}:`, error.message);
    return [];
  }
}

// Helper function to remove duplicate notifications
function removeDuplicateNotifications(notifications) {
  console.log('🔍 Checking for duplicates...');
  const seen = new Set();
  const unique = [];
  const duplicates = [];
  
  notifications.forEach((row, index) => {
    // Create a unique key based on all important fields
    const key = `${row.id}-${row.type}-${row.name || ''}-${row.item || ''}-${row.timestamp}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(row);
    } else {
      duplicates.push({
        index: index + 1,
        id: row.id,
        type: row.type,
        name: row.name,
        item: row.item
      });
    }
  });
  
  if (duplicates.length > 0) {
    console.log(`⚠️  Found ${duplicates.length} duplicate notifications:`);
    duplicates.forEach(dup => {
      console.log(`   Row ${dup.index}: ${dup.id} (${dup.type}) - ${dup.name || dup.item || 'Unknown'}`);
    });
    console.log(`✅ Keeping ${unique.length} unique notifications`);
  } else {
    console.log('✅ No duplicates found');
  }
  
  return unique;
}

// Helper function to clean and validate notification data
function cleanNotificationData(row, index) {
  // Handle name field (can be null for item-based notifications)
  let cleanName = null;
  if (row.name && row.name.toString().trim()) {
    cleanName = row.name.toString().trim();
  }

  // Handle type field (required)
  let cleanType = row.type;
  if (!cleanType || cleanType.toString().trim() === '') {
    cleanType = 'general';
    console.warn(`⚠️  Row ${index + 1}: Empty type replaced with "general"`);
  }

  // Handle timestamp (keep original format since it's custom)
  let cleanTimestamp = row.timestamp;
  if (!cleanTimestamp) {
    cleanTimestamp = new Date().toISOString();
    console.warn(`⚠️  Row ${index + 1}: Empty timestamp replaced with current time`);
  }

  // Convert isRead string to boolean
  let isRead = false;
  if (row.isRead === "true" || row.isRead === true) {
    isRead = true;
  } else if (row.isRead === "false" || row.isRead === false) {
    isRead = false;
  }

  // Handle price (can be null)
  let cleanPrice = null;
  if (row.price && !isNaN(row.price)) {
    cleanPrice = parseFloat(row.price);
  }

  const cleanedData = {
    original_id: row.id?.toString() || `notif_${index + 1}`,
    image_url: row.imageUrl || null,
    name: cleanName, // Can be null for item-based notifications
    timestamp: cleanTimestamp,
    type: cleanType.toString().trim(),
    price: cleanPrice,
    is_read: isRead,
    item: row.item || null
  };

  return cleanedData;
}

// Function to validate cleaned data
function validateNotificationData(data) {
  console.log('🔍 Validating notification data...');
  const errors = [];
  
  data.forEach((row, index) => {
    // Check required fields
    if (!row.original_id) {
      errors.push(`Row ${index + 1}: Missing original_id`);
    }
    if (!row.timestamp) {
      errors.push(`Row ${index + 1}: Missing timestamp`);
    }
    if (!row.type) {
      errors.push(`Row ${index + 1}: Missing type`);
    }
    
    // Check that either name or item exists (business logic validation)
    if (!row.name && !row.item) {
      console.warn(`⚠️  Row ${index + 1}: Neither name nor item specified - this might be intentional`);
    }
  });
  
  if (errors.length > 0) {
    console.error('❌ Validation errors found:');
    errors.forEach(error => console.error(`   ${error}`));
    return false;
  }
  
  console.log('✅ Data validation passed');
  return true;
}

// Function to display data summary
function displayDataSummary(data) {
  console.log('\n📊 Data Summary:');
  console.log('================');
  
  const withNames = data.filter(n => n.name).length;
  const withItems = data.filter(n => n.item).length;
  const withPrices = data.filter(n => n.price).length;
  const readNotifications = data.filter(n => n.is_read).length;
  
  console.log(`Total notifications: ${data.length}`);
  console.log(`With names (user notifications): ${withNames}`);
  console.log(`With items (product notifications): ${withItems}`);
  console.log(`With prices: ${withPrices}`);
  console.log(`Read notifications: ${readNotifications}`);
  console.log(`Unread notifications: ${data.length - readNotifications}`);
  
  // Show types
  const types = {};
  data.forEach(n => {
    types[n.type] = (types[n.type] || 0) + 1;
  });
  console.log('\nNotification types:');
  Object.entries(types).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  
  // Show sample data
  console.log('\nSample notifications:');
  data.slice(0, 2).forEach((notif, index) => {
    console.log(`  ${index + 1}. ${notif.type} - ${notif.name || notif.item || 'No name/item'} (${notif.is_read ? 'Read' : 'Unread'})`);
  });
}

// Main migration function
async function migrateNotifications() {
  console.log('🚀 Starting Notifications Migration');
  console.log('===================================\n');
  
  try {
    // Step 1: Read CSV data
    const rawNotifications = readCSV('notifications.csv');
    
    if (rawNotifications.length === 0) {
      console.log('❌ No notification data found. Exiting.');
      return;
    }
    
    // Step 2: Remove duplicates
    const uniqueNotifications = removeDuplicateNotifications(rawNotifications);
    
    // Step 3: Clean and validate data
    console.log('\n🧹 Cleaning notification data...');
    const cleanedData = uniqueNotifications.map((row, index) => 
      cleanNotificationData(row, index)
    );
    
    // Step 4: Validate data
    if (!validateNotificationData(cleanedData)) {
      console.log('❌ Data validation failed. Please fix errors and try again.');
      return;
    }
    
    // Step 5: Display summary
    displayDataSummary(cleanedData);
    
    // Step 6: Check if table exists and is accessible
    console.log('\n🔗 Testing database connection...');
    try {
      const { count, error: countError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.error('❌ Cannot access notifications table:', countError.message);
        console.log('💡 Make sure the table exists and you have the correct permissions');
        return;
      }
      
      console.log(`✅ Database connection successful. Current notifications in table: ${count}`);
    } catch (err) {
      console.error('❌ Database connection failed:', err.message);
      return;
    }
    
    // Step 7: Migrate data
    console.log('\n📤 Inserting notifications into database...');
    
    const { data: insertedData, error: insertError } = await supabase
      .from('notifications')
      .insert(cleanedData)
      .select();
    
    if (insertError) {
      console.error('❌ Migration failed:', insertError.message);
      console.log('\n🔧 Troubleshooting suggestions:');
      
      if (insertError.message.includes('not-null constraint')) {
        console.log('   - A required field is null. Check the data cleaning logic.');
      }
      if (insertError.message.includes('unique constraint')) {
        console.log('   - Duplicate values found. Check the duplicate removal logic.');
      }
      if (insertError.message.includes('foreign key')) {
        console.log('   - Referenced record does not exist in related table.');
      }
      
      console.log('   - Verify your Supabase service role key is correct');
      console.log('   - Check table permissions and RLS policies');
      
      return;
    }
    
    // Step 8: Verify migration
    console.log(`✅ Successfully inserted ${insertedData.length} notifications!`);
    
    // Final verification
    const { count: finalCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true });
    
    console.log(`✅ Final verification: ${finalCount} total notifications in database`);
    
    console.log('\n🎉 Notifications migration completed successfully!');
    console.log('=============================================');
    
  } catch (error) {
    console.error('💥 Unexpected error during migration:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the migration
console.log('Notifications Migration Script');
console.log('==============================');
console.log('Make sure you have:');
console.log('1. notifications.csv file in the current directory');
console.log('2. Updated the Supabase service role key in this script');
console.log('3. Created the notifications table in Supabase');
console.log('4. Made the "name" column nullable if needed\n');

migrateNotifications();

module.exports = { migrateNotifications };