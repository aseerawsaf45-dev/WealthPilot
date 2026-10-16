const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'node_modules', '@tailwindcss', 'node', 'dist', 'index.js'),
  path.join(__dirname, '..', 'node_modules', '@tailwindcss', 'node', 'dist', 'index.mjs')
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    if (content.includes('n(o)})))')) {
      content = content.replaceAll('n(o)})))', 'n(typeof o==="string"?o.replaceAll("\\0",""):o)})))');
      modified = true;
    }
    if (content.includes('let i=await fn(e,r,n);if(!i)')) {
      content = content.replaceAll('let i=await fn(e,r,n);if(!i)', 'let i=await fn(e,r,n);if(typeof i==="string")i=i.replaceAll("\\0","");if(!i)');
      modified = true;
    }
    if (content.includes('let s=await Rt(e,r,n);if(!s)')) {
      content = content.replaceAll('let s=await Rt(e,r,n);if(!s)', 'let s=await Rt(e,r,n);if(typeof s==="string")s=s.replaceAll("\\0","");if(!s)');
      modified = true;
    }
    if (content.includes('let i=await Zr(e,r,n);if(!i)')) {
      content = content.replaceAll('let i=await Zr(e,r,n);if(!i)', 'let i=await Zr(e,r,n);if(typeof i==="string")i=i.replaceAll("\\0","");if(!i)');
      modified = true;
    }
    if (content.includes('let s=await xt(e,r,n);if(!s)')) {
      content = content.replaceAll('let s=await xt(e,r,n);if(!s)', 'let s=await xt(e,r,n);if(typeof s==="string")s=s.replaceAll("\\0","");if(!s)');
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`[patch-tailwind] Patched ${path.basename(file)}`);
    }
  }
}
