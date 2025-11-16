import axios from "axios";
import { searchStocks, getStockQuote } from "../services/stockService.js";

// Format search results
const formatSearchResult = (item) => ({
    symbol: item["1. symbol"],
    name: item["2. name"],
    type: item["3. type"],
    region: item["4. region"],
    currency: item["8. currency"],
    score: parseFloat(item["9. matchScore"])
});

// Format stock details
const formatQuote = (q) => ({
    symbol: q["01. symbol"],
    open: Number(q["02. open"]),
    high: Number(q["03. high"]),
    low: Number(q["04. low"]),
    price: Number(q["05. price"]),
    volume: Number(q["06. volume"]),
    latestTradingDay: q["07. latest trading day"],
    previousClose: Number(q["08. previous close"]),
    change: Number(q["09. change"]),
    changePercent: q["10. change percent"]
});

// SEARCH CONTROLLER
export const searchStocksController = async (req, res) => {
    try {
        const query = req.query.q?.trim();

        if (!query || query.length < 2) return res.json([]);

        const matches = await searchStocks(query);
        const cleaned = matches.map(formatSearchResult);

        const filtered = cleaned.filter(i => i.score >= 0.45);
        const sorted = filtered.sort((a, b) => b.score - a.score);

        res.json(sorted);
    } catch (err) {
        console.error("Search error:", err);
        res.status(500).json({ error: "Search failed" });
    }
};

// STOCK DETAIL CONTROLLER
export const getStockDetailController = async (req, res) => {
    try {
        const { symbol } = req.params;

        const quote = await getStockQuote(symbol);
        if (!quote || Object.keys(quote).length === 0) {
            return res.status(404).json({ message: "No data found" });
        }

        const clean = formatQuote(quote);

        res.json(clean);
    } catch (error) {
        console.error("Detail error:", error);
        res.status(500).json({ message: "Error fetching stock detail" });
    }
};
