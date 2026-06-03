import type { Provider, ChatMessage } from './types';
import { SYSTEM_PROMPT } from './constants';

export async function callLLM(
  provider: Provider,
  apiKey: string,
  model: string,
  messages: ChatMessage[]
): Promise<string> {
  if (!apiKey) {
    throw new Error(`API Key for ${provider.toUpperCase()} is not set. Please set it in the Settings tab.`);
  }

  // Format messages list for LLM context
  const formattedMessages = messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  switch (provider) {
    case 'gemini':
      return callGemini(apiKey, model, formattedMessages);
    case 'openai':
      return callOpenAI(apiKey, model, formattedMessages);
    case 'anthropic':
      return callAnthropic(apiKey, model, formattedMessages);
    case 'deepseek':
      return callDeepSeek(apiKey, model, formattedMessages);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

async function callGemini(apiKey: string, model: string, messages: { role: string; content: string }[]): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  // Gemini expects:
  // - "user" role to map to "user"
  // - "assistant" role to map to "model"
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const payload = {
    contents,
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API returned an empty or invalid response.');
  }

  return text;
}

async function callOpenAI(apiKey: string, model: string, messages: { role: string; content: string }[]): Promise<string> {
  const url = 'https://api.openai.com/v1/chat/completions';
  
  const payload = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages
    ],
    temperature: 0.3
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('OpenAI API returned an empty or invalid response.');
  }

  return text;
}

async function callAnthropic(apiKey: string, model: string, messages: { role: string; content: string }[]): Promise<string> {
  const url = 'https://api.anthropic.com/v1/messages';
  
  // Anthropic doesn't allow 'system' in the messages list. It should be a top-level parameter.
  const payload = {
    model,
    system: SYSTEM_PROMPT,
    messages: messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    })),
    max_tokens: 4096
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true' // Required when calling directly from extension
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  if (!text) {
    throw new Error('Anthropic API returned an empty or invalid response.');
  }

  return text;
}

async function callDeepSeek(apiKey: string, model: string, messages: { role: string; content: string }[]): Promise<string> {
  const url = 'https://api.deepseek.com/chat/completions';
  
  const payload = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages
    ],
    temperature: 0.3
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('DeepSeek API returned an empty or invalid response.');
  }

  return text;
}
