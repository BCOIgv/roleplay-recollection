import crypto from 'node:crypto';
import {MemoryStore} from './store.mjs';
import {episode, memoryView, candidates, rehearse} from './memory.mjs';
import {
  configure, situation, dayKey, text, DAY, VERSION, RECOLLECTION_PROMPT, validateReflection,
} from './policy.mjs';
import {callModel} from './model.mjs';
import {scheduleSolitude, solitude, takeContact, settleContact, trimExpressions} from './solitude.mjs';

const stopped = () => new Error('Recollection interrupted');
const deadProcess = pid => {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return error.code === 'ESRCH';
  }
};
const redact = message => String(message).replace(/sk-[\w.-]{8,}/g, '[redacted]').slice(0, 200);

export class CompanionMemory {
  constructor(input, {reflect = null, wander = reflect, now = Date.now, random = Math.random} = {}) {
    this.config = configure(input);
    if (reflect !== null && typeof reflect !== 'function') throw new Error('reflect must be a function');
    if (wander !== null && typeof wander !== 'function') throw new Error('wander must be a function');
    this.reflect = reflect;
    this.wander = wander;
    this.now = now;
    this.random = random;
    this.closed = false;
    this.running = null;
    this.controller = null;
    this.identity = Object.freeze({
      characterId: this.config.characterId,
      scopeId: this.config.scopeId,
      mode: this.config.mode,
      storyId: this.config.storyId,
    });
    this.store = new MemoryStore({directory: input.stateDir, identity: this.identity});
    this.store.transaction(state => {
      const inflight = state.inflight;
      if (inflight && (deadProcess(inflight.pid) || this.now() - inflight.started > this.config.modelTimeoutMs + 300000)) {
        const wasSolitude = inflight.kind === 'solitude';
        state.runs.push({opportunityId: inflight.opportunityId, status: 'interrupted', at: this.now()});
        state.inflight = null;
        state.runs = state.runs.slice(-100);
        if (wasSolitude) scheduleSolitude(this, state, this.now(), true);
      }
      scheduleSolitude(this, state, this.now());
    });
  }

  _assertOpen() {
    if (this.closed) throw new Error('Memory core is closed');
  }

  status() {
    const state = this.store.read();
    const views = new Map(state.episodes.map(record => [record.id, memoryView(record, this.config, this.now())]));
    const active = state.episodes.filter(record => record.status === 'active');
    const visible = active.map(record => views.get(record.id)).filter(Boolean);
    return {
      version: VERSION,
      ...this.identity,
      paused: state.paused,
      closed: this.closed,
      episodes: active.length,
      specific: visible.filter(view => view.detail === 'specific').length,
      impressions: visible.filter(view => view.detail === 'impression').length,
      dormant: active.length - visible.length,
      privateThoughts: state.thoughts.length,
      pendingExpressions: state.expressions.filter(item => item.status === 'pending' && item.expiresAt > this.now()).length,
      modelCallsToday: state.days[dayKey(this.now())]?.calls || 0,
      dailyModelCalls: this.config.dailyModelCalls,
      lastRecallOpportunityAt: state.lastAttemptAt,
      lastExpressionProposedAt: state.lastExpressionAt,
      latest: state.runs.slice(-4),
      solitude: {
        active: state.inflight?.kind === 'solitude',
        nextAt: state.solitude.plan.dueAt,
        reason: state.solitude.plan.reason,
        threshold: state.solitude.plan.threshold,
        lastEndedAt: state.solitude.lastEndedAt,
        lastContactAt: state.solitude.lastContactAt,
        pending: state.expressions
          .filter(item => item.origin === 'solitude' && ['pending', 'taken', 'unknown'].includes(item.status))
          .map(({id, status, expiresAt}) => ({id, status, expiresAt})),
        history: state.solitude.history.slice(-5),
      },
    };
  }

