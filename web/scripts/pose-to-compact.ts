// Usage: node scripts/pose-to-compact.ts <in.pose> <out.json>   (Node ≥ 22.18 strips TS types)
import { readFileSync, writeFileSync } from 'node:fs'
import { readPose } from '../src/engines/sign/poseFile.ts'
import { compactPose } from '../src/engines/sign/poseCompact.ts'
const [, , inp, out] = process.argv
if (!inp || !out) { console.error('usage: pose-to-compact <in.pose> <out.json>'); process.exit(2) }
const b = readFileSync(inp)
const c = compactPose(readPose(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)))
writeFileSync(out, JSON.stringify(c))
console.log(`${out}: ${c.frames} frames, ${JSON.stringify(c).length} bytes`)
