const fs = require('mz/fs');
const path = require('path');
const http = require('http');
const { Readable } = require('stream');
const colors = require('colors/safe');

let original = [];
(async () => {
  const framesPath = 'frames';
  const files = await fs.readdir(framesPath);
  files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  original = await Promise.all(files.map(async (file) => {
    const frame = await fs.readFile(path.join(framesPath, file));
    return frame.toString();
  }));
})().catch(err => console.log('Error:', err));

const colorsOptions = ['red', 'yellow', 'green', 'blue', 'magenta', 'cyan', 'white'];

const server = http.createServer((req, res) => {
  if (req.url === '/healthcheck') return res.end('ok');

  // MAX SPEED HEADERS
  res.writeHead(200, { 
    'Content-Type': 'text/plain; charset=utf-8',
    'Transfer-Encoding': 'chunked',
    'X-Accel-Buffering': 'no', 
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Create a high-speed loop
  let index = 0;
  const timer = setInterval(() => {
    if (!original.length) return;

    // Combined command: Clear + Color + Frame
    const color = colorsOptions[Math.floor(Math.random() * colorsOptions.length)];
    const frame = original[index];
    
    // Using \x1b[H to reset cursor without flickering the whole screen
    const output = `\x1b[2J\x1b[H${colors[color](frame)}`;
    
    // Force write directly to the socket bypasses Node's stream buffering
    res.write(output);

    index = (index + 1) % original.length;
  }, 60); // Dropped to 60ms to compensate for Georgia-to-Cloud latency

  res.on('close', () => clearInterval(timer));
});

const port = process.env.PORT || 10000;
server.listen(port, '0.0.0.0', () => {
  console.log(`Overclocked server live on ${port}`);
});
