const fetch = require('node-fetch');

async function checkM3u8() {
    const url = 'https://anvtcax.fubohd.com/espn/mono.m3u8?token=be20bf4e40595cdf8685fd907ed3f800a4954409-6b-1780364992-1780346992';
    const headers = {
        'referer': 'https://la14hd.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.7778.96 Safari/537.36'
    };

    console.log(`Fetching ${url}...`);
    try {
        const response = await fetch(url, { headers });
        const text = await response.text();
        console.log('--- CONTENT START ---');
        console.log(text);
        console.log('--- CONTENT END ---');
    } catch (e) {
        console.error(e);
    }
}

checkM3u8();
