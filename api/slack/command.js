const { Client } = require('@notionhq/client');
const Anthropic = require('@anthropic-ai/sdk');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PAGE_MAP = {
  '연차': '2cd3b344ce7f809f9b8ff6162605f945',
  '복지': '여기에_노션_페이지ID_입력',
  '경조사': '여기에_노션_페이지ID_입력',
};

async function extractText(blockId, depth) {
  depth = depth || 0;
  if (depth > 1) return '';
  var blocks = await notion.blocks.children.list({ block_id: blockId });
  var text = '';
  for (var i = 0; i < blocks.results.length; i++) {
    var block = blocks.results[i];
    var type = block.type;
    var richText = (block[type] && block[type].rich_text) ? block[type].rich_text : [];
    var line = richText.map(function(t) { return t.plain_text; }).join('');
    if (line) text += line + '\n';
    if (block.has_children) {
      text += await extractText(block.id, depth + 1);
    }
  }
  return text;
}

module.exports = async function(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  var body = req.body;
  var command = (body.command || '').replace('/', '').trim();
  var response_url = body.response_url;
  var pageId = PAGE_MAP[command];

  if (!pageId) {
    res.json({
      response_type: 'ephemeral',
      text: '❌ 등록되지 않은 명령어예요.'
    });
    return;
  }

  try {
    var content = await extractText(pageId);

    var message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: '다음 회사 내규를 핵심만 3개 항목으로 요약해줘:\n\n' + content
      }]
    });

    var summary = message.content[0].text;

    res.json({
      response_type: 'ephemeral',
      text: '📋 *' + command + ' 관련 안내*\n\n' + summary
    });

  } catch (e) {
    console.error(e);
    res.json({
      response_type: 'ephemeral',
      text: '⚠️ 오류가 발생했어요. 잠시 후 다시 시도해주세요.'
    });
  }
};
