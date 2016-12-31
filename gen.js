const generateNewsletter = require('./lib/generateNewsletter');
const fs = require('fs');

const OUTPUT_HTML_FILE = __dirname + '/itri.htm';

generateNewsletter(html => {
  fs.writeFileSync(OUTPUT_HTML_FILE, html);
});
