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

    const apiKey = process.env.OPENROUTER_API_KEY;

    // OpenRouter APIを呼び出し（無料のVisionモデル使用）
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://cat-health-checker.vercel.app',
        'X-Title': 'Cat Health Checker'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.2-11b-vision-instruct:free',
        messages: [{
          role: 'user',
          content: [
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
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${image}`
              }
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenRouter API Error:', errorData);
      throw new Error(errorData.error?.message || 'OpenRouter APIエラー');
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content;
    
    if (!textContent) {
      console.error('No text content in response:', JSON.stringify(data));
      throw new Error('応答が取得できませんでした');
    }

    // マークダウンのコードブロック記法を除去
    let jsonText = textContent.trim();
    jsonText = jsonText.replace(/^```json\s*/i, '');
    jsonText = jsonText.replace(/^```\s*/i, '');
    jsonText = jsonText.replace(/\s*```$/i, '');
    jsonText = jsonText.trim();

    // JSONをパースして検証
    const parsedData = JSON.parse(jsonText);

    // Claude API形式に変換（フロントエンドのコードを変更しないため）
    const claudeFormat = {
      content: [{
        type: 'text',
        text: JSON.stringify(parsedData)
      }]
    };

    res.status(200).json(claudeFormat);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}
