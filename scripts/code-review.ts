import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../frontend/src');

interface AuditResult {
  file: string;
  violations: string[];
}

/**
 * Scans a file to verify compliance with developer instructions:
 * 1. No relative imports (must use @/ path alias).
 * 2. No traditional loops (must use map/filter/reduce, except inside comments).
 * 3. JSDoc documentation present for exports.
 * 
 * @param filePath The absolute path to the file.
 * @returns The list of found violations.
 */
function auditFile(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: string[] = [];

  // Remove multi-line comments to avoid false positives in loops/imports checking
  const cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
  const cleanLines = cleanContent.split('\n');

  // Rule 1: No relative imports (only alias `@/` or third-party packages allowed)
  cleanLines.forEach((line, idx) => {
    const importMatch = line.match(/from\s+['"](\.\.?\/.*)['"]/);
    const dynamicImportMatch = line.match(/import\(['"](\.\.?\/.*)['"]\)/);
    if (importMatch || dynamicImportMatch) {
      const match = importMatch ? importMatch[1] : (dynamicImportMatch ? dynamicImportMatch[1] : '');
      violations.push(`Line ${idx + 1}: Relative import found "${match}". Use "@/" path alias instead.`);
    }
  });

  // Rule 2: No traditional loops (must use map, filter, reduce, forEach)
  cleanLines.forEach((line, idx) => {
    if (/\b(for|while|do)\s*\(/.test(line)) {
      violations.push(`Line ${idx + 1}: Traditional loop statement "${line.trim()}" found. Use declarative methods (map/filter/reduce) instead.`);
    }
  });

  // Rule 3: JSDoc check for all exported elements (classes, interfaces, functions, variables)
  // We search for lines starting with 'export class', 'export interface', 'export function', 'export const'
  lines.forEach((line, idx) => {
    if (/\bexport\s+(class|interface|function|const|let)\s+(\w+)/.test(line)) {
      // Look back for JSDoc comment close '*/'
      let foundJSDoc = false;
      for (let i = idx - 1; i >= Math.max(0, idx - 4); i--) {
        if (lines[i].trim().endsWith('*/')) {
          foundJSDoc = true;
          break;
        }
      }
      if (!foundJSDoc) {
        const match = line.match(/\bexport\s+(class|interface|function|const|let)\s+(\w+)/);
        const name = match ? match[2] : 'unknown';
        violations.push(`Line ${idx + 1}: Exported item "${name}" is missing a JSDoc comment.`);
      }
    }
  });

  return violations;
}

/**
 * Recursively retrieves all files in a directory matching a filter.
 * 
 * @param dir Absolute directory path.
 * @returns Array of nested file paths.
 */
function getFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.reduce<string[]>((acc, entry) => {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      return [...acc, ...getFiles(res)];
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      return [...acc, res];
    }
    return acc;
  }, []);
}

/**
 * Executes the main code review audit pipeline.
 */
function runReview(): void {
  console.log('----------------------------------------------------');
  console.log('🤖 Operio Frontend Code Review Audit Tool');
  console.log(`Scanning: ${SRC_DIR}`);
  console.log('----------------------------------------------------');

  if (!fs.existsSync(SRC_DIR)) {
    console.error(`Error: Source directory ${SRC_DIR} does not exist.`);
    process.exit(1);
  }

  const files = getFiles(SRC_DIR);
  const results: AuditResult[] = [];

  files.forEach(file => {
    const relativePath = path.relative(SRC_DIR, file);
    const violations = auditFile(file);
    if (violations.length > 0) {
      results.push({ file: relativePath, violations });
    }
  });

  if (results.length === 0) {
    console.log('✅ PASS: All files are 100% compliant with TS, JSDoc, and Functional Programming guidelines!');
    console.log('----------------------------------------------------');
    process.exit(0);
  } else {
    console.error(`❌ FAIL: Found violations in ${results.length} files:`);
    console.log('----------------------------------------------------');
    results.forEach(res => {
      console.error(`\n📄 File: src/${res.file}`);
      res.violations.forEach(v => {
        console.error(`   ⚠️  ${v}`);
      });
    });
    console.log('\n----------------------------------------------------');
    process.exit(1);
  }
}

runReview();
