import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { dependentsOf } from './dependents.ts'

// { from, to }: `from` depends on `to`.
const dep = (from: string, to: string, id = `${from}>${to}`) => ({ id, from, to })

describe('dependentsOf', () => {
  it('follows the chain, nearest first', () => {
    // B and D depend on A; C depends on B.
    assert.deepEqual(dependentsOf([dep('b', 'a'), dep('c', 'b'), dep('d', 'a')], 'a'), ['b', 'd', 'c'])
  })

  it('does not include what the item itself depends on', () => {
    assert.deepEqual(dependentsOf([dep('a', 'x'), dep('b', 'a')], 'a'), ['b'])
  })

  it('counts an item reached twice once', () => {
    // C depends on both B and D, which both depend on A.
    assert.deepEqual(dependentsOf([dep('b', 'a'), dep('d', 'a'), dep('c', 'b'), dep('c', 'd')], 'a'), ['b', 'd', 'c'])
  })

  it('stops at cycles and never returns the item itself', () => {
    assert.deepEqual(dependentsOf([dep('b', 'a'), dep('a', 'b')], 'a'), ['b'])
  })

  it('is empty when nothing depends on the item', () => {
    assert.deepEqual(dependentsOf([dep('a', 'b')], 'a'), [])
  })
})
