import { describe, expect, it } from 'vitest'
import type { LogStepRecord } from '../shared/step-log-storage'
import {
  buildSessionMemory,
  isAbnormalStatus,
  selectPreviousRun,
  type MemoryTaskInput,
} from './memory-assembly'

let sequence = 0

function step(
  input: Partial<LogStepRecord> & { round: number; toolName: string },
): LogStepRecord {
  sequence += 1
  return {
    id: sequence,
    taskId: input.taskId ?? 'task-1',
    createdAt: sequence,
    round: input.round,
    toolName: input.toolName,
    argsRedacted: input.argsRedacted ?? '{}',
    ok: input.ok ?? true,
    code: input.code,
    message: input.message ?? '',
    durationMs: input.durationMs ?? 1,
    readOnly: input.readOnly ?? true,
    truncated: input.truncated ?? false,
  }
}

function task(overrides: Partial<MemoryTaskInput> = {}): MemoryTaskInput {
  return {
    taskId: 'task-1',
    goal: '把当前页面翻译成英文',
    status: 'cancelled',
    rounds: 5,
    droppedSteps: 0,
    steps: [],
    ...overrides,
  }
}

describe('buildSessionMemory', () => {
  it('injects the ledger for an abnormal run', () => {
    const result = buildSessionMemory({
      tasks: [
        task({
          status: 'cancelled',
          rounds: 34,
          steps: [
            step({ round: 12, toolName: 'get_page_snapshot', message: '87 个元素' }),
            step({
              round: 20,
              toolName: 'fill_input',
              ok: false,
              code: 'element_not_found',
              message: '未找到元素',
              readOnly: false,
            }),
          ],
        }),
      ],
      currentGoal: '把当前页面翻译成英文',
      maxRounds: 50,
    })

    expect(result.text).toContain('<session-memory>')
    expect(result.text).toContain('上一段任务（用户手动停止，第 34/50 轮）')
    expect(result.text).toContain('#12 get_page_snapshot → ok 87 个元素')
    expect(result.text).toContain('#20 fill_input → failed element_not_found')
    expect(result.text).toContain('不要重复上面已成功的写操作')
  })

  it('does not inject the ledger for a completed run', () => {
    const result = buildSessionMemory({
      tasks: [task({ status: 'completed' })],
      currentGoal: '把当前页面翻译成英文',
      maxRounds: 50,
    })
    expect(result.text).toBe('')
    expect(result.signatures).toEqual([])
  })

  it('does not re-inject a folded run', () => {
    const result = buildSessionMemory({
      tasks: [task({ status: 'cancelled', foldedAt: Date.now() })],
      currentGoal: '把当前页面翻译成英文',
      maxRounds: 50,
    })
    expect(result.text).toBe('')
    expect(result.signatures).toEqual([])
  })

  it('keeps failed steps visible instead of reporting success', () => {
    const result = buildSessionMemory({
      tasks: [
        task({
          status: 'failed',
          steps: [
            step({ round: 3, toolName: 'click_element', ok: false, code: 'stale_element' }),
          ],
        }),
      ],
      currentGoal: '提交表单',
      maxRounds: 50,
    })
    expect(result.text).toContain('执行失败')
    expect(result.text).toContain('failed stale_element')
  })

  it('reports dropped steps so the ledger never looks complete', () => {
    const result = buildSessionMemory({
      tasks: [task({ droppedSteps: 7 })],
      currentGoal: '把当前页面翻译成英文',
      maxRounds: 50,
    })
    expect(result.text).toContain('另有 7 条更早的只读记录已省略')
  })

  it('caps the ledger and drops the oldest read-only rows first', () => {
    const steps = Array.from({ length: 15 }, (_, index) =>
      step({
        round: index + 1,
        toolName: 'get_page_snapshot',
        readOnly: index !== 0,
        ok: index !== 0,
      }),
    )
    const result = buildSessionMemory({
      tasks: [task({ steps })],
      currentGoal: '把当前页面翻译成英文',
      maxRounds: 50,
    })
    expect(result.text).toContain('另有 3 条更早的只读记录已省略')
    // 写操作优先保留
    expect(result.text).toContain('#1 get_page_snapshot → failed')
  })

  it('scopes the repeated-action rule to the same goal', () => {
    const same = buildSessionMemory({
      tasks: [task({ goal: '提交订单' })],
      currentGoal: '提交订单',
      maxRounds: 50,
    })
    expect(same.text).toContain('不要重复上面已成功的写操作')

    const different = buildSessionMemory({
      tasks: [task({ goal: '提交订单' })],
      currentGoal: '换一个任务：查询物流',
      maxRounds: 50,
    })
    expect(different.text).toContain('上一段任务与本轮无关')
  })

  it('inherits signatures only from the adjacent abnormal run', () => {
    const abnormal = buildSessionMemory({
      tasks: [task({ signatures: ['click_element:{"ref":"a"}'] })],
      currentGoal: '继续',
      maxRounds: 50,
    })
    expect(abnormal.signatures).toEqual(['click_element:{"ref":"a"}'])

    const completed = buildSessionMemory({
      tasks: [task({ status: 'completed', signatures: ['click_element:{"ref":"a"}'] })],
      currentGoal: '继续',
      maxRounds: 50,
    })
    expect(completed.signatures).toEqual([])
  })

  it('includes the session digest together with the ledger', () => {
    const result = buildSessionMemory({
      digest: '12:03 翻译 article（完成）',
      tasks: [task()],
      currentGoal: '继续',
      maxRounds: 50,
    })
    expect(result.text).toContain('会话摘要: 12:03 翻译 article（完成）')
  })
})

describe('selectPreviousRun', () => {
  it('only accepts abnormal statuses and ignores folded runs', () => {
    expect(isAbnormalStatus('cancelled')).toBe(true)
    expect(isAbnormalStatus('round_limit')).toBe(true)
    expect(isAbnormalStatus('interrupted')).toBe(true)
    expect(isAbnormalStatus('failed')).toBe(true)
    expect(isAbnormalStatus('completed')).toBe(false)
    expect(isAbnormalStatus('running')).toBe(false)

    expect(selectPreviousRun([])).toBeUndefined()
    expect(selectPreviousRun([task({ status: 'completed' })])).toBeUndefined()
    expect(selectPreviousRun([task({ foldedAt: 1 })])).toBeUndefined()
    expect(selectPreviousRun([task()])?.taskId).toBe('task-1')
  })
})
