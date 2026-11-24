import { describe, expect, it } from 'vitest'
import { translateGrade1, backTranslateGrade1 } from './grade1'
import { toBrf, charToDots, dotsToChar } from './cells'

describe('UEB grade 1 offline', () => {
  // Expected strings below are verbatim liblouis 3.39 en-ueb-g1.ctb output.
  it('translates the report test case (capitals passage)', () => {
    expect(translateGrade1('HELLO, HOW ARE YOU?').unicode).toBe('⠠⠠⠠⠓⠑⠇⠇⠕⠂⠀⠓⠕⠺⠀⠁⠗⠑⠀⠽⠕⠥⠦⠠⠄')
    expect(translateGrade1('THE RED FORT').unicode).toBe('⠠⠠⠠⠞⠓⠑⠀⠗⠑⠙⠀⠋⠕⠗⠞⠠⠄')
  })
  it('marks single capitals and numbers', () => {
    expect(translateGrade1('Hi 25').unicode).toBe('⠠⠓⠊⠀⠼⠃⠑')
  })
  it('uses the capital word indicator for one or two caps words', () => {
    expect(translateGrade1('I need HELP now').unicode).toBe('⠠⠊⠀⠝⠑⠑⠙⠀⠠⠠⠓⠑⠇⠏⠀⠝⠕⠺')
  })
  it('inserts grade 1 indicator after a number before a-j', () => {
    expect(translateGrade1('3a').unicode).toBe('⠼⠉⠰⠁')
  })
  it('round-trips through back translation', () => {
    for (const s of ['hello world', 'HELLO, HOW ARE YOU?', 'Room 42', 'yes! no?']) {
      expect(backTranslateGrade1(translateGrade1(s).unicode)).toBe(s)
    }
  })
  it('maps dots both ways and to BRF', () => {
    expect(charToDots('⠓')).toEqual([1, 2, 5])
    expect(dotsToChar([1, 2, 5])).toBe('⠓')
    expect(toBrf('⠓⠑⠇⠇⠕')).toBe('HELLO')
  })
})
