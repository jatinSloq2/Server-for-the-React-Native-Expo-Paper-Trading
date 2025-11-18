// stockService.js - Real-time stock data using multiple free APIs

/**
 * OPTION 1: Alpha Vantage (Free tier: 25 requests/day)
 * Get your free API key: https://www.alphavantage.co/support/#api-key
 */
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY || 'demo'; // Replace with your key

/**
 * OPTION 2: Finnhub (Free tier: 60 calls/minute)
 * Get your free API key: https://finnhub.io/register
 */
const FINNHUB_KEY = process.env.FINNHUB_KEY || ''; // Add your key

/**
 * OPTION 3: Twelve Data (Free tier: 800 requests/day)
 * Get your free API key: https://twelvedata.com/pricing
 */
const TWELVE_DATA_KEY = process.env.TWELVE_DATA_KEY || ''; // Add your key

// Cache for storing recent quotes (to reduce API calls)
const quoteCache = new Map();
const CACHE_DURATION = 60000; // 1 minute

/**
 * Search for stocks using Finnhub API
 */
export const searchStocks = async (query) => {
    if (!FINNHUB_KEY) {
        console.error('FINNHUB_KEY not set');
        return mockSearchResults(query);
    }

    try {
        const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${FINNHUB_KEY}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
        }

        const data = await response.json();
        return data.result || [];
    } catch (error) {
        console.error("searchStocks error:", error);
        return mockSearchResults(query);
    }
};

/**
 * Get stock quote using Finnhub (primary method)
 */
const getStockQuoteFinnhub = async (symbol) => {
    if (!FINNHUB_KEY) {
        return null;
    }

    try {
        // Get real-time quote
        const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`;
        const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`;

        const [quoteRes, profileRes] = await Promise.all([
            fetch(quoteUrl),
            fetch(profileUrl)
        ]);

        if (!quoteRes.ok) return null;

        const quote = await quoteRes.json();
        const profile = profileRes.ok ? await profileRes.json() : {};

        if (!quote.c) return null; // No current price

        return {
            symbol: symbol,
            name: profile.name || symbol,
            price: quote.c,
            previousClose: quote.pc,
            change: quote.c - quote.pc,
            changePercent: ((quote.c - quote.pc) / quote.pc) * 100,
            high: quote.h,
            low: quote.l,
            open: quote.o,
            timestamp: quote.t * 1000,
            exchange: profile.exchange || '',
            currency: profile.currency || 'USD',
            marketCap: profile.marketCapitalization ? profile.marketCapitalization * 1000000 : 0,
            logo: profile.logo || ''
        };
    } catch (error) {
        console.error(`Finnhub error for ${symbol}:`, error.message);
        return null;
    }
};

/**
 * Get stock quote using Alpha Vantage (fallback)
 */
const getStockQuoteAlphaVantage = async (symbol) => {
    if (!ALPHA_VANTAGE_KEY || ALPHA_VANTAGE_KEY === 'demo') {
        return null;
    }

    try {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${ALPHA_VANTAGE_KEY}`;
        const response = await fetch(url);

        if (!response.ok) return null;

        const data = await response.json();
        const quote = data['Global Quote'];

        if (!quote || !quote['05. price']) return null;

        const price = parseFloat(quote['05. price']);
        const previousClose = parseFloat(quote['08. previous close']);
        const change = parseFloat(quote['09. change']);
        const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));

        return {
            symbol: symbol,
            name: symbol,
            price: price,
            previousClose: previousClose,
            change: change,
            changePercent: changePercent,
            high: parseFloat(quote['03. high']),
            low: parseFloat(quote['04. low']),
            open: parseFloat(quote['02. open']),
            volume: parseInt(quote['06. volume']),
            timestamp: Date.now(),
            exchange: '',
            currency: 'USD',
            marketCap: 0
        };
    } catch (error) {
        console.error(`Alpha Vantage error for ${symbol}:`, error.message);
        return null;
    }
};

/**
 * Get stock quote using Twelve Data (alternative)
 */
const getStockQuoteTwelveData = async (symbol) => {
    if (!TWELVE_DATA_KEY) {
        return null;
    }

    try {
        const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${TWELVE_DATA_KEY}`;
        const response = await fetch(url);

        if (!response.ok) return null;

        const data = await response.json();

        if (data.code === 401 || !data.close) return null;

        const price = parseFloat(data.close);
        const previousClose = parseFloat(data.previous_close);
        const change = price - previousClose;
        const changePercent = (change / previousClose) * 100;

        return {
            symbol: data.symbol,
            name: data.name || data.symbol,
            price: price,
            previousClose: previousClose,
            change: change,
            changePercent: changePercent,
            high: parseFloat(data.high),
            low: parseFloat(data.low),
            open: parseFloat(data.open),
            volume: parseInt(data.volume),
            timestamp: Date.now(),
            exchange: data.exchange || '',
            currency: data.currency || 'USD',
            marketCap: 0
        };
    } catch (error) {
        console.error(`Twelve Data error for ${symbol}:`, error.message);
        return null;
    }
};

