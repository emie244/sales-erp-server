const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DOCUMENT_ID = process.env.FEISHU_DOC_ID;

if (!DOCUMENT_ID) {
  console.error('请设置 FEISHU_DOC_ID 环境变量');
  process.exit(1);
}

const mdPath = path.join(__dirname, '../docs/核心需求与规划文档.md');
const md = fs.readFileSync(mdPath, 'utf-8');

const BLOCK_TYPES = {
  page: 1,
  text: 2,
  heading1: 3,
  heading2: 4,
  heading3: 5,
  heading4: 6,
  heading5: 7,
  heading6: 8,
  heading7: 9,
  heading8: 10,
  heading9: 11,
  bullet: 12,
  ordered: 13,
  code: 14,
  divider: 22,
  table: 15,
};

function createTextElements(text) {
  const elements = [];
  const regex = /\*\*(.+?)\*\*|__(.+?)__/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push({
        text_run: {
          content: text.slice(lastIndex, match.index),
          text_element_style: {},
        },
      });
    }
    elements.push({
      text_run: {
        content: match[1] || match[2],
        text_element_style: { bold: true },
      },
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push({
      text_run: {
        content: text.slice(lastIndex),
        text_element_style: {},
      },
    });
  }

  if (elements.length === 0 && text) {
    elements.push({
      text_run: {
        content: text,
        text_element_style: {},
      },
    });
  }

  return elements;
}

function parseMarkdown(mdText) {
  const lines = mdText.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('---') && i === 0) {
      i++;
      while (i < lines.length && !lines[i].startsWith('---')) i++;
      i++;
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    if (line.trim() === '---') {
      blocks.push({ block_type: BLOCK_TYPES.divider, divider: {} });
      i++;
      continue;
    }

    if (line.startsWith('# ')) {
      blocks.push({
        block_type: BLOCK_TYPES.heading1,
        heading1: {
          elements: createTextElements(line.slice(2).trim()),
        },
      });
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push({
        block_type: BLOCK_TYPES.heading2,
        heading2: {
          elements: createTextElements(line.slice(3).trim()),
        },
      });
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push({
        block_type: BLOCK_TYPES.heading3,
        heading3: {
          elements: createTextElements(line.slice(4).trim()),
        },
      });
      i++;
      continue;
    }

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      i++;
      const codeLines = [];
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      const content = codeLines.join('\n');
      blocks.push({
        block_type: BLOCK_TYPES.code,
        code: {
          elements: content
            ? [{ text_run: { content, text_element_style: {} } }]
            : [],
          style: { language: 1 },
        },
      });
      i++;
      continue;
    }

    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const text = line.trim().slice(2);
      blocks.push({
        block_type: BLOCK_TYPES.bullet,
        bullet: {
          elements: createTextElements(text),
        },
      });
      i++;
      continue;
    }

    if (/^\s*\d+\.\s/.test(line)) {
      const text = line.replace(/^\s*\d+\.\s/, '');
      blocks.push({
        block_type: BLOCK_TYPES.ordered,
        ordered: {
          elements: createTextElements(text),
        },
      });
      i++;
      continue;
    }

    if (line.includes('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      // Render table as code block for simplicity
      const tableText = tableLines.join('\n');
      if (tableText.trim()) {
        blocks.push({
          block_type: BLOCK_TYPES.code,
          code: {
            elements: [{ text_run: { content: tableText, text_element_style: {} } }],
            style: { language: 1 },
          },
        });
      }
      continue;
    }

    if (line.trim().startsWith('> ')) {
      blocks.push({
        block_type: BLOCK_TYPES.text,
        text: {
          elements: createTextElements('💡 ' + line.trim().slice(2)),
        },
      });
      i++;
      continue;
    }

    if (line.trim().startsWith('- [x]') || line.trim().startsWith('- [ ]')) {
      const checked = line.trim().startsWith('- [x]');
      const text = line.trim().slice(5).trim();
      blocks.push({
        block_type: BLOCK_TYPES.bullet,
        bullet: {
          elements: createTextElements((checked ? '☑ ' : '☐ ') + text),
        },
      });
      i++;
      continue;
    }

    blocks.push({
      block_type: BLOCK_TYPES.text,
      text: {
        elements: createTextElements(line.trim()),
      },
    });
    i++;
  }

  return blocks;
}

function insertBlocks(parentId, children) {
  const data = JSON.stringify({ children, index: -1 });
  const cmd = `lark-cli api POST /open-apis/docx/v1/documents/${DOCUMENT_ID}/blocks/${parentId}/children --data '${data.replace(/'/g, "'\\''")}' --as bot`;
  const result = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  const parsed = JSON.parse(result);
  if (parsed.code !== 0) {
    console.error('Insert failed:', parsed.msg);
    throw new Error(parsed.msg);
  }
  return parsed.data;
}

async function main() {
  const blocks = parseMarkdown(md);
  console.log(`Parsed ${blocks.length} blocks`);

  const BATCH_SIZE = 40;
  for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
    const batch = blocks.slice(i, i + BATCH_SIZE);
    console.log(
      `Inserting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(blocks.length / BATCH_SIZE)} (${batch.length} blocks)`,
    );
    insertBlocks(DOCUMENT_ID, batch);
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log('Done! Document URL: https://feishu.cn/docx/' + DOCUMENT_ID);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
