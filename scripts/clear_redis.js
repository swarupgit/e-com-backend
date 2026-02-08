require('dotenv').config();
const { connectRedis } = require('../src/config/redis');

// Usage: node scripts/clear_redis.js [pattern]
// pattern defaults to '*' (all keys). Provide pattern like 'products:*' to delete specific keys.
const pattern = process.argv[2] || '*';

const run = async () => {
    const client = await connectRedis();
    if (!client) {
        console.warn('Redis not available.');
        process.exit(0);
    }

    try {
        console.log(`Clearing Redis keys matching pattern: "${pattern}"`);
        const batch = [];
        let deleted = 0;

        for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 1000 })) {
            batch.push(key);
            if (batch.length >= 500) {
                await client.del(batch);
                deleted += batch.length;
                batch.length = 0;
            }
        }

        if (batch.length > 0) {
            await client.del(batch);
            deleted += batch.length;
        }

        console.log(`Deleted ${deleted} keys matching pattern "${pattern}"`);
    } catch (err) {
        console.error('Error clearing redis keys:', err.message);
    } finally {
        try { await client.quit(); } catch (e) {}
    }
};

run();
