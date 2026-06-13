const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'iptv_sv_channels.json');
const outputPath = path.join(root, 'iptv_active_channels.json');
const blockedPattern = /(premium|\bespn\b|dsports|directv sports|movistar plus|fox sports|win sports|\bdazn\b)/i;

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const channels = source.channels.filter(channel => {
  const label = `${channel.category || ''} ${channel.name || ''}`;
  return !blockedPattern.test(label) && /^https?:\/\//i.test(channel.url || '');
});

fs.writeFileSync(
  outputPath,
  `${JSON.stringify({ ...source, total: channels.length, channels }, null, 2)}\n`,
  'utf8'
);

console.log(`Generated ${channels.length} active channels in ${outputPath}`);
