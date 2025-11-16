import axios from "axios";
import cache from "../utils/cache.js";
import { ALPHA_BASE_URL, API_KEY } from "../config/alphaVantage.js";

// Search service
export const searchStocks = async (query) => {
    const cacheKey = `search_${query}`;
    if (cache.get(cacheKey)) return cache.get(cacheKey);

    const url = `${ALPHA_BASE_URL}?function=SYMBOL_SEARCH&keywords=${query}&apikey=${API_KEY}`;
    const response = await axios.get(url);

    const result = response.data.bestMatches || [];
    cache.set(cacheKey, result);

    return result;
};

// Stock detail service
export const getStockQuote = async (symbol) => {
    const cacheKey = `quote_${symbol}`;
    if (cache.get(cacheKey)) return cache.get(cacheKey);

    const url = `${ALPHA_BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
    const response = await axios.get(url);

    const result = response.data["Global Quote"] || {};
    cache.set(cacheKey, result);

    return result;
};
