const redis = require('redis');
require('dotenv').config();

let redisClient = null;
let isRedisAvailable = false;

const connectRedis = async () => {
    try {
        // Skip Redis if explicitly disabled in environment
        if (process.env.REDIS_ENABLED === 'false') {
            console.log('ℹ Redis disabled via environment variable');
            return null;
        }

        redisClient = redis.createClient({
            socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                connectTimeout: 5000, // 5 second timeout
                reconnectStrategy: false // Disable automatic reconnection attempts
            },
            password: process.env.REDIS_PASSWORD || undefined
        });

        redisClient.on('error', (err) => {
            // Only log if we're supposed to be connected
            if (isRedisAvailable) {
                console.error('Redis Client Error:', err.message);
                isRedisAvailable = false;
            }
        });

        redisClient.on('connect', () => {
            console.log('✓ Redis connected successfully');
            isRedisAvailable = true;
        });

        redisClient.on('disconnect', () => {
            console.warn('⚠ Redis disconnected');
            isRedisAvailable = false;
        });

        await redisClient.connect();
        isRedisAvailable = true;
        return redisClient;
    } catch (error) {
        console.warn('✗ Redis connection failed (Optional):', error.message);
        console.warn('  Application will continue without caching');
        isRedisAvailable = false;
        
        // Clean up the client if connection failed
        if (redisClient) {
            try {
                await redisClient.quit();
            } catch (e) {
                // Ignore quit errors
            }
        }
        redisClient = null;
        return null;
    }
};

const getRedisClient = () => redisClient;

const isRedisConnected = () => isRedisAvailable && redisClient && redisClient.isOpen;

// Helper function to safely get cached data
const getCache = async (key) => {
    if (!isRedisConnected()) {
        return null;
    }
    try {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Redis GET error:', error.message);
        return null;
    }
};

// Helper function to safely set cached data
const setCache = async (key, value, expirationInSeconds = 3600) => {
    if (!isRedisConnected()) {
        return false;
    }
    try {
        await redisClient.setEx(key, expirationInSeconds, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error('Redis SET error:', error.message);
        return false;
    }
};

// Helper function to delete cached data
const deleteCache = async (key) => {
    if (!isRedisConnected()) {
        return false;
    }
    try {
        await redisClient.del(key);
        return true;
    } catch (error) {
        console.error('Redis DEL error:', error.message);
        return false;
    }
};

// Helper function to delete multiple keys by pattern
const deleteCachePattern = async (pattern) => {
    if (!isRedisConnected()) {
        return false;
    }
    try {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
        }
        return true;
    } catch (error) {
        console.error('Redis DELETE pattern error:', error.message);
        return false;
    }
};

module.exports = { 
    connectRedis, 
    getRedisClient, 
    isRedisConnected,
    getCache,
    setCache,
    deleteCache,
    deleteCachePattern
};
