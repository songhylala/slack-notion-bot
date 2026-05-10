const { Client } = require('@notionhq/client');
const Anthropic = require('@anthropic-ai/sdk');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PAGE_MAP = {
  '연차': '2cd3b344ce7f809f9b8ff6162605f945',
  '복지': '여기에_노션_페이지ID_입력',
  '경조사': '여기에_노션_페이지ID_입력',
};

async function extractText(blockId, depth = 0) {
  if (depth > 2) return '';
  const blocks = await notion.blocks.children.list({ block_id: blockId });
  let text = '';
  for (const block of blocks.results) {
    const type = block.type;
    const richText = block[type]?.rich_text || [];
    const line = richText.map(t => t.plain_text).join('');
    if (line) text += line + '\n';
    if (block.has_children) {
      const child = await extractText(block.id, depth + 1);
      text += child;
    }
  }
  return text;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body = req.body;
  const command = (body.command || '').replace('/', '').trim();
  const response_url = body.response_url;

  const pageId = PAGE_MAP[command];

  if (!pageId) {
    return res.json({ 
      response_type: 'ephemeral', 
      text: `❌ 등록되지 않은 명령어예요.\n사용 가능한 명령어: ${Object.keys(PAGE_MAP).map(k => '/' + k).join(', ')}` 
    });
  }

  try {
    const content = await extractText(pageId);
