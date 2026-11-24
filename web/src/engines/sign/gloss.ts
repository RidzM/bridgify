/**
 * Approximate ISL gloss order from English (report §3.3.5 grammar note). Rules:
 * drop articles and be-verbs, time words first, question words last, negation after the verb,
 * subject–object–verb for simple sentences. Labelled "gloss approximation" in the UI.
 */
const ARTICLES = new Set(['a', 'an', 'the'])
const BE = new Set(['is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', "'s", "'re", "'m"])
const AUX = new Set(['do', 'does', 'did', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must'])
const WH = new Set(['what', 'where', 'when', 'why', 'how', 'who', 'whom', 'which', 'whose'])
const NEG = new Set(['not', "n't", 'no', 'never', 'dont', "don't", 'cannot', "can't", "won't", 'doesnt', "doesn't", 'didnt', "didn't", 'isnt', "isn't", 'arent', "aren't"])
const TIME = new Set(['today', 'tomorrow', 'yesterday', 'now', 'later', 'tonight', 'morning', 'evening', 'night', 'soon', 'always', 'sometimes'])
const SUBJ = new Set(['i', 'you', 'he', 'she', 'we', 'they', 'it', 'my', 'your', 'his', 'her', 'our', 'their'])
const VERBS = new Set(['go', 'come', 'want', 'need', 'like', 'love', 'eat', 'drink', 'see', 'give', 'help', 'call', 'know', 'understand', 'live', 'work', 'study', 'read', 'write', 'take', 'make', 'have', 'get', 'buy', 'sell', 'pay', 'meet', 'wait', 'stop', 'sit', 'stand', 'sleep', 'play', 'learn', 'teach', 'speak', 'sign', 'say', 'tell', 'ask', 'feel', 'find', 'look', 'open', 'close', 'bring', 'send'])
const LEMMA: Record<string, string> = { going: 'go', went: 'go', goes: 'go', coming: 'come', came: 'come', wants: 'want', wanted: 'want', needs: 'need', needed: 'need', likes: 'like', liked: 'like', eating: 'eat', ate: 'eat', drinking: 'drink', drank: 'drink', saw: 'see', seeing: 'see', gave: 'give', helping: 'help', helped: 'help', calling: 'call', called: 'call', knows: 'know', knew: 'know', lives: 'live', lived: 'live', working: 'work', worked: 'work', has: 'have', had: 'have', having: 'have', got: 'get', getting: 'get', said: 'say', told: 'tell', asked: 'ask', felt: 'feel', feeling: 'feel', found: 'find', looking: 'look', learning: 'learn', speaking: 'speak', signing: 'sign', waiting: 'wait', sleeping: 'sleep', hungry: 'hungry', children: 'child', people: 'person' }

export function islGloss(sentence: string): string[] {
  const words = sentence.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').split(/\s+/).filter(Boolean)
  const time: string[] = []; const wh: string[] = []; const neg: string[] = []; const rest: string[] = []
  for (const raw of words) {
    const w = LEMMA[raw] ?? raw
    if (ARTICLES.has(w) || BE.has(w) || AUX.has(w)) continue
    if (NEG.has(w)) { neg.push('NOT'); continue }
    if (WH.has(w)) { wh.push(w.toUpperCase()); continue }
    if (TIME.has(w)) { time.push(w.toUpperCase()); continue }
    rest.push(w)
  }
  // Subject–object–verb: move the first verb after the remaining words (simple sentences only).
  const vi = rest.findIndex((w, i) => VERBS.has(w) && (i > 0 || !SUBJ.has(w)))
  if (vi >= 0 && vi < rest.length - 1) { const [v] = rest.splice(vi, 1); rest.push(v!) }
  return [...time, ...rest.map((w) => w.toUpperCase()), ...neg.slice(0, 1), ...wh]
}
