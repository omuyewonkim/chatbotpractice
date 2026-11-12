import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { sendChat, type ChatMessage } from '../api/chat'
import './Chatbot.css'

const GREETING: ChatMessage = {
  role: 'assistant',
  content:
    '안녕하세요! 영어 단어 퀴즈 챗봇이에요. 📚\n배우고 싶은 **주제**(예: 여행, 음식, 비즈니스)와 **난이도**(초급/중급/고급)를 알려주세요.',
}

const EXAMPLES = ['여행 주제, 초급', '비즈니스 영어 중급', '감정 표현 고급 단어']

/** **굵게** 표시만 간단히 렌더링 */
function renderText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

export default function Chatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  async function submit(text: string) {
    const content = text.trim()
    if (!content || loading) return

    const next: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setError(null)
    setLoading(true)

    try {
      // 첫 인사말은 UI용이므로 서버에는 보내지 않음
      const reply = await sendChat(next.slice(1))
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    void submit(input)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit(input)
    }
  }

  function reset() {
    setMessages([GREETING])
    setError(null)
    setInput('')
  }

  return (
    <div className="chatbot">
      <header className="chatbot-header">
        <h1>영어 단어 퀴즈 챗봇</h1>
        <button type="button" className="chatbot-reset" onClick={reset} disabled={loading}>
          새 대화
        </button>
      </header>

      <div className="chatbot-messages" ref={listRef}>
        {messages.map((m, i) => (
          <div key={i} className={`bubble bubble-${m.role}`}>
            {renderText(m.content)}
          </div>
        ))}
        {loading && <div className="bubble bubble-assistant bubble-loading">답변을 작성하는 중…</div>}
        {error && <div className="chatbot-error">⚠️ {error}</div>}
      </div>

      {messages.length === 1 && (
        <div className="chatbot-examples">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => void submit(ex)} disabled={loading}>
              {ex}
            </button>
          ))}
        </div>
      )}

      <form className="chatbot-form" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="주제와 난이도를 입력하거나 퀴즈 정답을 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"
          rows={2}
          maxLength={2000}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          전송
        </button>
      </form>
    </div>
  )
}
