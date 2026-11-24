import { describe, expect, it } from 'vitest'
import { punctuateSegment, joinSegments } from './punctuate'

describe('smart punctuation', () => {
  const cases: [string, string, string?][] = [
    ['i would like to order a black coffee', 'I would like to order a black coffee.'],
    ['where is the nearest hospital', 'Where is the nearest hospital?'],
    ['can you help me', 'Can you help me?'],
    ['how are you doing today', 'How are you doing today?'],
    ['the the doctor is here', 'The doctor is here.'],
    ['please wait comma i am coming full stop', 'Please wait, I am coming.'],
    ['is it raining question mark', 'Is it raining?'],
    ['thank you', 'Thank you.'],
    ['it costs 20 rupees', 'It costs 20 rupees.'],
    ['already done.', 'Already done.'],
    ['  extra   spaces here ', 'Extra spaces here.'],
    ['kya aap meri madad karenge', 'Kya aap meri madad karenge?'],
    ['मुझे पानी चाहिए', 'मुझे पानी चाहिए।', 'hi'],
    ['क्या आप मेरी मदद करेंगे', 'क्या आप मेरी मदद करेंगे?', 'hi'],
    ['आप कहाँ जा रहे हैं', 'आप कहाँ जा रहे हैं।', 'hi'],
    ['line one new line line two', 'Line one\nLine two.'],
    ['what time is it exclamation mark', 'What time is it!'],
    ['hello', 'Hello.'],
    ['why not', 'Why not?'],
    ['the meeting is at five', 'The meeting is at five.'],
  ]
  for (const [inp, out, lang] of cases) it(`"${inp}"`, () => expect(punctuateSegment(inp, lang)).toBe(out))
  it('joins segments', () => expect(joinSegments(['Hello.', '', 'How are you?'])).toBe('Hello. How are you?'))
})
