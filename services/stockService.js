import YahooFinance from "yahoo-finance2";

// Create a client instance (mandatory in v2)
const yahooFinance = new YahooFinance();

// SEARCH STOCKS
export const searchStocks = async (query) => {
    const response = await yahooFinance.search(query, {
        quotesCount: 20,
        newsCount: 0
    });

    console.log("RAW SEARCH RESPONSE:", response.quotes);

    return response.quotes;
};

// STOCK QUOTE
export const getStockQuote = async (symbol) => {
  const quote = await yahooFinance.quote(symbol);
  return quote || {};
};