const fetch = require('node-fetch');

async function investigate() {
    const url = 'https://mundofutbolcol.online/';
    console.log(`Fetching ${url}...`);
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            }
        });
        const text = await response.text();
        console.log('Page title:', text.match(/<title>(.*?)<\/title>/)?.[1]);
        
        // Look for iframes
        const iframes = text.match(/<iframe.*?src="(.*?)"/g);
        console.log('Found iframes:', iframes);
    } catch (e) {
        console.error(e);
    }
}

investigate();
