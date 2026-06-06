const { getChannels, getStreamUrl } = require("./src/scraper");

async function testMultipleChannels() {
    console.log("--- Iniciando Test de Canales ---");
    try {
        const channels = await getChannels();
        console.log(`Total de canales encontrados: ${channels.length}`);
        
        // Seleccionamos algunos canales clave para probar
        const toTest = channels.filter(c => 
            c.name.includes("ESPN") || 
            c.name.includes("TNT") || 
            c.name.includes("DIRECTV") ||
            c.name.includes("TYC")
        ).slice(0, 5);

        for (const ch of toTest) {
            console.log(`\nProbando: ${ch.name} (${ch.id})`);
            try {
                const stream = await getStreamUrl(ch.id);
                if (stream && stream.url) {
                    console.log(`✅ EXITO: ${stream.url.substring(0, 60)}...`);
                    console.log(`   Headers: ${JSON.stringify(stream.headers).substring(0, 100)}...`);
                } else {
                    console.log(`❌ FALLO: No se obtuvo URL de streaming`);
                }
            } catch (err) {
                console.log(`❌ ERROR: ${err.message}`);
            }
        }
    } catch (err) {
        console.error("Error general en el test:", err.message);
    }
}

testMultipleChannels();
