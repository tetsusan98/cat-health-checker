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

    // Google Gemini APIを呼び出し
    const apiKey = process.env.GEMINI_API_KEY;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
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
              inline_data: {
                mime_type: "image/jpeg",
                data: image
              }
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Gemini APIエラー');
    }

    const data = await response.json();
    
    // Geminiのレスポンス形式からテキストを抽出
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
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
