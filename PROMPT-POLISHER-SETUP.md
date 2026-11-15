# Prompt Polisher — מוד ל-Claude Code שהופך טקסט מבולגן לפרומפט מסודר

מוד (plugin) שמקבל את מה שכתבת בתיבת הטקסט, גם אם זה בלגן, ומחליף אותו בפרומפט מסודר לפי עקרונות הפרומפטינג המומלצים של Anthropic: תפקיד, הקשר, משימה, הגבלות, דוגמאות ופורמט פלט. הפרומפט נכתב באותה שפה שבה כתבת. הוא לא נשלח אוטומטית: אתה בודק, מתקן ושולח.

## איך משתמשים

- **בכל משטח:** כותבים את הטקסט, מוסיפים `++` בסוף ההודעה ושולחים. התיבה מתמלאת בפרומפט המסודר.
- **כפתור:** `✨ סדר פרומפט` מעל תיבת הטקסט, במשטחים שמציירים אותו. הלחיצה מסדרת את הטקסט שכבר בתיבה.

## דרישות

- Claude Code בטרמינל או באפליקציית הדסקטופ (סשן מקומי). בסשני ענן אי אפשר להתקין תוספים.
- חשבון GitHub, אם רוצים להתקין דרך marketplace.

## אפשרות א': התקנה מוכנה מהריפו (הכי פשוט)

אם הריפו נגיש לך (הבעלים צריך להזמין אותך אם הוא פרטי):

```
/plugin install prompt-polisher --marketplace sfadiaitay-bit/prompt-polisher
```

עונים `y` ובוחרים בהיקף **user**.

## אפשרות ב': יוצרים את המוד מאפס

צור תיקייה בשם `prompt-polisher` עם ארבעת הקבצים הבאים בדיוק.

### 1. `.claude-plugin/plugin.json`

```json
{ "name": "prompt-polisher", "version": "0.1.0", "description": "Button above the prompt box (or ++ at the end of a message) that turns messy typed text into a structured prompt." }
```

### 2. `hooks/hooks.json`

```json
{ "modules": ["./register.tsx"] }
```

### 3. `hooks/register.tsx`

```tsx
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
```

### 4. `.claude-plugin/marketplace.json`

```json
{
  "name": "prompt-polisher",
  "owner": { "name": "prompt-polisher" },
  "plugins": [{ "name": "prompt-polisher", "source": "./" }]
}
```

### הפעלה

1. מעלים את התיקייה לריפו ב-GitHub (`git init`, `git add .`, `git commit`, `git push`).
2. מתקינים:

```
/plugin install prompt-polisher --marketplace <owner>/<repo>
```

3. לבדיקה מקומית בלי GitHub, מפעילים את Claude Code עם התיקייה:

```
claude --plugin-dir /path/to/prompt-polisher
```

## התאמות נפוצות

- **שינוי מבנה הפרומפט:** עורכים את הטקסט במשתנה `SYSTEM` בקובץ `register.tsx`.
- **שינוי סימן ההפעלה:** משנים את `TRIGGER` מ-`++` למה שנוח לך.
- **מודל מהיר וזול יותר:** מחליפים את `model: 'sonnet'` ל-`'haiku'`.

## הערות

- לא נבדק בפועל מול כל משטח. הכפתור לא הופיע באפליקציית ענן, ולכן יש את דרך ה-`++`.
- אם `++` לא מחליף את הטקסט אחרי שליחה, יש לדווח על כך כדי לתקן.
