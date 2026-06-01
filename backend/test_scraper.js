const { getChannels, getStreamUrl } = require('./src/scraper');

async function test() {
  console.log('Fetching channels...');
  try {
    const channels = await getChannels();
    console.log('Channels found:', channels.length);
    console.log(JSON.stringify(channels, null, 2));
    
    if (channels.length > 0) {
      console.log('Fetching stream URL for first channel:', channels[0].id);
      const url = await getStreamUrl(channels[0].id);
      console.log('Stream URL:', url);
    }
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    process.exit();
  }
}

test();
