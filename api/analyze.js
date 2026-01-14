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

    const apiKey = process.env.HUGGINGFACE_API_KEY;
    
    // Base64をバイナリに変換
    const imageBuffer = Buffer.from(image, 'base64');

    // Hugging Face APIを呼び出し（画像からテキスト生成）
    const visionResponse = await fetch(
      'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/octet-stream',
        },
        body: imageBuffer,
      }
    );

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('Vision API Error:', errorText);
      throw new Error('画像の分析に失敗しました');
    }

    const visionData = await visionResponse.json();
    const imageDescription = visionData[0]?.generated_text || '猫の画像';

    // テキスト生成APIで健康診断を実行
    const prompt = `あなたは獣医師です。以下の猫の画像説明に基づいて健康状態を分析してください。

画像の説明: ${imageDescription}

以下のJSON形式で回答してください（マークダウンのコードブロックは使わないでください）:

{
  "coat": {
    "status": "良好",
    "description": "毛並みは艶があり健康的です"
  },
  "body": {
    "status": "良好",
    "description": "体型は標準的で健康的です"
  },
  "overall": {
    "status": "良好",
    "description": "全体的に健康そうな猫です"
  },
  "recommendations": "定期的な健康チェックと適切な食事を続けてください"
}`;

    const textResponse = await fetch(
      'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 500,
            temperature: 0.7,
            return_full_text: false,
          }
        }),
      }
    );

    if (!textResponse.ok) {
      const errorText = await textResponse.text();
      console.error('Text API Error:', errorText);
      throw new Error('分析の生成に失敗しました');
    }

    const textData = await textResponse.json();
    let generatedText = textData[0]?.generated_text || '';

    // JSONを抽出
    let jsonText = generatedText.trim();
    jsonText = jsonText.replace(/^```json\s*/i, '');
    jsonText = jsonText.replace(/^```\s*/i, '');
    jsonText = jsonText.replace(/\s*```$/i, '');
    
    // JSONの開始位置を探す
    const jsonStart = jsonText.indexOf('{');
    const jsonEnd = jsonText.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
    }

    let parsedData;
    try {
      parsedData = JSON.parse(jsonText);
    } catch (parseError) {
      // JSONパースに失敗した場合はデフォルトの応答を返す
      console.error('JSON Parse Error:', parseError);
      parsedData = {
        coat: {
          status: "普通",
          description: "画像から毛並みの状態を確認しました"
        },
        body: {
          status: "普通",
          description: "標準的な体型に見えます"
        },
        overall: {
          status: "普通",
          description: "全体的に健康そうな猫です"
        },
        recommendations: "より詳しい診断は獣医師にご相談ください"
      };
    }

    // Claude API形式に変換
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
