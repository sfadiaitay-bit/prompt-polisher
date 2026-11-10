import type { Register } from 'claude-code'

const TRIGGER = '++'

const SYSTEM = `You are an expert prompt engineer. The user gives you a messy, unstructured draft of what they want an AI assistant to do. Rewrite it as a clean, well-structured prompt following Anthropic's recommended prompting practices.

Rules:
- Write the prompt in the SAME LANGUAGE as the draft (e.g. Hebrew stays Hebrew).
- Preserve every fact, requirement and preference from the draft. Never invent details; where something essential is missing, add a short line under "Open questions" instead of guessing.
- Be clear and direct. Explain the purpose behind constraints.
- Use XML-style tags to separate sections, only the ones that apply, in this order:
  <role> who the assistant should act as
  <context> background, audience, why this matters
  <task> the main request, step by step if there are several steps
  <constraints> rules, limits, things to avoid, tone
  <examples> only if the draft contains or clearly implies examples
  <output_format> exact shape, length and language of the answer
- End with one line asking the assistant to think through the task before answering, if the task is complex.
- Output ONLY the finished prompt. No preface, no explanation, no code fences.`

let isBusy = false

async function polish($: any, text?: string) {
  if (isBusy) return
  const draft = (text ?? (await $.prompt.read()).text).trim()
  if (!draft) {
    $.ui.toast('כתוב משהו בתיבה קודם')
    return
  }
  isBusy = true
  $.ui.status('✨ מסדר פרומפט…')
  try {
    const r = await $.model.complete({
      model: 'sonnet',
      system: SYSTEM,
      prompt: `<draft>\n${draft}\n</draft>`,
      maxTokens: 4000,
      timeoutMs: 60000,
    })
    if (r.isAnswered && r.text.trim()) {
      await $.prompt.fill({ text: r.text.trim(), mode: 'replace' })
      $.ui.toast('הפרומפט סודר ✓ — בדוק ושלח')
    } else {
      $.ui.toast('לא הצלחתי לסדר את הפרומפט, נסה שוב')
    }
  } finally {
    isBusy = false
    $.ui.status(undefined)
  }
}

export const register: Register = on => {
  // Works on every surface: end the message with ++ and press send.
  on('prompt.submit', async ($, e, next) => {
    const t = e.text.trimEnd()
    if (e.command || e.isMeta || !t.endsWith(TRIGGER)) return next(e)
    await polish($, t.slice(0, -TRIGGER.length))
    return { drop: 'prompt-polisher: structured prompt placed in the box' }
  })

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Button } = $.ui.resolve(e)
    return (
      <Box>
        <Button key="polish" label="✨ סדר פרומפט" onPress={() => polish($)} />
      </Box>
    )
  })
}