  capture(raw, context) {
    this._assertOpen();
    if (!context || typeof context !== 'object') throw new Error('Capture context is required');
    if (context.mode === 'task') return {stored: false, reason: 'task_mode'};
    if (context.mode !== this.config.mode || (context.storyId ?? null) !== this.config.storyId) {
      throw new Error('Capture context does not match the character memory');
    }
    const item = episode(raw, this.config, this.now());
    const salience = item.importance * 0.7 + item.emotionalWeight * 0.3;
    const result = this.store.transaction(state => {
      const existing = state.episodes.find(record => record.id === item.id);
      if (existing) {
        if (existing.status === 'withdrawn') return {stored: false, reason: 'withdrawn_id'};
        if (existing.revision !== item.revision) {
          throw new Error('Existing episode changed; use revise with its current revision');
        }
        return {stored: false, duplicate: true, id: item.id};
      }
      const sameSource = state.episodes.find(record => record.sourceKey === item.sourceKey);
      if (sameSource) {
        return {
          stored: false,
          duplicate: true,
          id: sameSource.id,
          reason: sameSource.status === 'withdrawn' ? 'withdrawn_source' : 'same_source',
        };
      }
      if (salience < this.config.minimumSalience && item.retention !== 'explicitly_retained') {
        return {stored: false, reason: 'low_salience'};
      }
      if (state.episodes.length >= this.config.maxEpisodes) throw new Error('Episode capacity reached');
      state.episodes.push({
        ...item,
        status: 'active',
        capturedAt: this.now(),
        lastRecalledAt: null,
        lastExpressionAt: null,
        recallCount: 0,
        rehearsalBoost: 0,
        detailFaded: false,
      });
      state.epoch++;
      return {stored: true, id: item.id, revision: item.revision};
    });
    if (result.stored) this.controller?.abort(stopped());
    return result;
  }

  revise(id, expectedRevision, raw) {
    this._assertOpen();
    const item = episode({...raw, id}, this.config, this.now());
    this.store.transaction(state => {
      const existing = state.episodes.find(record => record.id === id);
      if (!existing || existing.status === 'withdrawn' || existing.revision !== expectedRevision) {
        throw new Error('Episode revision no longer matches');
      }
      if (state.episodes.some(record => record.id !== id && record.sourceKey === item.sourceKey)) {
        throw new Error('Revised source already belongs to another episode');
      }
      Object.assign(existing, item, {
        status: 'active',
        capturedAt: this.now(),
        lastRecalledAt: null,
        lastExpressionAt: null,
        recallCount: 0,
        rehearsalBoost: 0,
        detailFaded: false,
      });
      state.thoughts = state.thoughts.filter(thought => thought.memoryId !== id);
      state.expressions = state.expressions.filter(expression => expression.memoryId !== id);
      state.epoch++;
    });
    this.controller?.abort(stopped());
    return {revised: true, id, revision: item.revision};
  }

  forget(id) {
    this._assertOpen();
    const result = this.store.transaction(state => {
      const existing = state.episodes.find(record => record.id === id);
      if (!existing || existing.status === 'withdrawn') return {forgotten: false};
      state.episodes[state.episodes.indexOf(existing)] = {
        id: existing.id,
        revision: existing.revision,
        sourceKey: existing.sourceKey,
        status: 'withdrawn',
      };
      state.thoughts = state.thoughts.filter(thought => thought.memoryId !== id);
      state.expressions = state.expressions.filter(expression => expression.memoryId !== id);
      state.epoch++;
      return {forgotten: true, id};
    });
    if (result.forgotten) this.controller?.abort(stopped());
    return result;
  }

  setSourceAvailable(id, available) {
    this._assertOpen();
    if (typeof available !== 'boolean') throw new Error('Invalid source availability update');
    this.store.transaction(state => {
      const existing = state.episodes.find(record => record.id === id);
      if (!existing || existing.status === 'withdrawn') throw new Error('Active source episode required');
      existing.status = available ? 'active' : 'unavailable';
      if (!available) {
        state.thoughts = state.thoughts.filter(thought => thought.memoryId !== id);
        state.expressions = state.expressions.filter(expression => expression.memoryId !== id);
      }
      state.epoch++;
    });
    this.controller?.abort(stopped());
  }

  pause(value = true) {
    this._assertOpen();
    if (typeof value !== 'boolean') throw new Error('Invalid pause request');
    this.store.transaction(state => {
      state.paused = value;
      state.epoch++;
    });
    this.controller?.abort(stopped());
    return {paused: value};
  }

  visible(context) {
    const current = situation({...context, trigger: context?.trigger || 'idle'}, this.config);
    if (this.closed || current.skip) return [];
    const state = this.store.read();
    if (state.paused) return [];
    return candidates(state.episodes, current, this.config, this.now());
  }

