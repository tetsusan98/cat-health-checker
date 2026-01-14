export default async function handler(req, res) {
  // CORSヘッダー設定
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONSリクエスト（プリフライト）への対応
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POSTメソッドのみ許可
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: '画像データが必要です' });
    }

    // Claude APIを呼び出し
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: image
              }
            },
            {
              type: 'text',
              text: `この猫の画像から、以下の観点で健康状態を分析してください。必ず以下のJSON形式のみで回答してください。マークダウンのコードブロックは使わず、JSONオブジェクトだけを返してください:

{
  "coat": {
    "status": "良好/普通/要注意",
    "description": "毛並みの状態の詳細"
  },
  "body": {
    "status": "良好/普通/要注意",
    "description": "体型や体格の詳細"
  },
  "overall": {
    "status": "良好/普通/要注意",
    "description": "全体的な健康状態の総評"
  },
  "recommendations": "飼い主へのアドバイス"
}`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Claude APIエラー');
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}