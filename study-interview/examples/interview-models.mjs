/** 教学模型：不实现框架并发渲染、生命周期与完整依赖种类。 */
export function createHooks() {
  const slots = []; let cursor = 0;
  const next = () => { const i = cursor++; return slots[i] ??= {}; };
  return {
    render(fn) { cursor = 0; return fn(); },
    useState(initial) {
      const h = next();
      if (!h.ready) {
        h.value = typeof initial === 'function' ? initial() : initial;
        h.queue = []; h.ready = true;
        h.set = action => h.queue.push(action);
      }
      for (const action of h.queue) h.value = typeof action === 'function' ? action(h.value) : action;
      h.queue = [];
      return [h.value, h.set];
    },
    useMemo(factory, deps) {
      const h = next();
      const same = deps !== undefined && h.deps !== undefined && deps.length === h.deps.length && deps.every((v,i) => Object.is(v,h.deps[i]));
      if (!h.ready || !same) {
        const value = factory(); // 计算失败不写入新缓存。
        h.value = value; h.deps = deps?.slice(); h.ready = true;
      }
      return h.value;
    },
  };
}

/** 最小响应式：仅追踪普通对象已有属性的读写；不支持数组、遍历、computed 或调度。 */
export function createReactivity() {
  const bucket = new WeakMap(); let active;
  const cleanup = runner => { for (const dep of runner.deps) dep.delete(runner); runner.deps.clear(); };
  function effect(fn) {
    const runner = () => {
      if (runner.stopped) return;
      cleanup(runner); const parent = active; active = runner;
      try { return fn(); } finally { active = parent; }
    };
    runner.deps = new Set(); runner.stopped = false; runner();
    return () => { runner.stopped = true; cleanup(runner); };
  }
  function reactive(target) {
    return new Proxy(target, {
      get(t,k,r) {
        if (active) {
          let keys = bucket.get(t); if (!keys) bucket.set(t, keys = new Map());
          let dep = keys.get(k); if (!dep) keys.set(k, dep = new Set());
          dep.add(active); active.deps.add(dep);
        }
        return Reflect.get(t,k,r);
      },
      set(t,k,v,r) {
        const old = Reflect.get(t,k,r); const ok = Reflect.set(t,k,v,r);
        if (ok && !Object.is(old,v)) {
          // 快照避免 effect 清理后重新加入 Set 导致同轮重复遍历。
          for (const run of new Set(bucket.get(t)?.get(k))) if (run !== active) run();
        }
        return ok;
      },
    });
  }
  return { effect, reactive };
}

/** 取消可重复调用；发布使用快照，本轮新增订阅从下一轮接收。异常向调用方传播。 */
export function createEmitter() {
  const channels = new Map();
  return {
    on(type, listener) {
      let set = channels.get(type); if (!set) channels.set(type, set = new Set());
      const entry = { listener }; set.add(entry); let disposed = false;
      return () => {
        if (disposed) return; disposed = true; set.delete(entry);
        if (!set.size && channels.get(type) === set) channels.delete(type);
      };
    },
    emit(type, value) { for (const entry of [...(channels.get(type) ?? [])]) entry.listener(value); },
  };
}

/** 输入任务为惰性函数；收集全部成功/失败结果，结果保持输入顺序，不实现取消。 */
export async function runLimited(tasks, limit) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit 必须是正整数');
  const results = new Array(tasks.length); let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      try { results[i] = { status: 'fulfilled', value: await tasks[i]() }; }
      catch (reason) { results[i] = { status: 'rejected', reason }; }
    }
  }
  await Promise.all(Array.from({length: Math.min(limit,tasks.length)},worker));
  return results;
}
