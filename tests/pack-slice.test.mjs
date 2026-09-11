import assert from 'node:assert/strict';
import test from 'node:test';
import { canStartSlice, sliceProgress } from '../app/pack-slice.ts';
import { canOpenPacks, finalizeOpenedPacks, createEconomyState } from '../app/economy.ts';
test('only a horizontal swipe from a seam edge progresses the cut', () => {
  assert.equal(canStartSlice(.1,.17),true);
  assert.equal(canStartSlice(.9,.3),true);
  assert.equal(canStartSlice(.5,.17),false);
  assert.equal(canStartSlice(.1,.6),false);
  assert.equal(sliceProgress(10,10,200,1),0);
  assert.equal(sliceProgress(10,-100,200,1),0);
  assert.equal(sliceProgress(10,160,200,1),1);
  assert.equal(sliceProgress(190,40,200,-1),1);
  assert.equal(sliceProgress(10,35,200,1)<.88,true);
});
test('ten pack purchase charges ten packs and preserves repeated cards across packs', () => {
  const state=createEconomyState();
  const result=finalizeOpenedPacks(state,2,Array.from({length:10},()=>[1,2,3,4,5]));
  assert.equal(result.ok,true);
  assert.equal(result.state.balanceFen,0);
  assert.equal(result.state.stats.packsOpened,10);
  assert.equal(result.state.cards[1],10);
  assert.equal(state.balanceFen,2000);
  assert.deepEqual(state.cards,{});
});
test('unaffordable batch fails without charging or awarding partial packs', () => {
  const state={...createEconomyState(),balanceFen:1999};
  const before=structuredClone(state);
  assert.equal(canOpenPacks(state,2,10),false);
  assert.equal(finalizeOpenedPacks(state,2,Array.from({length:10},()=>[1])).ok,false);
  assert.deepEqual(state,before);
});
test('matching vouchers apply individually and invalid batch counts are refused', () => {
  const state={...createEconomyState(),balanceFen:1600,vouchers:{1:0,2:2}};
  assert.equal(canOpenPacks(state,2,10),true);
  const result=finalizeOpenedPacks(state,2,Array.from({length:10},()=>[1]));
  assert.equal(result.ok,true);
  assert.equal(result.state.balanceFen,0);
  assert.equal(result.state.vouchers[2],0);
  for(const count of [0,11,1.5]) assert.equal(canOpenPacks(state,2,count),false);
  assert.equal(finalizeOpenedPacks(state,2,[[]]).ok,false);
});
