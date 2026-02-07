const { getCache, setCache, deleteCache, deleteCachePattern, isRedisConnected } = require('../config/redis');

/**
 * Wrapper function to get data with optional caching
 * If Redis is available, it will try to get from cache first
 * If cache miss or Redis unavailable, it will execute the callback to fetch from DB
 * 
 * @param {string} cacheKey - The cache key
 * @param {Function} fetchFunction - Async function to fetch data from DB
 * @param {number} ttl - Time to live in seconds (default: 1 hour)
 * @returns {Promise<any>} - The data
 */
const getCachedData = async (cacheKey, fetchFunction, ttl = 3600) => {
    try {
        // Try to get from cache if Redis is available
        if (isRedisConnected()) {
            const cachedData = await getCache(cacheKey);
            if (cachedData !== null) {
                console.log(`Cache HIT: ${cacheKey}`);
                return cachedData;
            }
            console.log(`Cache MISS: ${cacheKey}`);
        }

        // Fetch from database
        const data = await fetchFunction();
        
        // Store in cache if Redis is available
        if (isRedisConnected() && data) {
            await setCache(cacheKey, data, ttl);
        }

        return data;
    } catch (error) {
        console.error('Cache helper error:', error.message);
        // Fallback to direct DB fetch
        return await fetchFunction();
    }
};

/**
 * Invalidate cache by key
 * @param {string} cacheKey - The cache key to invalidate
 */
const invalidateCache = async (cacheKey) => {
    if (isRedisConnected()) {
        await deleteCache(cacheKey);
        console.log(`Cache invalidated: ${cacheKey}`);
    }
};

/**
 * Invalidate multiple cache keys by pattern
 * @param {string} pattern - The pattern to match (e.g., 'products:*')
 */
const invalidateCachePattern = async (pattern) => {
    if (isRedisConnected()) {
        await deleteCachePattern(pattern);
        console.log(`Cache invalidated by pattern: ${pattern}`);
    }
};

module.exports = {
    getCachedData,
    invalidateCache,
    invalidateCachePattern
};
