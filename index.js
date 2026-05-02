const fs = require('mz/fs');
const path = require('path');
const http = require('http');
const url = require('url');
const { Readable } = require('stream');
const colors = require('colors/safe');

// Load frames into memory once
let original = [];
let flipped = [];

(async () => {
  const framesPath = 'frames';
  const files = await fs.readdir(framesPath);

  // Sort files numerically to ensure 1, 2, 3... order
  files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  original = await Promise.all(files.map(async (file) => {
    const frame = await fs.readFile(path.join(framesPath, file));
    return frame.toString();
  }));

  flipped = original.map(f => {
    return f
      .toString()
      .split('')
      .reverse()
      .join('');
  });
})().catch((err) => {
  console.log('Error loading frames');
  console.log(err);
});

const colorsOptions = [
  'red',
  'yellow',
  'green',
  'blue',
  'magenta',
  'cyan',
  'white'
];

const numColors = colorsOptions.length;
const selectColor = previousColor => {
  let color;
  do {
    color = Math.floor(Math.random() * numColors);
  } while (color === previousColor);
  return color;
};

function streamer(stream, opts) {
  const frames = opts.flip ? flipped : original;
  let index = 0;
  let lastColor;
  let timer;

  function tick() {
    if (!frames.length) return;

    // Clear screen and reset cursor
    stream.push('\u001b[2J\u001b[3J\u001b[H');

    // Color frame
    const colorIdx = lastColor = selectColor(lastColor);
    const coloredFrame = colors[colorsOptions[colorIdx]](frames[index]);

    // Push frame and check for backpressure
    const ok = stream.push(coloredFrame);
    index = (index + 1) % frames.length;

    if (ok) {
      timer = setTimeout(tick, 70);
    } else {
      stream.once('drain', () => {
        timer = setTimeout(tick, 70);
      });
    }
  }

  tick();

  return () => {
    clearTimeout(timer);
  };
}

const validateQuery = ({ flip }) => ({ flip: String(flip).toLowerCase() === 'true' });

const server = http.createServer((req, res) => {
  // Healthcheck route for Render
  if (req.url === '/healthcheck') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  // Set streaming headers to prevent buffering and stuck frames
  res.writeHead(200, { 
    'Content-Type': 'text/plain; charset=utf-8',
    'Transfer-Encoding': 'chunked',
    'Connection': 'keep-alive'
  });

  const stream = new Readable({ read() {} });
  stream.pipe(res);

  const opts = validateQuery(url.parse(req.url, true).query);
  const cleanupLoop = streamer(stream, opts);

  const onClose = () => {
    cleanupLoop();
    stream.destroy();
  };

  res.on('close', onClose);
  res.on('error', onClose);
});

// THE CRITICAL FIX: Listen on '0.0.0.0' instead of just 'localhost'
const port = process.env.PORT || 3000;
server.listen(port, '0.0.0.0', (err) => {
  if (err) {
    console.error('Error starting server:', err);
    return;
  }
  console.log(`Server is finally public on port ${port}`);
});
