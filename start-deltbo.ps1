$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 4173
$bindHost = "0.0.0.0"
$url = "http://127.0.0.1:$port/index.html"

function Test-DeltboServer {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-DeltboServer)) {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($node) {
    $serverScript = @"
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp'
};
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:$port');
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const file = path.resolve(root, rel);
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'text/plain' });
    res.end(data);
  });
}).listen($port, '$bindHost');
"@
    Start-Process -FilePath $node.Source -ArgumentList @("-e", $serverScript) -WorkingDirectory $root -WindowStyle Hidden
    Start-Sleep -Seconds 1
  }
}

if (Test-DeltboServer) {
  Start-Process $url
} else {
  Start-Process (Join-Path $root "index.html")
}

