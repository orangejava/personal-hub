import assert from 'node:assert/strict';
import test from 'node:test';
import { createHooks, createReactivity, createEmitter, runLimited } from './interview-models.mjs';
const hooks = createHooks();
const counter = () => hooks.useState(0);
let [value,set] = hooks.render(counter); set(value+1);set(value+1);set(value+1);
assert.equal(hooks.render(counter)[0],1);
set(n=>n+1);set(n=>n+1);set(n=>n+1); assert.equal(hooks.render(counter)[0],4);
set(5);set(n=>n+1);assert.equal(hooks.render(counter)[0],6);
for (const v of [0,false,'',undefined,NaN]) {
 const h=createHooks();let calls=0;const render=()=>h.render(()=>h.useMemo(()=>{calls++;return v;},[NaN]));
 assert.ok(Object.is(render(),v));render();assert.equal(calls,1);
}
const h=createHooks();let calls=0;
for(const deps of [[0],[-0],[-0,1],undefined,undefined]) h.render(()=>h.useMemo(()=>++calls,deps));
assert.equal(calls,5);
const failHooks=createHooks();assert.throws(()=>failHooks.render(()=>failHooks.useMemo(()=>{throw Error('x');},[])));
assert.equal(failHooks.render(()=>failHooks.useMemo(()=>7,[])),7);
const {reactive,effect}=createReactivity();const state=reactive({ok:true,a:1,b:2});let seen;let runs=0;
const stop=effect(()=>{runs++;seen=state.ok?state.a:state.b;});state.ok=false;assert.equal(seen,2);
state.a=99;assert.equal(runs,2);state.b=3;assert.equal(seen,3);stop();stop();state.b=4;assert.equal(runs,3);
const e=createEmitter();const off=e.on('x',()=>{});off();let count=0;e.on('x',()=>count++);off();e.emit('x');assert.equal(count,1);
let active=0,peak=0;
const tasks=[30,5,1,10].map((delay,i)=>async()=>{active++;peak=Math.max(peak,active);try{await new Promise(r=>setTimeout(r,delay));if(i===1)throw Error('expected');return i;}finally{active--;}});
const result=await runLimited(tasks,2);assert.equal(peak,2);assert.equal(result[1].status,'rejected');assert.equal(result[3].value,3);
assert.deepEqual(await runLimited([],2),[]);await assert.rejects(runLimited([],0),RangeError);
assert.equal((await runLimited([()=>{throw Error('sync');},()=>42],1))[1].value,42);
console.log('PASS: 更新队列、memo 假值/依赖/异常、依赖清理、重复取消、并发上限/顺序/失败/空输入');

test('事件发布使用快照：新增下轮生效，本轮取消仍在快照中', () => {
  const bus = createEmitter();
  const seen = [];
  let offSecond;
  bus.on('tick', () => {
    seen.push('first');
    offSecond();
    bus.on('tick', () => seen.push('new'));
  });
  offSecond = bus.on('tick', () => seen.push('second'));
  bus.emit('tick');
  assert.deepEqual(seen, ['first', 'second']);
  seen.length = 0;
  bus.emit('tick');
  assert.deepEqual(seen, ['first', 'new']);
});

test('memo 重新计算失败后保留上一次成功缓存', () => {
  const hooks = createHooks();
  assert.equal(hooks.render(() => hooks.useMemo(() => 7, [1])), 7);
  assert.throws(() => hooks.render(() => hooks.useMemo(() => { throw Error('failed'); }, [2])));
  assert.equal(hooks.render(() => hooks.useMemo(() => { throw Error('不应执行'); }, [1])), 7);
});

test('嵌套 effect 完成或抛错后恢复外层依赖上下文', () => {
  const { reactive, effect } = createReactivity();
  const state = reactive({ outer: 0, inner: 0 });
  let runs = 0;
  const stop = effect(() => {
    runs++;
    const stopInner = effect(() => state.inner);
    stopInner();
    assert.throws(() => effect(() => { throw Error('inner'); }));
    void state.outer;
  });
  state.outer++;
  assert.equal(runs, 2);
  state.inner++;
  assert.equal(runs, 2);
  stop();
});

test('并发限制拒绝非整数、负数和无限值；允许上限大于任务数', async () => {
  for (const limit of [-1, 1.5, NaN, Infinity]) {
    await assert.rejects(runLimited([], limit), RangeError);
  }
  assert.deepEqual(await runLimited([() => 9], 20), [{ status: 'fulfilled', value: 9 }]);
});
