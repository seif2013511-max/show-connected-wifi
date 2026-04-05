// Vercel API handler for Network Scanner
// Note: Network scanning requires local access

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const path = req.url.slice(1); // remove leading slash
  
  if (path === 'network-info') {
    res.json([
      {
        name: 'cloud-deployment',
        ip: 'N/A',
        mac: 'N/A',
        netmask: 'N/A',
        message: 'فحص الشبكة المحلية غير متاح في السحابة. شغّل npm run server محلياً'
      }
    ]);
    return;
  }

  if (path === 'scan') {
    res.json({
      devices: [],
      interface: { ip: 'N/A' },
      message: 'للفحص الكامل، شغّل npm run server وزر localhost:8080',
      status: 'demo-mode'
    });
    return;
  }

  res.status(404).json({ error: 'API endpoint not found' });
};
