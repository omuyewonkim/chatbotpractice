export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

interface ChatResponse {
  reply?: string
  error?: string
}

/**
 * 서버 함수(/api/chat)에 대화 내역을 보내고 챗봇 답변을 받아온다.
 * API Key는 서버에서만 사용되며 프런트엔드에는 포함되지 않는다.
 */
export async function sendChat(messages: ChatMessage[]): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })

  let data: ChatResponse = {}
  try {
    data = (await res.json()) as ChatResponse
  } catch {
    // JSON이 아닌 응답은 아래에서 처리
  }

  if (!res.ok || typeof data.reply !== 'string') {
    throw new Error(data.error ?? `요청 실패 (HTTP ${res.status})`)
  }
  return data.reply
}