  privateThoughts(context) {
    const current = situation({...context, trigger: context?.trigger || 'idle'}, this.config);
    if (this.closed || current.skip) return [];
    const state = this.store.read();
    if (state.paused) return [];
    return state.thoughts
      .filter(thought => {
        const record = state.episodes.find(item => item.id === thought.memoryId && item.revision === thought.revision);
        const view = record && memoryView(record, this.config, this.now());
        // An old thought must not become a back door to now-faded details.
        return view && view.detail === thought.detail;
      })
      .slice(-3)
      .map(thought => ({...thought, status: 'tentative_character_thought', usableAsEvidence: false}));
  }

  current(token, signal) {
    if (this.closed || !signal || signal.aborted) return false;
    const state = this.store.read();
    return !state.paused && state.epoch === token.epoch && state.inflight?.id === token.id;
  }

  async recollect(context, {signal: parentSignal} = {}) {
    if (context?.trigger === 'idle') return this.solitude(context, {signal: parentSignal});
    const current = situation(context, this.config);
    if (current.skip) return {status: 'skipped', reason: current.skip, modelCalls: 0};
    if (current.busy || current.userAwaitingReply) {
      return {status: 'skipped', reason: 'conversation_has_priority', modelCalls: 0};
    }
    if (this.closed || parentSignal?.aborted) {
      return {status: 'skipped', reason: 'closed_or_cancelled', modelCalls: 0};
    }
    if (this.running) return {status: 'skipped', reason: 'already_recollecting', modelCalls: 0};
    const opportunityId = text(context.opportunityId, 100, 'opportunityId');
    const now = this.now();
    const day = dayKey(now);
    const prepared = this.store.transaction(state => {
      if (state.paused || state.inflight) return {skip: 'paused_or_busy'};
      if (state.runs.some(run => run.opportunityId === opportunityId)) return {skip: 'duplicate_opportunity'};
      if (state.lastAttemptAt !== null && now - state.lastAttemptAt < this.config.recallIntervalHours * 3600000) {
        return {skip: 'recall_cooldown'};
      }
      const memories = candidates(state.episodes, current, this.config, now);
      if (!memories.length) return {skip: 'no_association'};
      if (this.reflect && (state.days[day]?.calls || 0) >= this.config.dailyModelCalls) {
        return {skip: 'model_budget'};
      }
      for (const record of state.episodes) {
        const view = memoryView(record, this.config, now);
        if (record.status === 'active' && (!view || view.detail === 'impression')) record.detailFaded = true;
      }
      state.lastAttemptAt = now;
      const token = {id: crypto.randomUUID(), opportunityId, epoch: state.epoch, pid: process.pid, started: now};
      state.inflight = token;
      if (this.reflect) {
        (state.days[day] ||= {calls: 0}).calls++;
        state.days = Object.fromEntries(Object.entries(state.days).sort().slice(-14));
      }
      return {token, memories, modelCalls: this.reflect ? 1 : 0};
    });
    if (prepared.skip) return {status: 'skipped', reason: prepared.skip, modelCalls: 0};
    const controller = new AbortController();
    this.controller = controller;
    const cancel = () => controller.abort(stopped());
    parentSignal?.addEventListener('abort', cancel, {once: true});
    if (parentSignal?.aborted) cancel();
    const work = this.perform(current, prepared, controller.signal);
    this.running = work;
    try {
      return await work;
    } finally {
      parentSignal?.removeEventListener('abort', cancel);
      this.running = null;
      this.controller = null;
    }
  }

  async perform(context, {token, memories, modelCalls}, signal) {
    let outcome = {status: 'interrupted', modelCalls};
    try {
      if (!this.current(token, signal)) throw stopped();
      if (!this.reflect) {
        this.store.transaction(state => {
          if (!this.current(token, signal)) throw stopped();
          rehearse(state.episodes.find(record => record.id === memories[0].id), this.config, this.now());
        });
        outcome = {status: 'recalled', memory: memories[0], expression: null, modelCalls: 0};
        return outcome;
      }
      const response = await callModel(request => {
        if (!this.current(token, signal)) throw stopped();
        return this.reflect(request);
      }, {
        system: RECOLLECTION_PROMPT,
        input: {
          mode: context.mode,
          storyId: this.config.storyId,
          persona: this.config.persona,
          cue: context.cue,
          trigger: context.trigger,
          moodTags: context.moodTags,
          mayExpress: context.allowExpression,
          memories: structuredClone(memories),
        },
        maxTokens: this.config.maxOutputTokens,
      }, {signal, timeoutMs: this.config.modelTimeoutMs, label: 'Reflection'});
      const decision = validateReflection(response?.value, memories);
      if (!this.current(token, signal)) throw stopped();
      outcome = this.commit(decision, memories, context, token, signal);
      return outcome;
    } catch (error) {
      outcome = {
        status: signal.aborted || this.closed || !this.current(token, signal) ? 'interrupted' : 'failed',
        reason: redact(error?.message ?? error),
        modelCalls,
      };
      return outcome;
    } finally {
      this.store.transaction(state => {
        if (state.inflight?.id === token.id) {
          state.inflight = null;
          state.runs.push({
            opportunityId: token.opportunityId,
            at: this.now(),
            status: outcome.status,
            ...(outcome.memoryId ? {memoryId: outcome.memoryId} : {}),
          });
          state.runs = state.runs.slice(-100);
        }
      });
    }
  }

