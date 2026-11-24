// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadLouis, tuning, type Louis, type LouisTable } from './louis'
import golden from './__fixtures__/golden.json'

// The built artefacts in public/ (tools-wasm/build-liblouis.sh), loaded the way
// Node loads them; the browser fetches the same two files.
const dir = new URL('../../../public/wasm/liblouis/', import.meta.url)
const moduleUrl = pathToFileURL(fileURLToPath(new URL('liblouis.mjs', dir))).href
const wasmBinary = readFileSync(fileURLToPath(new URL('liblouis.wasm', dir)))

interface GoldenCase { kind: 'translate' | 'back'; table: LouisTable; input: string; expected: string }
const cases = golden.cases as GoldenCase[]

let louis: Louis
beforeAll(async () => {
  louis = await loadLouis({ moduleUrl, wasmBinary })
})

describe('liblouis wasm', () => {
  it('is the same liblouis version as the native golden source', () => {
    expect(louis.version()).toBe(golden.liblouis)
  })

  it('has at least 40 golden cases', () => {
    expect(cases.length).toBeGreaterThanOrEqual(40)
  })

  it.each(cases.map((c, i) => [i, c] as const))('golden %i', (_i, c) => {
    const got = c.kind === 'translate' ? louis.translate(c.input, c.table) : louis.backTranslate(c.input, c.table)
    expect(got).toBe(c.expected)
  })

  it('returns the singleton on repeat loads', async () => {
    expect(await loadLouis()).toBe(louis)
  })

  it('handles empty input and long grade 2 text without heap damage', () => {
    expect(louis.translate('', 'en-ueb-g2')).toBe('')
    const para = 'Knowledge and the people of the world, with all their children, ought to go through it together. '
    const long = para.repeat(200)
    const once = louis.translate(para.trim(), 'en-ueb-g2')
    const many = louis.translate(long, 'en-ueb-g2')
    expect(many.length).toBeGreaterThan(once.length * 150)
    expect(many.startsWith(once)).toBe(true)
    // Engine still healthy afterwards.
    const first = cases[0]!
    expect(louis.translate(first.input, first.table)).toBe(first.expected)
    expect(louis.backTranslate(louis.translate('people like to read', 'en-ueb-g2'), 'en-ueb-g2')).toBe('people like to read')
  })

  it('grows the output buffer and retries when liblouis fills it', () => {
    const saved = tuning.initialCapacity
    tuning.initialCapacity = () => 8 // forces several doublings
    try {
      for (const c of cases) {
        const got = c.kind === 'translate' ? louis.translate(c.input, c.table) : louis.backTranslate(c.input, c.table)
        expect(got).toBe(c.expected)
      }
    } finally {
      tuning.initialCapacity = saved
    }
  })

  it('maps Devanagari to braille cells only', () => {
    const u = louis.translate('नमस्ते', 'hi-in-g1')
    expect([...u].every((ch) => ch.codePointAt(0)! >= 0x2800 && ch.codePointAt(0)! <= 0x28ff)).toBe(true)
  })
})
