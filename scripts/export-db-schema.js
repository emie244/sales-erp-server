const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '5432';
const DB_NAME = process.env.DB_NAME || 'sales_erp';
const DB_USER = process.env.DB_USERNAME || 'postgres';
const DB_PASS = process.env.DB_PASSWORD || 'postgres';

function psql(query) {
  const cmd = `PGPASSWORD=${DB_PASS} psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -tA -c "${query.replace(/"/g, '\\"')}"`;
  return execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
}

function getTables() {
  const sql = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`;
  return psql(sql).trim().split('\n').filter(Boolean);
}

function getColumns(tableName) {
  const sql = `
    SELECT
      c.column_name,
      c.data_type ||
        CASE
          WHEN c.character_maximum_length IS NOT NULL THEN '(' || c.character_maximum_length || ')'
          WHEN c.numeric_precision IS NOT NULL AND c.numeric_scale IS NOT NULL
            THEN '(' || c.numeric_precision || ',' || c.numeric_scale || ')'
          ELSE ''
        END as full_type,
      c.is_nullable,
      c.column_default,
      CASE WHEN pk.column_name IS NOT NULL THEN 'PK' ELSE '' END as pk,
      CASE WHEN uk.column_name IS NOT NULL THEN 'UK' ELSE '' END as uk
    FROM information_schema.columns c
    LEFT JOIN (
      SELECT ku.table_name, ku.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
    ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
    LEFT JOIN (
      SELECT ku.table_name, ku.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
      WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public'
    ) uk ON c.table_name = uk.table_name AND c.column_name = uk.column_name
    WHERE c.table_schema = 'public' AND c.table_name = '${tableName}'
    ORDER BY c.ordinal_position
  `;
  const lines = psql(sql).trim().split('\n').filter(Boolean);
  return lines.map(line => {
    const parts = line.split('|');
    return {
      name: parts[0],
      type: parts[1],
      nullable: parts[2],
      default: parts[3],
      pk: parts[4],
      uk: parts[5],
    };
  });
}

function getForeignKeys() {
  const sql = `
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table,
      ccu.column_name AS foreign_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.ordinal_position
  `;
  const lines = psql(sql).trim().split('\n').filter(Boolean);
  return lines.map(line => {
    const parts = line.split('|');
    return {
      table: parts[0],
      column: parts[1],
      foreignTable: parts[2],
      foreignColumn: parts[3],
    };
  });
}

function getIndexes(tableName) {
  const sql = `
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = '${tableName}'
    ORDER BY indexname
  `;
  const lines = psql(sql).trim().split('\n').filter(Boolean);
  return lines.map(line => {
    const parts = line.split('|');
    return { name: parts[0], def: parts[1] };
  });
}

function generateTableDoc(tableName, columns, fks, indexes) {
  const tableFks = fks.filter(fk => fk.table === tableName);
  const referencedBy = fks.filter(fk => fk.foreignTable === tableName);

  let md = `## ${tableName}\n\n`;

  // 字段表
  md += '| 字段名 | 类型 | 可空 | 默认值 | 键 |\n';
  md += '|--------|------|------|--------|-----|\n';
  for (const col of columns) {
    const keys = [col.pk, col.uk].filter(Boolean).join(', ');
    const def = col.default ? col.default.replace(/'/g, "'") : '';
    md += `| \`${col.name}\` | ${col.type} | ${col.nullable} | ${def} | ${keys} |\n`;
  }
  md += '\n';

  // 外键关系
  if (tableFks.length > 0) {
    md += '**外键关系**\n\n';
    for (const fk of tableFks) {
      md += `- \`${fk.column}\` → [${fk.foreignTable}](${fk.foreignTable}.md).\`${fk.foreignColumn}\`\n`;
    }
    md += '\n';
  }

  // 被引用关系
  if (referencedBy.length > 0) {
    md += '**被引用**\n\n';
    for (const ref of referencedBy) {
      md += `- [${ref.table}](${ref.table}.md).\`${ref.column}\` → \`${tableName}\`\n`;
    }
    md += '\n';
  }

  // 索引
  if (indexes.length > 0) {
    md += '**索引**\n\n';
    for (const idx of indexes) {
      md += `- \`${idx.name}\`: ${idx.def}\n`;
    }
    md += '\n';
  }

  return md;
}

function generateMermaidER(fks) {
  const tables = new Set();
  const relations = [];

  for (const fk of fks) {
    tables.add(fk.table);
    tables.add(fk.foreignTable);
    relations.push(`    ${fk.foreignTable} ||--o{ ${fk.table} : "${fk.column}"`);
  }

  let md = '## 数据库 ER 图\n\n';
  md += '```mermaid\n';
  md += 'erDiagram\n';

  for (const rel of [...new Set(relations)].sort()) {
    md += rel + '\n';
  }

  md += '```\n\n';
  return md;
}

function main() {
  const outputDir = process.argv[2] || './db-docs';
  fs.mkdirSync(outputDir, { recursive: true });

  console.log('Fetching tables...');
  const tables = getTables();
  console.log(`Found ${tables.length} tables`);

  console.log('Fetching foreign keys...');
  const fks = getForeignKeys();

  // 生成总览文档
  let overview = `# Sales ERP 数据库文档\n\n`;
  overview += `> 生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
  overview += `> 数据库: ${DB_NAME}\n`;
  overview += `> 共 ${tables.length} 张表\n\n`;

  overview += '## 表清单\n\n';
  overview += '| 表名 | 说明 |\n';
  overview += '|------|------|\n';
  for (const t of tables) {
    overview += `| [${t}](${t}.md) | |\n`;
  }
  overview += '\n';

  overview += generateMermaidER(fks);

  fs.writeFileSync(path.join(outputDir, 'README.md'), overview);
  console.log('Generated README.md');

  // 为每张表生成文档
  for (const table of tables) {
    console.log(`Generating ${table}.md...`);
    const columns = getColumns(table);
    const indexes = getIndexes(table);
    const doc = generateTableDoc(table, columns, fks, indexes);
    fs.writeFileSync(path.join(outputDir, `${table}.md`), doc);
  }

  console.log(`Done! Output: ${outputDir}`);
}

main();
