/**
 * Type definitions for roleplay-recollection 0.3.0.
 *
 * The runtime is plain ESM and has no dependencies. These declarations describe
 * the public surface only; the persisted state format is internal and may grow
 * in compatible ways.
 */

export type Mode = 'companion' | 'roleplay';
export type InteractionMode = Mode | 'task';
export type Trigger = 'cue' | 'idle';
export type Truth = 'observed' | 'reported' | 'fictional';
export type EvidenceKind = 'shared_event' | 'media_observation' | 'user_message' | 'story_event';
export type Detail = 'specific' | 'impression';
export type TimeSense = 'recently' | 'a_while_ago' | 'some_time_ago';
export type Retention = 'ordinary' | 'explicitly_retained';
export type ContactOutcome = 'sent' | 'used_in_reply' | 'not_sent' | 'unknown';
export type WanderAction = 'leave' | 'linger' | 'follow' | 'switch';
export type RecollectionAction = 'silence' | 'keep' | 'express';

export interface CoreSettings {
  recallIntervalHours: number;
  maxCandidates: number;
  minimumSalience: number;
  detailThreshold: number;
  dormantThreshold: number;
  dailyModelCalls: number;
  modelTimeoutMs: number;
  maxOutputTokens: number;
  expressionIntervalHours: number;
  sameMemoryExpressionDays: number;
  maxEpisodes: number;
  maxThoughts: number;
  solitudeIntervalHours: [number, number];
  growthThreshold: [number, number];
  growthDelayHours: [number, number];
  minimumSolitudeHours: number;
  inactivityMinutes: number;
  activityHours: [number, number];
  maxWanderSteps: number;
  memoriesPerStep: number;
  solitudeMinutes: number;
  unansweredContactHours: number;
}

export declare const DEFAULTS: Readonly<CoreSettings>;
export declare const VERSION: string;

export interface CompanionOptions extends Partial<CoreSettings> {
  characterId: string;
  scopeId: string;
  mode: Mode;
  storyId?: string | null;
  persona?: string;
  stateDir?: string;
}

export type ResolvedConfig = Readonly<CoreSettings & {
  characterId: string;
  scopeId: string;
  mode: Mode;
  storyId: string | null;
  persona: string;
}>;

export interface EvidenceInput {
  id: string;
  kind: EvidenceKind;
  text: string;
}

export interface EpisodeInput {
  id: string;
  truth: Truth;
  occurredAt: number;
  gist: string;
  evidence: EvidenceInput[];
  tags?: string[];
  importance?: number;
  emotionalWeight?: number;
  retention?: Retention;
  retentionReason?: string;
  storyId?: string | null;
}

export interface CaptureContext {
  mode: InteractionMode;
  storyId?: string | null;
}

export interface Situation {
  mode: InteractionMode;
  storyId?: string | null;
  trigger?: Trigger;
  cue?: string;
  moodTags?: string[];
  allowExpression?: boolean;
  busy?: boolean;
  userAwaitingReply?: boolean;
  hasPendingWork?: boolean;
  opportunityId?: string;
  lastInteractionAt?: number;
  lastUserReplyAt?: number;
  delivery?: 'reply' | 'proactive';
  replyToMessageId?: string;
}

export interface MemoryView {
  id: string;
  revision: string;
  truth: Truth;
  storyId: string | null;
  gist: string;
  detail: Detail;
  activation: number;
  evidence: EvidenceInput[];
  occurredAt?: number;
  timeSense: TimeSense;
  tags: string[];
  salienceScore?: number;
  reason?: {
    cueMatch: number;
    moodAssociation: boolean;
    recentlyRecalled: boolean;
  };
}

export interface PrivateThought {
  id: string;
  memoryId: string;
  revision: string;
  at: number;
  detail: Detail;
  text: string;
  anchor: string;
  truth: 'tentative_reflection';
  status: 'tentative_character_thought';
  usableAsEvidence: false;
}

export interface ExpressionCandidate {
  id: string;
  memoryId: string;
  revision: string;
  detail: Detail;
  truth: Truth;
  storyId: string | null;
  text: string;
  anchor: string;
  at: number;
  expiresAt: number;
  status: string;
  scopeId: string;
  characterId: string;
  origin?: 'solitude';
  delivery?: 'reply' | 'proactive';
  sent: false;
  purpose?: 'optional_character_expression';
}

