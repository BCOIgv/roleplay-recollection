import {CompanionMemory} from 'roleplay-recollection';

const output = {
  schema: {type: 'object', additionalProperties: true},
  render: (_args, value) => [{type: 'text', text: JSON.stringify(value, null, 2)}],
};

const tool = (name, description, parameters, execute) => ({name, description, parameters, output, execute});

const captureContext = config => ({
  mode: config.mode,
  ...(config.storyId ? {storyId: config.storyId} : {}),
});

const situation = (config, args = {}) => ({
  mode: config.mode,
  ...(config.storyId ? {storyId: config.storyId} : {}),
  trigger: args.trigger ?? 'idle',
  cue: args.cue ?? '',
  moodTags: args.moodTags ?? [],
  allowExpression: args.allowExpression === true,
  busy: args.busy === true,
  userAwaitingReply: args.userAwaitingReply === true,
  hasPendingWork: args.hasPendingWork === true,
  ...(args.lastInteractionAt !== undefined ? {lastInteractionAt: args.lastInteractionAt} : {}),
  ...(args.lastUserReplyAt !== undefined ? {lastUserReplyAt: args.lastUserReplyAt} : {}),
  ...(args.delivery !== undefined ? {delivery: args.delivery} : {}),
  ...(args.replyToMessageId !== undefined ? {replyToMessageId: args.replyToMessageId} : {}),
});

const evidenceSchema = {
  type: 'array',
  minItems: 1,
  maxItems: 3,
  items: {
    type: 'object',
    properties: {
      id: {type: 'string'},
      kind: {type: 'string', enum: ['shared_event', 'media_observation', 'user_message', 'story_event']},
      text: {type: 'string'},
    },
    required: ['id', 'kind', 'text'],
    additionalProperties: false,
  },
};

const captureSchema = {
  type: 'object',
  properties: {
    id: {type: 'string'},
    truth: {type: 'string', enum: ['observed', 'reported', 'fictional']},
    occurredAt: {type: 'integer'},
    gist: {type: 'string'},
    evidence: evidenceSchema,
    tags: {type: 'array', items: {type: 'string'}, maxItems: 8},
    importance: {type: 'number'},
    emotionalWeight: {type: 'number'},
    retention: {type: 'string', enum: ['ordinary', 'explicitly_retained']},
    retentionReason: {type: 'string'},
  },
  required: ['id', 'truth', 'occurredAt', 'gist', 'evidence'],
  additionalProperties: false,
};

const situationProperties = {
  trigger: {type: 'string', enum: ['cue', 'idle']},
  cue: {type: 'string'},
  moodTags: {type: 'array', items: {type: 'string'}},
  allowExpression: {type: 'boolean'},
  busy: {type: 'boolean'},
  userAwaitingReply: {type: 'boolean'},
  hasPendingWork: {type: 'boolean'},
  lastInteractionAt: {type: 'integer'},
  lastUserReplyAt: {type: 'integer'},
  delivery: {type: 'string', enum: ['reply', 'proactive']},
  replyToMessageId: {type: 'string'},
};

export const inject = ['tools'];

export function apply(ctx, config = {}) {
  const {
    characterId = 'default',
    scopeId = 'default',
    mode = 'companion',
    storyId,
    persona,
    stateDir,
    ...settings
  } = config;
  const core = new CompanionMemory({
    characterId,
    scopeId,
    mode,
    ...(storyId !== undefined ? {storyId} : {}),
    ...(persona !== undefined ? {persona} : {}),
    ...(stateDir !== undefined ? {stateDir} : {}),
    ...settings,
  });

  const definitions = [
    tool('roleplay_recollection_status', 'Return the current roleplay memory status, budgets and pending candidates.',
      {type: 'object', properties: {}, additionalProperties: false},
      () => core.status()),

    tool('roleplay_recollection_capture', 'Store one source-backed experience. The current configured character, scope and mode are used automatically.',
      captureSchema,
      args => core.capture({...args, ...(config.storyId ? {storyId: config.storyId} : {})}, captureContext(config))),

    tool('roleplay_recollection_visible', 'Return a few currently visible memories for an existing chat reply. This never calls a model.',
      {type: 'object', properties: situationProperties, additionalProperties: false},
      args => core.visible(situation(config, args))),

    tool('roleplay_recollection_private_thoughts', 'Return recent tentative private thoughts that are still compatible with the current memory detail.',
      {type: 'object', properties: situationProperties, additionalProperties: false},
      args => core.privateThoughts(situation(config, args))),

    tool('roleplay_recollection_recollect', 'Return a cue-triggered recollection candidate. Without a model adapter this returns the top visible memory and no expression.',
      {
        type: 'object',
        properties: {
          trigger: {type: 'string', enum: ['cue']},
          cue: {type: 'string'},
          opportunityId: {type: 'string'},
          moodTags: {type: 'array', items: {type: 'string'}},
          allowExpression: {type: 'boolean'},
        },
        required: ['cue', 'opportunityId'],
        additionalProperties: false,
      },
      (args, exec) => core.recollect({
        ...situation(config, {...args, trigger: 'cue'}),
        opportunityId: args.opportunityId,
      }, {signal: exec.signal})),

    tool('roleplay_recollection_revise', 'Revise an existing experience using its current revision.',
      {
        type: 'object',
        properties: {
          id: {type: 'string'},
          expectedRevision: {type: 'string'},
          raw: {type: 'object', additionalProperties: true},
        },
        required: ['id', 'expectedRevision', 'raw'],
        additionalProperties: false,
      },
      args => core.revise(args.id, args.expectedRevision, {
        ...args.raw,
        ...(config.storyId ? {storyId: config.storyId} : {}),
      })),

    tool('roleplay_recollection_forget', 'Withdraw an experience and remove its derived thoughts and candidates.',
      {type: 'object', properties: {id: {type: 'string'}}, required: ['id'], additionalProperties: false},
      args => core.forget(args.id)),

    tool('roleplay_recollection_set_source_available', 'Mark whether an experience source is still available for recall.',
      {
        type: 'object',
        properties: {id: {type: 'string'}, available: {type: 'boolean'}},
        required: ['id', 'available'],
        additionalProperties: false,
      },
      args => { core.setSourceAvailable(args.id, args.available); return {ok: true}; }),

    tool('roleplay_recollection_pause', 'Pause or resume optional memory work.',
      {type: 'object', properties: {value: {type: 'boolean'}}, additionalProperties: false},
      args => core.pause(args.value ?? true)),

    tool('roleplay_recollection_take_expression', 'Take an existing expression candidate. It is still not sent.',
      {
        type: 'object',
        properties: {id: {type: 'string'}, ...situationProperties},
        required: ['id'],
        additionalProperties: false,
      },
      args => core.takeExpression(args.id, situation(config, args))),

    tool('roleplay_recollection_settle_expression', 'Reconcile a solitude contact candidate with a real delivery outcome.',
      {
        type: 'object',
        properties: {
          id: {type: 'string'},
          outcome: {type: 'string', enum: ['sent', 'used_in_reply', 'not_sent', 'unknown']},
          receipt: {type: 'string'},
        },
        required: ['id', 'outcome'],
        additionalProperties: false,
      },
      args => core.settleExpression(args.id, {outcome: args.outcome, receipt: args.receipt})),
  ];

  ctx.effect(() => {
    const disposers = definitions.map(definition => ctx.tools.register(definition));
    return () => {
      for (const dispose of disposers) dispose();
      void core.close();
    };
  });
}