  commit(decision, supplied, context, token, signal) {
    return this.store.transaction(state => {
      if (!this.current(token, signal)) throw stopped();
      if (decision.action === 'silence') return {status: 'silence', modelCalls: 1, expression: null};
      const record = state.episodes.find(item => item.id === decision.memoryId && item.revision === decision.revision);
      const currentView = record && memoryView(record, this.config, this.now());
      const previousView = supplied.find(item => item.id === decision.memoryId);
      if (!currentView || !previousView || currentView.detail !== previousView.detail) throw stopped();
      const now = this.now();
      rehearse(record, this.config, now);
      let thoughtId = null;
      if (decision.thought) {
        thoughtId = 'thought_' + crypto.randomUUID();
        state.thoughts.push({
          id: thoughtId,
          memoryId: record.id,
          revision: record.revision,
          at: now,
          detail: currentView.detail,
          text: decision.thought,
          anchor: decision.anchor,
          truth: 'tentative_reflection',
        });
        state.thoughts = state.thoughts.slice(-this.config.maxThoughts);
      }
      const result = {
        status: thoughtId ? 'kept' : 'silence',
        memoryId: record.id,
        thoughtId,
        expression: null,
        modelCalls: 1,
      };
      if (decision.action !== 'express') return result;
      const reason = !context.allowExpression ? 'private_moment'
        : state.lastExpressionAt !== null
          && now - state.lastExpressionAt < this.config.expressionIntervalHours * 3600000 ? 'expression_cooldown'
          : record.lastExpressionAt !== null
            && now - record.lastExpressionAt < this.config.sameMemoryExpressionDays * DAY ? 'already_brought_up'
            : null;
      if (reason) return {...result, expressionSuppressed: reason};
      const proposal = {
        id: 'expression_' + crypto.randomUUID(),
        memoryId: record.id,
        revision: record.revision,
        detail: currentView.detail,
        truth: record.truth,
        storyId: record.storyId,
        text: decision.expression,
        anchor: decision.anchor,
        at: now,
        expiresAt: now + DAY,
        status: 'pending',
        scopeId: this.config.scopeId,
        characterId: this.config.characterId,
      };
      state.expressions.push(proposal);
      state.expressions = trimExpressions(state.expressions);
      state.lastExpressionAt = now;
      record.lastExpressionAt = now;
      return {...result, status: 'expression_proposed', expression: structuredClone(proposal), sent: false};
    });
  }

  takeExpression(id, context = {}) {
    if (this.closed) return null;
    if (this.store.read().expressions.some(item => item.id === id && item.origin === 'solitude')) {
      return takeContact(this, id, context);
    }
    const current = situation({...context, trigger: context?.trigger || 'idle'}, this.config);
    if (current.skip || current.busy || current.userAwaitingReply || !current.allowExpression) return null;
    return this.store.transaction(state => {
      if (state.paused) return null;
      const proposal = state.expressions.find(item => item.id === id && item.status === 'pending');
      if (!proposal) return null;
      const record = state.episodes.find(item => item.id === proposal.memoryId && item.revision === proposal.revision);
      const view = record && memoryView(record, this.config, this.now());
      if (this.now() >= proposal.expiresAt || !view || view.detail !== proposal.detail) {
        proposal.status = 'expired_or_stale';
        proposal.text = '';
        return null;
      }
      proposal.status = 'consumed';
      return {...proposal, sent: false, purpose: 'optional_character_expression'};
    });
  }

  solitude(context, options) {
    return solitude(this, context, options);
  }

  settleExpression(id, result) {
    return settleContact(this, id, result);
  }

  async close() {
    this.closed = true;
    this.controller?.abort(stopped());
    if (this.running) await this.running;
  }
}
