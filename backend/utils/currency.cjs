var oxr = require('open-exchange-rates');
oxr.set({ app_id: '46cb84176e214972a1beaa2c89f4b0d6' });

oxr.latest(function () {
    if (!oxr.rates) {
        console.error('Failed to fetch rates.');
        return;
    }

    const base = oxr.base; // عادة USD
    const rates = oxr.rates;
    console.log(base);
    console.log(rates);
});
