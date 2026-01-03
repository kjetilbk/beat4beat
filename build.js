import * as esbuild from 'esbuild';
import { createServer } from 'node:http';
import { readFile, copyFile, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { config } from 'dotenv';
import chokidar from 'chokidar';

config();

if (!process.env.CAST_APP_ID) {
  console.error('❌ Error: CAST_APP_ID environment variable is required');
  console.error('   Create a .env file with: CAST_APP_ID=your_app_id');
  process.exit(1);
}

const watch = process.argv.includes('--watch');

const baseConfig = {
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  format: 'esm',
  sourcemap: true,
  write: !watch,
  jsx: 'transform',
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  loader: {
    '.ts': 'ts',
    '.tsx': 'tsx',
    '.svg': 'text',
  },
  define: {
    'process.env.CAST_APP_ID': JSON.stringify(process.env.CAST_APP_ID),
  },
};

const senderConfig = {
  ...baseConfig,
  entryPoints: ['src/sender/index.tsx'],
  outfile: 'dist/sender/bundle.js',
};

const receiverConfig = {
  ...baseConfig,
  entryPoints: ['src/receiver/index.tsx'],
  outfile: 'dist/receiver/bundle.js',
};

async function formatErrorPage(errors) {
  let html = '<h1>Build failed</h1><pre style="color: red;">';
  for (const message of await esbuild.formatMessages(errors, {
    kind: 'error',
    color: false,
  })) {
    html += message + '\n';
  }
  return html + '</pre>';
}

function getMimeType(filename) {
  const ext = filename.split('.').pop();
  const mimeTypes = {
    html: 'text/html',
    js: 'application/javascript',
    css: 'text/css',
    map: 'application/json',
  };
  return mimeTypes[ext] || 'text/plain';
}

if (watch) {
  const build = { files: {}, error: null, promise: null, timeout: 0 };

  const senderCtx = await esbuild.context(senderConfig);
  const receiverCtx = await esbuild.context(receiverConfig);

  async function doBuild() {
    let resolveFn;
    build.promise = new Promise((resolve) => (resolveFn = resolve));

    try {
      const [senderResult, receiverResult] = await Promise.all([
        senderCtx.rebuild(),
        receiverCtx.rebuild(),
      ]);

      const allResults = [
        ...senderResult.outputFiles,
        ...receiverResult.outputFiles,
      ];
      const allErrors = [...senderResult.errors, ...receiverResult.errors];

      if (allErrors.length === 0) {
        if (build.error) console.log('✅ Build successful again');
        build.error = null;
        build.files = {};
        for (const f of allResults) {
          const name = basename(f.path);
          const dir = f.path.includes('sender') ? 'sender' : 'receiver';
          build.files[`${dir}/${name}`] = {
            hash: f.hash,
            buffer: Buffer.from(f.contents),
          };
        }
      } else {
        build.error = await formatErrorPage(allErrors);
      }
    } catch (err) {
      build.error = err.errors
        ? await formatErrorPage(err.errors)
        : `<pre>${err}</pre>`;
    }

    resolveFn();
    build.promise = null;
  }

  await doBuild();

  chokidar.watch(['./src', './public'], { persistent: true }).on('all', () => {
    clearTimeout(build.timeout);
    build.timeout = setTimeout(() => {
      doBuild();
    }, 50);
  });

  const server = createServer((req, res) => {
    (async () => {
      if (build.promise) await build.promise;

      if (build.error) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        return res.end(build.error);
      }

      let url = req.url === '/' ? '/sender/index.html' : req.url;
      if (url.endsWith('/')) url += 'index.html';

      const pathname = url.substring(1);

      if (
        pathname.startsWith('sender/bundle') ||
        pathname.startsWith('receiver/bundle')
      ) {
        const file = build.files[pathname];
        if (!file) {
          res.writeHead(404);
          return res.end('Not found');
        }

        const headers = {
          ETag: file.hash,
          'Content-Type': getMimeType(pathname),
          'Cache-Control': 'no-cache',
        };

        if (req.headers['if-none-match'] === file.hash) {
          res.writeHead(304, headers);
          return res.end();
        }

        res.writeHead(200, headers);
        return res.end(file.buffer);
      }

      try {
        const filePath = join('public', pathname);
        const content = await readFile(filePath);
        res.writeHead(200, {
          'Content-Type': getMimeType(pathname),
          'Cache-Control': 'no-cache',
        });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    })();
  });

  server.listen(3000, () => {
    console.log('👀 Watching for changes...');
    console.log('🚀 Server running at http://localhost:3000');
    console.log('   Sender: http://localhost:3000/sender/');
    console.log('   Receiver: http://localhost:3000/receiver/');
  });
} else {
  await esbuild.build(senderConfig);
  await esbuild.build(receiverConfig);

  await mkdir('dist/sender', { recursive: true });
  await mkdir('dist/receiver', { recursive: true });

  await copyFile('public/sender/index.html', 'dist/sender/index.html');
  await copyFile('public/receiver/index.html', 'dist/receiver/index.html');

  console.log('✅ Build complete');
  console.log('📦 Deployable files:');
  console.log('   dist/sender/   (index.html + bundle.js)');
  console.log('   dist/receiver/ (index.html + bundle.js)');
}
