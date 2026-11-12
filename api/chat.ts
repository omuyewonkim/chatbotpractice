import OpenAI from 'openai'

/**
 * 챗봇 동작 규칙. 수정하고 싶으면 이 상수만 바꾸면 됩니다.
 */
export const SYSTEM_PROMPT = `너는 '영어 단어 퀴즈 챗봇'이야. 한국어 사용자의 영어 어휘 학습을 돕는다.

규칙:
1. 답변은 항상 한국어로, 간결하게 작성한다.
2. 사용자가 주제(예: 여행, 비즈니스, 음식)나 난이도(초급/중급/고급)를 말하지 않았다면, 단어를 알려주기 전에 빠진 정보를 짧게 먼저 물어본다.
3. 영어 단어는 한 번에 최대 3개까지만 알려준다.
4. 각 단어마다 다음 형식으로 보여준다:
   **단어** (품사) - 뜻
   예문: 짧은 영어 예문 (한국어 해석)
5. 답변 마지막에는 방금 알려준 단어로 복습 퀴즈를 정확히 1개만 낸다. 정답은 바로 알려주지 않는다.
6. 사용자가 퀴즈에 답하면 정답 여부와 짧은 해설을 알려주고, 다음 단어를 원하는지 물어본다.
7. 영어 학습과 무관한 요청에는 정중하게 영어 단어 학습으로 대화를 돌린다.`

export const MODEL = 'gpt-6-luna'

const MAX_MESSAGES = 20
const MAX_CONTENT_LENGTH = 2000

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  role: ChatRole
  content: string
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    (v.role === 'user' || v.role === 'assistant') &&
    typeof v.content === 'string' &&
    v.content.trim().length > 0 &&
    v.content.length <= MAX_CONTENT_LENGTH
  )
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return json(
      { error: '서버에 OPENAI_API_KEY가 설정되지 않았습니다.' },
      500,
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: '잘못된 요청 형식입니다.' }, 400)
  }

  const messages = (body as { messages?: unknown } | null)?.messages
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    !messages.every(isChatMessage)
  ) {
    return json({ error: 'messages 배열이 올바르지 않습니다.' }, 400)
  }

  const recent = messages.slice(-MAX_MESSAGES)

  try {
    const client = new OpenAI({ apiKey })
    const response = await client.responses.create({
      model: MODEL,
      instructions: SYSTEM_PROMPT,
      input: recent.map((m) => ({ role: m.role, content: m.content })),
      reasoning: { effort: 'none' },
    })

    return json({ reply: response.output_text })
  } catch (error) {
    console.error('[api/chat] OpenAI error:', error)
    const status =
      error instanceof OpenAI.APIError && typeof error.status === 'number'
        ? error.status
        : 500
    return json(
      { error: 'AI 응답을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.' },
      status >= 400 && status < 600 ? status : 500,
    )
  }
}
