/**
 * ============================================
 * ⚠️  NETWORK SCANNER - FOR EDUCATIONAL USE  ⚠️
 * ============================================
 * 
 * WARNING: Only scan networks you own or have
 * explicit written permission to test.
 */

const { exec } = require('child_process');
const os = require('os');

function getLocalNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const results = [];

    for (const [name, addrs] of Object.entries(interfaces)) {
        for (const addr of addrs) {
            if (addr.family === 'IPv4' && !addr.internal) {
                results.push({
                    name: name,
                    ip: addr.address,
                    netmask: addr.netmask,
                    mac: addr.mac
                });
            }
        }
    }
    return results;
}

function pingHost(ip) {
    return new Promise((resolve) => {
        const cmd = `ping -c 1 -W 1 ${ip}`;

        exec(cmd, (error) => {
            resolve({ ip, alive: !error });
        });
    });
}

function arpScan() {
    return new Promise((resolve) => {
        exec('arp -a', (error, stdout) => {
            if (error) {
                resolve({ error: error.message, devices: [] });
                return;
            }

            const devices = [];
            const lines = stdout.split('\n');

            for (const line of lines) {
                const ipMatch = line.match(/\((\d+\.\d+\.\d+\.\d+)\)/);
                const macMatch = line.match(/([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/i);

                if (ipMatch && macMatch) {
                    devices.push({
                        ip: ipMatch[1],
                        mac: macMatch[1]
                    });
                }
            }
            resolve({ devices });
        });
    });
}

function showHelp() {
    console.log(`
🛠️  Network Scanner Usage:

   node network-scan.js [options]
   
Options:
   --scan    Run network scan
   --help    Show this help message

Examples:
   node network-scan.js --scan

⚠️  LEGAL NOTICE:
   This tool is for EDUCATIONAL purposes only.
   Only scan networks you own or have written permission.
`);
}

async function scanNetwork() {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║     NETWORK SCANNER - EDUCATIONAL        ║');
    console.log('╚══════════════════════════════════════════╝\n');

    const localInfo = getLocalNetworkInfo();

    if (localInfo.length === 0) {
        console.log('❌ No network interfaces found');
        return;
    }

    console.log('📡 Local Network Interfaces:\n');
    localInfo.forEach((iface, i) => {
        console.log(`   [${i + 1}] ${iface.name}`);
        console.log(`       IP: ${iface.ip}`);
        console.log(`       MAC: ${iface.mac}\n`);
    });

    const iface = localInfo[0];
    console.log(`🔍 Scanning network: ${iface.ip}/24\n`);

    // ARP Scan
    console.log('─── ARP Table ───');
    const arpResult = await arpScan();
    if (arpResult.devices && arpResult.devices.length > 0) {
        arpResult.devices.forEach(device => {
            console.log(`   📱 ${device.ip.padEnd(15)} MAC: ${device.mac}`);
        });
    } else {
        console.log('   No devices found in ARP table');
    }

    console.log('\n✅ Scan complete!');
}

// Parse arguments
const args = process.argv.slice(2);

if (args.includes('--help')) {
    showHelp();
    process.exit(0);
}

if (args.includes('--scan')) {
    scanNetwork().catch(console.error);
} else {
    showHelp();
}
