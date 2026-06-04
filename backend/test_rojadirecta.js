const { getStreamUrl } = require('./src/scraper');

async function testRojaDirecta() {
    const testUrl = 'https://rojadirectatv.net/en-vivo/espn-1';
    console.log('Probando extracción de stream para RojaDirecta...');
    try {
        const stream = await getStreamUrl(testUrl);
        if (stream) {
            console.log('Stream encontrado:', stream.url);
        } else {
            console.log('No se encontró stream .m3u8');
        }
    } catch (e) {
        console.error('Error en el test:', e.message);
    }
    process.exit();
}

testRojaDirecta();
