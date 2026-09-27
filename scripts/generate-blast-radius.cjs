const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../frontend/src');
const outputFile = path.join(__dirname, '../BLAST_RADIUS.md');

// Store mappings: File -> Array of Files that import it
const reverseMap = {};

function crawlDirectory(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      crawlDirectory(filePath, fileList);
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function normalizePath(basePath, importPath) {
  if (!importPath.startsWith('.')) return null; // Ignore node_modules
  
  let resolvedPath = path.resolve(path.dirname(basePath), importPath);
  
  // Strip extension if user included it
  resolvedPath = resolvedPath.replace(/\.(ts|tsx|js|jsx)$/, '');
  
  // In our simplified mapper, we'll just track the relative path from srcDir
  return path.relative(srcDir, resolvedPath).replace(/\\/g, '/');
}

try {
  console.log('🚀 J.A.R.V.I.S. Blast-Radius Engine Starting...');
  const allFiles = crawlDirectory(srcDir);
  
  for (const filePath of allFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativeCurrentFile = path.relative(srcDir, filePath).replace(/\\/g, '/');
    
    // Regex to find import statements
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      const targetModule = normalizePath(filePath, importPath);
      
      if (targetModule) {
        if (!reverseMap[targetModule]) {
          reverseMap[targetModule] = new Set();
        }
        reverseMap[targetModule].add(relativeCurrentFile);
      }
    }
  }

  // Generate Markdown
  let markdown = `# 🕸️ J.A.R.V.I.S. Blast-Radius Dependency Map\n\n`;
  markdown += `> **WARNING to AI Agents:** Before modifying any file below, you MUST check all files listed under it. If you change a core service, you risk breaking all the consuming UI consoles.\n\n`;
  
  // Sort by files that have the biggest blast radius
  const sortedModules = Object.keys(reverseMap).sort((a, b) => reverseMap[b].size - reverseMap[a].size);
  
  for (const mod of sortedModules) {
    const consumers = Array.from(reverseMap[mod]);
    // Only show files that are used by 2 or more files to keep it clean, or show all. Let's show core ones.
    if (consumers.length > 0) {
      markdown += `### 💥 \`${mod}\`\n`;
      markdown += `*If you modify this, you risk breaking these **${consumers.length}** files:*\n`;
      consumers.sort().forEach(consumer => {
        markdown += `- \`${consumer}\`\n`;
      });
      markdown += `\n`;
    }
  }

  fs.writeFileSync(outputFile, markdown);
  console.log(`✅ BLAST_RADIUS.md generated successfully. Evaluated ${allFiles.length} files.`);
} catch (error) {
  console.error('❌ Failed to generate blast radius map:', error);
}
