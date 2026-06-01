const { Parser } = require('m3u8-parser');
const needle = require('needle');

async function parseM3u8() {
    const url = 'https://wp9xqedt.fubohd.com/espn/mono.m3u8?token=6e0f08f5a53250f6f77b6eec260cd97b88cf02fa-79-1780365422-1780347422';
    const options = {
        headers: {
            'referer': 'https://la14hd.com/',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.7778.96 Safari/537.36'
        }
    };

    try {
        const response = await needle('get', url, options);
        const text = response.body.toString();
        const parser = new Parser();
        parser.push(text);
        parser.end();

        console.log('Manifest:', JSON.stringify(parser.manifest, null, 2));
    } catch (e) {
        console.error(e);
    }
}

parseM3u8();
