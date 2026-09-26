const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Load configuration
const ENV_PATH = path.resolve(__dirname, '../.env.local');
let GEMINI_API_KEY = '';
if (fs.existsSync(ENV_PATH)) {
  const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
  const match = envContent.match(/VITE_GEMINI_API_KEY="?([^"\n]+)"?/);
  if (match) GEMINI_API_KEY = match[1];
}

const SUPABASE_URL = 'https://kguupaybvbngyzyofjun.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zKni8xDa4b_N4qPcjlgRAA_leFfwIEm'; // Fallback anon key
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SRC_DIR = path.resolve(__dirname, '../src');

// 2. File scanner
function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(fullPath));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

// 3. Simple chunking
function chunkContent(content, maxLines = 200) {
  const lines = content.split('\n');
  const chunks = [];
  for (let i = 0; i < lines.length; i += maxLines) {
    chunks.push({
      lines: `${i+1}-${Math.min(i + maxLines, lines.length)}`,
      content: lines.slice(i, i + maxLines).join('\n')
    });
  }
  return chunks;
}

// 4. Get Embeddings using Gemini API
async function getGeminiEmbedding(text) {
  if (!GEMINI_API_KEY) {
    throw new Error('No VITE_GEMINI_API_KEY found in frontend/.env.local');
  }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: "models/embedding-001",
      content: { parts: [{ text }] }
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API Error: ${err}`);
  }
  const data = await res.json();
  return data.embedding.values;
}

// 5. Main Indexer
async function runIndexer() {
  console.log('🚀 J.A.R.V.I.S. Global Brain Indexer starting...');
  const files = walkDir(SRC_DIR);
  console.log(`Found ${files.length} .ts/.tsx files.`);
  
  let totalChunksIndexed = 0;

  for (const file of files) {
    const relPath = file.split(path.normalize('frontend/src/'))[1].replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf-8');
    
    // Feature group guess
    const parts = relPath.split('/');
    const featureGroup = parts.length > 1 ? parts[1] : 'core';

    const chunks = chunkContent(content);
    
    for (const chunk of chunks) {
      try {
        console.log(`Embedding ${relPath} [${chunk.lines}]...`);
        const vector = await getGeminiEmbedding(`File: ${relPath}\nLines: ${chunk.lines}\nCode:\n${chunk.content}`);
        
        const { error } = await supabase
          .from('jarvis_code_embeddings')
          .insert({
            file_path: relPath,
            symbol_name: `Chunk ${chunk.lines}`,
            feature_group: featureGroup,
            code_content: chunk.content,
            embedding: vector
          });
          
        if (error) {
          console.error(`❌ Failed to insert ${relPath} [${chunk.lines}]:`, error.message);
        } else {
          totalChunksIndexed++;
        }
        
        // Wait 500ms to avoid rate limits
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error(`⚠️ Error embedding ${relPath}: ${err.message}`);
      }
    }
  }
  
  console.log(`✅ Indexing complete. ${totalChunksIndexed} chunks added to the Global Brain.`);
}

runIndexer();
