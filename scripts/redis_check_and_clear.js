require('dotenv').config();
const { connectRedis, getRedisClient, getCache, deleteCachePattern, isRedisConnected } = require('../src/config/redis');

const patterns = ['products:*', 'categories:*', 'merchant:*'];

const run = async () => {
    const client = await connectRedis();
    if (!client || !isRedisConnected()) {
        console.warn('Redis not available — skipping cache inspection');
        return;
    }

    for (const pattern of patterns) {
        try {
            const keys = await client.keys(pattern);
            console.log(`Pattern '${pattern}' -> ${keys.length} keys`);
            if (keys.length === 0) continue;

            // Inspect first key
            const sampleKey = keys[0];
            const cached = await getCache(sampleKey);
            console.log('Sample key:', sampleKey);
            console.log('Cached value type:', cached === null ? 'null' : Array.isArray(cached) ? 'array' : typeof cached);
            if (Array.isArray(cached) && cached.length === 0) {
                console.log(`Cached array is empty for pattern ${pattern} — deleting keys for this pattern.`);
                const ok = await deleteCachePattern(pattern);
                console.log('Delete result:', ok);
            } else if (cached === null) {
                console.log('Cached value is null — consider deleting stale keys. Deleting keys for this pattern.');
                const ok = await deleteCachePattern(pattern);
                console.log('Delete result:', ok);
            } else {
                console.log('Cached sample (truncated):', JSON.stringify(cached).slice(0, 1000));
            }
        } catch (err) {
            console.error('Error inspecting pattern', pattern, err.message);
        }
    }

    try {
        await client.quit();
    } catch (e) {}
};

run();