export interface CaptureResult {
  stored: boolean;
  id?: string;
  revision?: string;
  duplicate?: boolean;
  reason?: string;
}

export interface ReviseResult {
  revised: true;
  id: string;
  revision: string;
}

export interface ForgetResult {
  forgotten: boolean;
  id?: string;
}

export interface RunRecord {
  opportunityId: string;
  at: number;
  status: string;
  memoryId?: string;
}

export interface SolitudeStatus {
  active: boolean;
  nextAt: number;
  reason: string;
  threshold: number;
  lastEndedAt: number;
  lastContactAt: number | null;
  pending: Array<{id: string; status: string; expiresAt: number}>;
  history: Array<Record<string, unknown>>;
}

export interface CoreStatus {
  version: string;
  characterId: string;
  scopeId: string;
  mode: Mode;
  storyId: string | null;
  paused: boolean;
  closed: boolean;
  episodes: number;
  specific: number;
  impressions: number;
  dormant: number;
  privateThoughts: number;
  pendingExpressions: number;
  modelCallsToday: number;
  dailyModelCalls: number;
  lastRecallOpportunityAt: number | null;
  lastExpressionProposedAt: number | null;
  latest: RunRecord[];
  solitude: SolitudeStatus;
}

export interface ModelRequest {
  system: string;
  input: Record<string, unknown>;
  maxTokens: number;
  signal: AbortSignal;
  phase?: 'solitude';
}

export interface ModelResponse {
  value: unknown;
}

export type ModelHook = (request: ModelRequest) => ModelResponse | Promise<ModelResponse>;

export interface CompanionHooks {
  reflect?: ModelHook | null;
  wander?: ModelHook | null;
  now?: () => number;
  random?: () => number;
}

export interface SkippedResult {
  status: 'skipped';
  reason: string;
  modelCalls: 0;
}

export interface InterruptedResult {
  status: 'interrupted' | 'failed';
  reason?: string;
  modelCalls: number;
}

export interface RecalledResult {
  status: 'recalled';
  memory: MemoryView;
  expression: null;
  modelCalls: 0;
}

export interface CommittedResult {
  status: 'silence' | 'kept' | 'expression_proposed';
  modelCalls: number;
  memoryId?: string;
  thoughtId?: string | null;
  expression?: ExpressionCandidate | null;
  expressionSuppressed?: string;
  sent?: false;
}

export type RecollectionResult = SkippedResult | InterruptedResult | RecalledResult | CommittedResult;

export interface SolitudeEnded {
  status: 'solitude_ended';
  reason: string;
  modelCalls: number;
  visited: string[];
  intentId: string | null;
  sent: false;
}

export type SolitudeResult = SkippedResult | InterruptedResult | SolitudeEnded;

export interface SettlementResult {
  id: string;
  status: ContactOutcome;
  sent?: boolean;
}

export declare class CompanionMemory {
  constructor(input: CompanionOptions, hooks?: CompanionHooks);

  readonly config: ResolvedConfig;
  readonly identity: Readonly<{
    characterId: string;
    scopeId: string;
    mode: Mode;
    storyId: string | null;
  }>;

  status(): CoreStatus;
  capture(raw: EpisodeInput | null, context: CaptureContext): CaptureResult;
  revise(id: string, expectedRevision: string, raw: Omit<EpisodeInput, 'id'> & {id?: string}): ReviseResult;
  forget(id: string): ForgetResult;
  setSourceAvailable(id: string, available: boolean): void;
  pause(value?: boolean): {paused: boolean};
  visible(context: Situation): MemoryView[];
  privateThoughts(context: Situation): PrivateThought[];
  recollect(context: Situation, options?: {signal?: AbortSignal}): Promise<RecollectionResult>;
  takeExpression(id: string, context: Situation): ExpressionCandidate | null;
  solitude(context: Situation, options?: {signal?: AbortSignal}): Promise<SolitudeResult>;
  settleExpression(id: string, result: {outcome: ContactOutcome; receipt?: string}): SettlementResult;
  close(): Promise<void>;
}

export declare function memoryView(
  record: Record<string, unknown>,
  config: ResolvedConfig,
  now: number,
): MemoryView | null;
