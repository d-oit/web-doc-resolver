import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';

const MAX_LINES = 200;
const COMPONENTS_DIR = new URL('../components', import.meta.url).pathname;
let failures = 0;

async function validateCss() {
  const files = await readdir(COMPONENTS_DIR);
  const cssFiles = files.filter(f => extname(f) === '.css');

  for (const file of cssFiles) {
    const path = join(COMPONENTS_DIR, file);
    const content = await readFile(path, 'utf-8');
    const lines = content.trimEnd().split('\n');

    if (lines.length > MAX_LINES) {
      console.error(`FAIL: ${file} has ${lines.length} lines (max ${MAX_LINES})`);
      failures++;
    }

    const commentLines = lines.filter(l => /^\s*\/\*/.test(l) || /^\s*\*/.test(l));
    if (commentLines.length > 0) {
      console.error(`FAIL: ${file} has ${commentLines.length} comment lines`);
      failures++;
    }

    if (!content.includes('.do-wdr-')) {
      console.error(`FAIL: ${file} missing do-wdr- prefixed classes`);
      failures++;
    }
  }

  console.log(`Validated ${cssFiles.length} CSS files`);
  if (failures > 0) {
    console.error(`${failures} validation(s) failed`);
    process.exit(1);
  }
  console.log('All CSS validations passed');
}

validateCss();
