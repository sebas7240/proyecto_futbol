const needle = require('needle');

async function investigate(targetUrl) {
    const url = targetUrl || 'https://rojadirectatv.net/';
    console.log(`Investigando ${url}...`);
    try {
        const response = await needle('get', url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            },
            follow_max: 5
        });
        const text = response.body;

        console.log('--- Resultados de la Investigación ---');
        console.log('Título:', text.toString().match(/<title>(.*?)<\/title>/)?.[1]);

        // Buscar iframes (común para players externos)
        const iframes = text.toString().match(/<iframe.*?src="(.*?)"/g);
        console.log('Iframes encontrados:', iframes ? iframes.length : 0);
        if (iframes) {
            iframes.slice(0, 5).forEach(f => console.log(' - ' + f));
        }

        // Buscar scripts que puedan contener m3u8 o lógica de streaming
        const scripts = text.toString().match(/<script.*?src="(.*?)"/g);
        console.log('Scripts externos encontrados:', scripts ? scripts.length : 0);

        // Buscar patrones comunes de proveedores de señales
        const providers = [
            'embed', 'player', 'stream', 'clappr', 'hls', 'video.js',
            'p2p', 'ace', 'sopcast', 'cactus', 'ovh', 'fultv'
        ];
        
        providers.forEach(p => {
            if (text.toString().toLowerCase().includes(p)) {
                console.log(`Posible proveedor detectado: ${p}`);
            }
        });

    } catch (e) {
        console.error('Error investigando:', e.message);
    }
}

const target = process.argv[2];
investigate(target);
