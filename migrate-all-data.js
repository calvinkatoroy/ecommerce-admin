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
    const csvContent = fs.readFileSync(filename, 'utf8');
    const { data } = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true
    });
    return data;
  } catch (error) {
    console.error(`Error reading ${filename}:`, error.message);
    return [];
  }
}

// Helper function to handle batch inserts
async function batchInsert(tableName, data, batchSize = 100) {
  console.log(`Migrating ${data.length} records to ${tableName}...`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    try {
      const { error } = await supabase
        .from(tableName)
        .insert(batch);
      
      if (error) {
        console.error(`Error in batch ${Math.floor(i/batchSize) + 1} for ${tableName}:`, error.message);
        errorCount += batch.length;
      } else {
        successCount += batch.length;
        console.log(`✅ Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(data.length/batchSize)} completed for ${tableName}`);
      }
    } catch (err) {
      console.error(`Exception in batch ${Math.floor(i/batchSize) + 1} for ${tableName}:`, err.message);
      errorCount += batch.length;
    }
  }
  
  console.log(`${tableName} migration complete: ${successCount} success, ${errorCount} errors\n`);
  return { successCount, errorCount };
}

async function migrateAllData() {
  console.log('🚀 Starting complete data migration...\n');
  
  const migrationStats = {
    total: 0,
    success: 0,
    errors: 0
  };

  try {
    // 1. Migrate Staff
    console.log('📋 Migrating Staff...');
    const staffData = readCSV('staff.csv').map(row => ({
      original_id: row.id,
      image: row.image,
      name: row.name,
      email: row.email,
      phone: row.phone,
      status: row.status,
      role: row.role,
      created_at: row.createdAt,
      updated_at: row.updatedAt
    }));
    
    const staffResult = await batchInsert('staff', staffData);
    migrationStats.total += staffData.length;
    migrationStats.success += staffResult.successCount;
    migrationStats.errors += staffResult.errorCount;

    // 2. Migrate Customers
    console.log('👥 Migrating Customers...');
    const customersData = readCSV('customers.csv').map(row => ({
      original_id: row._id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      image: row.image,
      address: row.address,
      created_at: row.createdAt,
      updated_at: row.updatedAt
    }));
    
    const customersResult = await batchInsert('customers', customersData);
    migrationStats.total += customersData.length;
    migrationStats.success += customersResult.successCount;
    migrationStats.errors += customersResult.errorCount;

    // 3. Migrate Categories (needed before products)
    console.log('📂 Migrating Categories...');
    const categoriesData = readCSV('categories.csv').map(row => ({
      original_id: row._id,
      name: row.name,
      description: row.description,
      slug: row.slug,
      published: row.published,
      created_at: row.createdAt,
      updated_at: row.updatedAt
    }));
    
    const categoriesResult = await batchInsert('categories', categoriesData);
    migrationStats.total += categoriesData.length;
    migrationStats.success += categoriesResult.successCount;
    migrationStats.errors += categoriesResult.errorCount;

    // 4. Migrate Coupons
    console.log('🎫 Migrating Coupons...');
    const couponsData = readCSV('coupons.csv').map(row => ({
      original_id: row._id,
      title: row.title,
      coupon_code: row.couponCode,
      start_time: row.startTime,
      end_time: row.endTime,
      minimum_amount: row.minimumAmount,
      discount: row.discount,
      image: row.image,
      published: row.published,
      created_at: row.createdAt,
      updated_at: row.updatedAt
    }));
    
    const couponsResult = await batchInsert('coupons', couponsData);
    migrationStats.total += couponsData.length;
    migrationStats.success += couponsResult.successCount;
    migrationStats.errors += couponsResult.errorCount;

    // 5. Migrate Orders
    console.log('🛒 Migrating Orders...');
    const ordersData = readCSV('orders.csv').map(row => ({
      original_id: row.id,
      invoice_no: row.invoiceNo?.toString(),
      order_time: row.orderTime,
      customer_name: row.customerName,
      method: row.method,
      amount: row.amount,
      status: row.status
    }));
    
    const ordersResult = await batchInsert('orders', ordersData);
    migrationStats.total += ordersData.length;
    migrationStats.success += ordersResult.successCount;
    migrationStats.errors += ordersResult.errorCount;

    // 6. Migrate Notifications
    console.log('🔔 Migrating Notifications...');
    const rawNotifications = readCSV('notifications.csv');
    console.log(`Found ${rawNotifications.length} notification records`);
    
    // Check for duplicates in original data
    const originalIds = rawNotifications.map(r => r.id);
    const uniqueIds = new Set(originalIds);
    console.log(`Original IDs: ${originalIds.length}, Unique IDs: ${uniqueIds.size}`);
    if (originalIds.length !== uniqueIds.size) {
      console.log('⚠️  Duplicate IDs detected, will make them unique');
    }
    
    const notificationsData = rawNotifications.map((row, index) => 
      cleanNotificationData(row, index)
    );
    
    // Show how many have names vs items
    const withNames = notificationsData.filter(n => n.name).length;
    const withItems = notificationsData.filter(n => n.item).length;
    console.log(`Notifications: ${withNames} with names, ${withItems} with items`);
    
    console.log('Sample cleaned notification:', notificationsData[0]);
    
    const notificationsResult = await batchInsert('notifications', notificationsData);
    migrationStats.total += notificationsData.length;
    migrationStats.success += notificationsResult.successCount;
    migrationStats.errors += notificationsResult.errorCount;

    // 7. Get category ID mappings for products
    console.log('🔍 Building category mappings...');
    const { data: categoryData } = await supabase
      .from('categories')
      .select('id, original_id');
    
    const categoryIdMap = new Map();
    categoryData?.forEach(cat => {
      categoryIdMap.set(cat.original_id, cat.id);
    });
    console.log(`Built mapping for ${categoryIdMap.size} categories`);

    // 8. Migrate Products (complex with relationships)
    console.log('📦 Migrating Products...');
    const productsRows = readCSV('products.csv');
    
    // Extract unique categories from products CSV
    const productCategories = new Map();
    productsRows.forEach(row => {
      for (let i = 0; i < 10; i++) {
        const catId = row[`categories/${i}/_id`];
        const catName = row[`categories/${i}/name`];
        
        if (catId && catName && !categoryIdMap.has(catId)) {
          productCategories.set(catId, {
            original_id: catId,
            name: catName,
            slug: catName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            published: true
          });
        }
      }
    });

    // Insert any missing categories
    if (productCategories.size > 0) {
      console.log(`Found ${productCategories.size} additional categories in products data`);
      await batchInsert('categories', Array.from(productCategories.values()));
      
      // Refresh category mappings
      const { data: updatedCategoryData } = await supabase
        .from('categories')
        .select('id, original_id');
      
      categoryIdMap.clear();
      updatedCategoryData?.forEach(cat => {
        categoryIdMap.set(cat.original_id, cat.id);
      });
    }

    // Process each product
    for (let i = 0; i < productsRows.length; i++) {
      const row = productsRows[i];
      
      try {
        // Insert main product
        const productData = {
          original_id: row._id || row.id,
          name: row.name,
          description: row.description,
          price: row['prices/price'],
          discount_percentage: row['prices/discount'],
          stock: row.stock || 0,
          sales: row.sales || 0,
          sku: row.sku,
          status: row.status || 'selling',
          slug: row.slug,
          published: row.published !== false,
          created_at: row.createdAt,
          updated_at: row.updatedAt
        };

        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert(productData)
          .select();

        if (productError) {
          console.error(`❌ Error migrating product ${row.name}:`, productError.message);
          migrationStats.errors++;
          continue;
        }

        const productId = newProduct[0].id;
        migrationStats.success++;
        
        if ((i + 1) % 10 === 0) {
          console.log(`   Progress: ${i + 1}/${productsRows.length} products`);
        }

        // Insert product images
        const productImages = [];
        for (let j = 0; j < 10; j++) {
          const imageUrl = row[`images/${j}`];
          if (imageUrl) {
            productImages.push({
              product_id: productId,
              url: imageUrl,
              position: j
            });
          }
        }

        if (productImages.length > 0) {
          await supabase.from('product_images').insert(productImages);
        }

        // Insert product-category relationships
        const productCategoryRelations = [];
        for (let j = 0; j < 10; j++) {
          const catOriginalId = row[`categories/${j}/_id`];
          if (catOriginalId && categoryIdMap.has(catOriginalId)) {
            productCategoryRelations.push({
              product_id: productId,
              category_id: categoryIdMap.get(catOriginalId)
            });
          }
        }

        if (productCategoryRelations.length > 0) {
          await supabase.from('product_categories').insert(productCategoryRelations);
        }

        // Insert product variants
        for (let j = 0; j < 10; j++) {
          const variantId = row[`variants/${j}/_id`];
          const variantName = row[`variants/${j}/name`];
          
          if (variantId && variantName) {
            const variantData = {
              original_id: variantId,
              product_id: productId,
              name: variantName,
              slug: row[`variants/${j}/slug`],
              price: row[`variants/${j}/prices/price`],
              discount_percentage: row[`variants/${j}/prices/discount`],
              status: row[`variants/${j}/status`] || 'selling',
              stock: row[`variants/${j}/stock`] || 0,
              sku: row[`variants/${j}/sku`]
            };

            const { data: newVariant, error: variantError } = await supabase
              .from('product_variants')
              .insert(variantData)
              .select();

            if (!variantError && newVariant) {
              const variantUuid = newVariant[0].id;

              // Insert variant images
              const variantImages = [];
              for (let k = 0; k < 4; k++) {
                const imageUrl = row[`variants/${j}/images/${k}`];
                if (imageUrl) {
                  variantImages.push({
                    variant_id: variantUuid,
                    url: imageUrl,
                    position: k
                  });
                }
              }

              if (variantImages.length > 0) {
                await supabase.from('variant_images').insert(variantImages);
              }
            }
          }
        }

      } catch (err) {
        console.error(`❌ Exception processing product ${i + 1}:`, err.message);
        migrationStats.errors++;
      }
    }

    migrationStats.total += productsRows.length;

    // Final summary
    console.log('\n🎉 Migration Complete!');
    console.log('==========================================');
    console.log(`Total records processed: ${migrationStats.total}`);
    console.log(`Successful migrations: ${migrationStats.success}`);
    console.log(`Failed migrations: ${migrationStats.errors}`);
    console.log(`Success rate: ${((migrationStats.success / migrationStats.total) * 100).toFixed(1)}%`);
    
    // Verify final counts
    console.log('\n📊 Final Database Counts:');
    const tables = ['staff', 'customers', 'categories', 'coupons', 'orders', 'notifications', 'products', 'product_variants'];
    
    for (const table of tables) {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      console.log(`${table}: ${count} records`);
    }

  } catch (error) {
    console.error('💥 Migration failed:', error.message);
  }
}

// Run the migration
console.log('Starting migration script...\n');
migrateAllData();