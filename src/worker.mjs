const categories = new Set([
  'Rent / mortgage', 'Car payment', 'Groceries', 'Gas',
  'Utilities', 'Insurance', 'Subscriptions', 'Dining out'
]);
const amount = value => typeof value === 'number' && Number.isFinite(value)
  && value >= 0 && value <= 100_000_000;

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/insight') return env.ASSETS.fetch(request);
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (request.headers.get('Origin') !== url.origin) return json({ error: 'Wrong origin' }, 403);
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) {
      return json({ error: 'Expected JSON' }, 415);
    }
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    try {
      if (!(await env.INSIGHT_LIMIT.limit({ key: ip })).success) {
        return json({ error: 'Please wait before trying again' }, 429);
      }
      const reader = request.body?.getReader();
      if (!reader) return json({ error: 'Missing budget' }, 400);
      const decoder = new TextDecoder();
      let raw = '';
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4096) {
          await reader.cancel();
          return json({ error: 'Budget payload too large' }, 413);
        }
        raw += decoder.decode(value, { stream: true });
      }
      let budget;
      try { budget = JSON.parse(raw + decoder.decode()); }
      catch { return json({ error: 'Invalid JSON' }, 400); }
      if (!budget || ![budget.income, budget.expenses, budget.saved].every(amount)
        || !Array.isArray(budget.categories) || budget.categories.length > 8
        || !budget.categories.every(row => Array.isArray(row) && row.length === 2
          && categories.has(row[0]) && amount(row[1]))) {
        return json({ error: 'Invalid budget totals' }, 400);
      }
      const { income, expenses, saved, categories: expensesByCategory } = budget;
      const figures = { income, expenses, saved, remaining: Number((income - expenses - saved).toFixed(2)), expensesByCategory };
      const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
        messages: [
          { role: 'system', content: 'Summarize this monthly cash-flow plan in at most three short sentences. Use only the supplied USD figures. Say whether expenses and savings fit the income. If the margin is tight, suggest one realistic adjustment in a supplied flexible category if present. Do not infer overall financial health, recommend investments, or imply any expense can definitely be cut.' },
          { role: 'user', content: JSON.stringify(figures) }
        ],
        max_tokens: 220
      });
      if (typeof result.response !== 'string' || !result.response.trim()) {
        return json({ error: 'AI response unavailable' }, 502);
      }
      return json({ insight: result.response.trim() });
    } catch {
      return json({ error: 'AI suggestions unavailable' }, 503);
    }
  }
};