/**
 * Main function to get stock quote with fallback chain
 */
export const getStockQuote = async (symbol) => {
    // Check cache first
    const cached = quoteCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log(`Using cached data for ${symbol}`);
        return cached.data;
    }

    // Try APIs in order: Finnhub -> Twelve Data -> Alpha Vantage
    let quote = await getStockQuoteFinnhub(symbol);
    
    if (!quote) {
        console.log(`Finnhub failed for ${symbol}, trying Twelve Data...`);
        quote = await getStockQuoteTwelveData(symbol);
    }
    
    if (!quote) {
        console.log(`Twelve Data failed for ${symbol}, trying Alpha Vantage...`);
        quote = await getStockQuoteAlphaVantage(symbol);
    }

    if (quote) {
        // Cache the result
        quoteCache.set(symbol, {
            data: quote,
            timestamp: Date.now()
        });
    }

    return quote;
};

/**
 * Mock search results for demo purposes
 */
const mockSearchResults = (query) => {
    const mockStocks = [
        { symbol: 'AAPL', description: 'Apple Inc', displaySymbol: 'AAPL', type: 'Common Stock' },
        { symbol: 'TSLA', description: 'Tesla Inc', displaySymbol: 'TSLA', type: 'Common Stock' },
        { symbol: 'MSFT', description: 'Microsoft Corporation', displaySymbol: 'MSFT', type: 'Common Stock' },
        { symbol: 'GOOGL', description: 'Alphabet Inc Class A', displaySymbol: 'GOOGL', type: 'Common Stock' },
        { symbol: 'AMZN', description: 'Amazon.com Inc', displaySymbol: 'AMZN', type: 'Common Stock' },
        { symbol: 'META', description: 'Meta Platforms Inc', displaySymbol: 'META', type: 'Common Stock' },
        { symbol: 'NVDA', description: 'NVIDIA Corporation', displaySymbol: 'NVDA', type: 'Common Stock' },
    ];

    const lowerQuery = query.toLowerCase();
    return mockStocks.filter(stock => 
        stock.symbol.toLowerCase().includes(lowerQuery) ||
        stock.description.toLowerCase().includes(lowerQuery)
    );
};

/**
 * Format search result
 */
export const formatSearchResult = (stock) => {
    return {
        symbol: stock.symbol || stock.displaySymbol || "",
        name: stock.description || "",
        exchange: stock.type || "",
        type: stock.type || "EQUITY",
        score: 10
    };
};

/**
 * Format quote data
 */
export const formatQuote = (quote) => {
    return {
        symbol: quote.symbol,
        name: quote.name || quote.symbol,
        price: parseFloat(quote.price.toFixed(2)),
        change: parseFloat(quote.change.toFixed(2)),
        changePercent: parseFloat(quote.changePercent.toFixed(2)),
        previousClose: parseFloat(quote.previousClose.toFixed(2)),
        open: parseFloat((quote.open || 0).toFixed(2)),
        dayHigh: parseFloat((quote.high || 0).toFixed(2)),
        dayLow: parseFloat((quote.low || 0).toFixed(2)),
        volume: quote.volume || 0,
        marketCap: quote.marketCap || 0,
        fiftyTwoWeekHigh: 0, // Not available in free APIs
        fiftyTwoWeekLow: 0,  // Not available in free APIs
        exchange: quote.exchange || "",
        currency: quote.currency || "USD",
        marketState: "REGULAR",
        timestamp: quote.timestamp || Date.now()
    };
};

// CONTROLLERS
export const searchStocksController = async (req, res) => {
    try {
        const query = req.query.q?.trim();
        if (!query || query.length < 2) return res.json([]);

        const matches = await searchStocks(query);
        const cleaned = matches.map(formatSearchResult);
        const sorted = cleaned.sort((a, b) => b.score - a.score);

        res.json(sorted);
    } catch (err) {
        console.error("Search error:", err);
        res.status(500).json({ error: "Search failed" });
    }
};

export const getStockDetailController = async (req, res) => {
    try {
        const { symbol } = req.params;

        console.log(`Fetching quote for symbol: ${symbol}`);
        
        const quote = await getStockQuote(symbol);
        
        if (!quote) {
            console.error(`No quote data available for ${symbol}`);
            return res.status(404).json({ 
                message: "Stock data not available",
                symbol: symbol,
                hint: "Make sure API keys are configured. See README for setup instructions."
            });
        }

        const formatted = formatQuote(quote);
        
        console.log(`Successfully fetched quote for ${symbol}: $${formatted.price}`);

        res.json(formatted);
    } catch (err) {
        console.error("Detail error:", err);
        res.status(500).json({ 
            message: "Error fetching stock detail",
            error: err.message 
        });
    }
};