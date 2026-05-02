const fs = require('mz/fs');
const path = require('path');
const http = require('http');
const url = require('url');
const { Readable } = require('stream');
const colors = require('colors/safe');

let original = [];
let flipped = [];

(async () => {
  const framesPath = 'frames';
  const files = await fs.readdir(framesPath);
  files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  original = await Promise.all(files.map(async (file) => {
    const frame = await fs.readFile(path.join(framesPath, file));
    return frame.toString();
  }));

  flipped = original.map(f => f.toString().split('').reverse().join(''));
})().catch((err) => {
  console.log('Error loading frames', err);
});

const colorsOptions = ['red', 'yellow', 'green', 'blue', 'magenta', 'cyan', 'white'];
const selectColor = prev => {
  let c;
  do { c = Math.floor(Math.random() * colorsOptions.length); } while (c === prev);
  return c;
};

function streamer(stream, opts) {
  const frames = opts.flip ? flipped : original;
  let index = 0;
  let lastColor;
  let timer;

  function tick() {
    if (!frames.length) return;
    // Clear screen and reset cursor
    stream.push('\u001b[2J\u001b[H');

    const colorIdx = lastColor = selectColor(lastColor);
    const coloredFrame = colors[colorsOptions[colorIdx]](frames[index]);
    
    stream.push(coloredFrame);
    index = (index + 1) % frames.length;
    timer = setTimeout(tick, 70); // 70ms is roughly 14 FPS
  }

  tick();
  return () => clearTimeout(timer);
}

const server = http.createServer((req, res) => {
  if (req.url === '/healthcheck') {
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  // SPEED FIX: Force no buffering
  res.writeHead(200, { 
    'Content-Type': 'text/plain; charset=utf-8',
    'Transfer-Encoding': 'chunked',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Tells Nginx/Render to stop buffering
    'Cache-Control': 'no-cache'
  });
  
  res.flushHeaders(); // Send headers immediately

  const stream = new Readable({ read() {} });
  stream.pipe(res);

  const query = url.parse(req.url, true).query;
  const cleanup = streamer(stream, { flip: query.flip === 'true' });

  res.on('close', () => {
    cleanup();
    stream.destroy();
  });
});

const port = process.env.PORT || 10000;
server.listen(port, '0.0.0.0', () => {
  console.log(`Speed optimized server on port ${port}`);
});
