import { describe, expect, it } from 'vitest'
import { islGloss } from './gloss'

describe('ISL gloss approximation', () => {
  const cases: [string, string][] = [
    ['Where is the hospital?', 'HOSPITAL WHERE'],
    ['I am not hungry', 'I HUNGRY NOT'],
    ['I want water', 'I WATER WANT'],
    ['What is your name?', 'YOUR NAME WHAT'],
    ['I am going home tomorrow', 'TOMORROW I HOME GO'],
    ['Thank you', 'THANK YOU'],
    ['Please help me', 'PLEASE ME HELP'],
    ["I don't understand", 'I UNDERSTAND NOT'],
    ['Where is the toilet?', 'TOILET WHERE'],
    ['How are you?', 'YOU HOW'],
    ['I need a doctor', 'I DOCTOR NEED'],
    ['Call my mother now', 'NOW MY MOTHER CALL'],
  ]
  for (const [en, gloss] of cases) it(en, () => expect(islGloss(en).join(' ')).toBe(gloss))
})
