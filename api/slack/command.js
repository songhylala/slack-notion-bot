const { Client } = require('@notionhq/client');
const Anthropic = require('@anthropic-ai/sdk');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PAGE_MAP = {
  '연차':  '2cd3b344ce7f809f9b8ff6162605f945',
  '복지':  '여기에_노션_페이지ID_입력',
  '경조사': '여기에_노션_페이지ID_입력',
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { text, response_url } = req.body;
  const keyword = text?.trim();

  res.json({ response_type: 'ephemeral', text: `🔍 "${keyword}" 정보를 찾고 있어요...` });

  const pageId = PAGE_MAP[keyword];
  if (!pageId) {
    await fetch(response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `❌ "${keyword}"에 대한 정보가 없어요.\n등록된 명령어를 확인해주세요.` })
    });
    return;
  }

  try {
    const blocks = await notion.blocks.children.list({ block_id: pageId });
    const content = blocks.results
      .map(b => b[b.type]?.rich_text?.map(t => t.plain_text).join('') || '')
      .filter(Boolean)
      .join('\n');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ 
        role: 'user', 
        content: `다음 회사 내규를 핵심만 요약해줘. 불렛포인트로 3~5개 항목으로 간결하게:\n\n${content}` 
      }]
    });

    const summary = message.content[0].text;

    await fetch(response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text: `📋 *${keyword} 관련 안내*\n\n${summary}` 
      })
    });
  } catch (e) {
    await fetch(response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `⚠️ 오류가 발생했어요. 잠시 후 다시 시도해주세요.` })
    });
  }
};
