module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({ 
    status: 'success',
    message: 'API endpoint is working',
    timestamp: new Date().toISOString(),
    path: req.url
  });
};
