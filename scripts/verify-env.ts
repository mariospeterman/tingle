import { redisService } from '../services/redis.js';
import { supabase, supabaseAdmin } from '../services/supabase.js';

async function verifyEnvironment() {
  console.log('Verifying environment setup...');

  // Check Supabase connection
  try {
    console.log('\nChecking Supabase connection...');
    
    // Test public connection
    const { data: publicData, error: publicError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (publicError) throw publicError;
    console.log('✅ Supabase public connection successful');
    
    // Test admin connection
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('users')
      .select('count')
      .limit(1);
    
    if (adminError) throw adminError;
    console.log('✅ Supabase admin connection successful');
  } catch (error) {
    console.error('❌ Supabase connection failed:', error);
    process.exit(1);
  }

  // Check Redis connection
  try {
    console.log('\nChecking Redis connection...');
    await redisService.connect();
    await redisService.publish('test', 'test message');
    console.log('✅ Redis connection successful');
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    process.exit(1);
  }

  console.log('\n✅ All environment checks passed!');
  process.exit(0);
}

verifyEnvironment().catch((error) => {
  console.error('Verification failed:', error);
  process.exit(1);
}); 