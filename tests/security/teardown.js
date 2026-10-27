const fs = require('node:fs');
module.exports = async () => {
  if (fs.existsSync('.tmp/security-auth.json')) fs.unlinkSync('.tmp/security-auth.json');
};
