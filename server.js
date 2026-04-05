const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const url = require('url');

const PORT = 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');

const isLinux = os.platform() !== 'win32';

function getNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const results = [];
    for (const [name, addrs] of Object.entries(interfaces)) {
        if (!addrs) continue;
        for (const addr of addrs) {
            if (addr.family === 'IPv4' && !addr.internal) {
                results.push({ name, ip: addr.address, mac: addr.mac || 'N/A', netmask: addr.netmask || 'N/A' });
            }
        }
    }
    return results;
}

function pingHost(ip) {
    return new Promise((resolve) => {
        const cmd = isLinux ? `ping -c 1 -W 1 ${ip}` : `ping -n 1 -w 500 ${ip}`;
        exec(cmd, { timeout: 2000 }, (error) => resolve({ ip, alive: !error }));
    });
}

function arpScan() {
    return new Promise((resolve) => {
        exec('arp -a', { timeout: 5000 }, (error, stdout) => {
            if (error) return resolve([]);
            const devices = [];
            for (const line of stdout.split('\n')) {
                let ip, mac;
                if (isLinux) {
                    const ipM = line.match(/\((\d+\.\d+\.\d+\.\d+)\)/);
                    const macM = line.match(/([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/i);
                    if (ipM && macM) { ip = ipM[1]; mac = macM[1].toUpperCase(); }
                } else {
                    const m = line.match(/(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F-]{17})/);
                    if (m) { ip = m[1]; mac = m[2].replace(/-/g, ':').toUpperCase(); }
                }
                if (ip && mac && !mac.includes('INCOMPLETE')) devices.push({ ip, mac });
            }
            resolve(devices);
        });
    });
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // API endpoints
    if (pathname === '/api/network-info') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(getNetworkInfo()));
        return;
    }

    if (pathname === '/api/scan') {
        const info = getNetworkInfo();
        if (info.length === 0) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'No network interface found', devices: [] }));
            return;
        }
        const iface = info[0];
        const baseIp = iface.ip.split('.').slice(0, 3).join('.');
        Promise.all([
            arpScan(),
            Promise.all(Array.from({length: 50}, (_, i) => pingHost(baseIp + '.' + (i+1))))
        ]).then(([arpDevices, pingResults]) => {
            const alive = pingResults.filter(r => r.alive).map(r => r.ip);
            const allIps = [...new Set([...arpDevices.map(d => d.ip), ...alive])].filter(ip => ip !== iface.ip);
            const devices = allIps.map(ip => ({ ip, hostname: ip, mac: null }));
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ interface: iface, devices }));
        }).catch(err => {
            console.error('Scan error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Scan failed', devices: [] }));
        });
        return;
    }

    // Static files from public directory
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(PUBLIC_DIR, filePath);

    fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('File not found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.ico': 'image/x-icon'
        }[ext] || 'application/octet-stream';

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Server error');
                return;
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
    });
});

server.listen(PORT, '0.0.0.0', () => {
    const localIP = Object.values(os.networkInterfaces()).flat().find(intf => intf.family === 'IPv4' && !intf.internal)?.address || 'localhost';
    console.log('');
    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║            🔍 Network Scanner Web            ║');
    console.log('╠═══════════════════════════════════════════════╣');
    console.log('║                                              ║');
    console.log('║  🌐 http://localhost:' + PORT + '                 ║');
    console.log('║  📱 http://127.0.0.1:' + PORT + '                 ║');
    console.log('║  💻 http://' + localIP + ':' + PORT + '              ║');
    console.log('║                                              ║');
    console.log('║  💡 npm run server لتشغيل                     ║');
    console.log('║  npm run scan للـ CLI                        ║');
    console.log('╚═══════════════════════════════════════════════╝');
    console.log('');
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log('❌ Port ' + PORT + ' مشغول. جرب قتل العملية أو استخدم port تاني.');
    } else {
        console.error('خطأ في السيرفر:', err);
    }
});
