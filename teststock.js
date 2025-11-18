// test-stocks.js - Test utility for debugging stock API issues

import { getStockQuote, formatQuote, searchStocks } from './controllers/stockController.js';

// Test symbols from different exchanges
const TEST_SYMBOLS = [
    'AAPL',      // US - Apple
    'TSLA',      // US - Tesla
    'MSFT',      // US - Microsoft
    'GOOGL',     // US - Google
    'HWHG.F',    // Germany - Frankfurt
    'VOW3.DE',   // Germany - Volkswagen
    'BP.L',      // UK - BP London
    'TM',        // US ADR - Toyota
];

/**
 * Test a single stock symbol
 */
async function testSymbol(symbol) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${symbol}`);
    console.log('='.repeat(60));
    
    try {
        const quote = await getStockQuote(symbol);
        
        if (!quote) {
            console.error(`❌ FAILED: No data returned for ${symbol}`);
            return { symbol, success: false, error: 'No data' };
        }
        
        const formatted = formatQuote(quote);
        
        console.log('✅ SUCCESS');
        console.log(`Name: ${formatted.name}`);
        console.log(`Price: ${formatted.currency} ${formatted.price}`);
        console.log(`Change: ${formatted.change} (${formatted.changePercent}%)`);
        console.log(`Exchange: ${formatted.exchange}`);
        console.log(`Market State: ${formatted.marketState}`);
        console.log(`Quote Type: ${formatted.quoteType}`);
        console.log(`Region: ${formatted.region}`);
        
        return { symbol, success: true, data: formatted };
    } catch (error) {
        console.error(`❌ ERROR: ${error.message}`);
        return { symbol, success: false, error: error.message };
    }
}

/**
 * Test search functionality
 */
async function testSearch(query) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing Search: "${query}"`);
    console.log('='.repeat(60));
    
    try {
        const results = await searchStocks(query);
        
        if (results.length === 0) {
            console.log('⚠️  No results found');
            return;
        }
        
        console.log(`✅ Found ${results.length} results:`);
        results.slice(0, 5).forEach((stock, i) => {
            console.log(`${i + 1}. ${stock.symbol} - ${stock.shortname || stock.longname}`);
            console.log(`   Exchange: ${stock.exchange} | Type: ${stock.quoteType}`);
        });
    } catch (error) {
        console.error(`❌ Search Error: ${error.message}`);
    }
}

/**
 * Direct API test to see raw response
 */
async function testRawAPI(symbol) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Raw API Test: ${symbol}`);
    console.log('='.repeat(60));
    
    const endpoints = [
        `https://query1.finance.yahoo.com/v1/finance/quote?symbols=${symbol}`,
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`,
        `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price`
    ];
    
    for (const [index, url] of endpoints.entries()) {
        try {
            console.log(`\nTrying endpoint ${index + 1}:`);
            console.log(url);
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            console.log(`Status: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Response received');
                console.log('Raw data keys:', Object.keys(data));
                
                if (data.quoteResponse?.result?.[0]) {
                    const quote = data.quoteResponse.result[0];
                    console.log('Quote keys:', Object.keys(quote));
                    console.log('Price fields:', {
                        regularMarketPrice: quote.regularMarketPrice,
                        currentPrice: quote.currentPrice,
                        ask: quote.ask,
                        bid: quote.bid
                    });
                } else if (data.quoteSummary?.result?.[0]) {
                    console.log('QuoteSummary format detected');
                }
            } else {
                console.error(`❌ Status ${response.status}`);
                const text = await response.text();
                console.error('Response:', text.substring(0, 200));
            }
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
        }
    }
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log('\n' + '='.repeat(60));
    console.log('STOCK API COMPREHENSIVE TEST');
    console.log('='.repeat(60));
    
    // Test search
    await testSearch('Tesla');
    await testSearch('HWHG');
    
    // Test symbols
    const results = [];
    for (const symbol of TEST_SYMBOLS) {
        const result = await testSymbol(symbol);
        results.push(result);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`Total: ${results.length}`);
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    
    if (failed > 0) {
        console.log('\nFailed symbols:');
        results.filter(r => !r.success).forEach(r => {
            console.log(`  - ${r.symbol}: ${r.error}`);
        });
    }
    
    // Special test for HWHG.F
    console.log('\n' + '='.repeat(60));
    console.log('DETAILED TEST FOR HWHG.F');
    await testRawAPI('HWHG.F');
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllTests().then(() => {
        console.log('\n✅ All tests completed');
        process.exit(0);
    }).catch(err => {
        console.error('\n❌ Test suite failed:', err);
        process.exit(1);
    });
}

runAllTests()

export { testSymbol, testSearch, testRawAPI, runAllTests };