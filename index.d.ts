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

/** Explicit read-only file sources. Paths are supplied by trusted host configuration. */
export interface MemorySourceConfig {
  id: string;
  file: string;
  format: 'native-v2' | 'json' | 'jsonl' | 'sqlite';
  collection?: string;
  fields?: Partial<Record<'id' | 'text' | 'scope' | 'time' | 'truth' | 'status' | 'storyId', string>>;
  timeUnit?: 'seconds' | 'milliseconds' | 'iso';
  maxBytes?: number;
  nativePolicy?: {detailThreshold?: number; dormantThreshold?: number};
  rp?: {enabled: boolean; textField?: string; detail?: Detail};
  statusMap?: Record<string, MemoryMaterial['status']>;
  truthMap?: Record<string, MemoryMaterial['truth']>;
  schemaFingerprint?: string;
  maxRecords?: number;
}
export interface MemoryMaterial {
  detail?: Detail;
  ref: string;
  sourceId: string;
  originalId: string;
  sourceScope: string | null;
  storyId: string | null;
  characterId: string | null;
  truth: Truth | 'unknown';
  status: 'active' | 'archived' | 'withdrawn' | 'unavailable' | 'unknown';
  text: string | null;
  eventAt: number | null;
  revision: string;
  snapshotId: string;
  rp?: {text: string; detail: Detail; evidence: EvidenceInput[]} | null;
}
export interface MemorySourceSnapshot {
  sourceId: string;
  snapshotId: string;
  asOf: number;
  consistency: 'file-version' | 'transaction';
  schemaFingerprint: string;
  scanned: number;
  materials: MemoryMaterial[];
}
export declare function validateSourceConfig(input: MemorySourceConfig): MemorySourceConfig;
export declare class ReadOnlyMemorySource {
  constructor(config: MemorySourceConfig);
  readonly id: string;
  readonly config: MemorySourceConfig;
  snapshot(options?: {now?: number}): MemorySourceSnapshot;
}
export interface MemoryAccessRequest {
  context: unknown;
  purpose: 'admin' | 'rp';
  sourceId: string;
  material?: MemoryMaterial;
}
export interface GlobalMemoryResult {
  scope: 'admin-global';
  items: MemoryMaterial[];
  matched: number;
  truncated: boolean;
  sourceCoverage: 'complete' | 'partial';
  nextCursor: string | null;
  sourceResults: Array<{sourceId: string; status: 'ok' | 'denied' | 'failed'; snapshotId?: string; scanned?: number; reason?: string}>;
}
export declare class GlobalMemoryLibrary {
  assertRuntimeDirectory(directory: string): string;
  replaceSource(config: MemorySourceConfig): void;
  resolve(references: Array<{ref: string; revision: string; detail?: Detail; text: string}>, options?: {context?: unknown; now?: number}): Promise<boolean>;
  constructor(options: {sources: MemorySourceConfig[]; unavailableSources?: Array<{id: string; reason?: string}>; authorize: (request: MemoryAccessRequest) => boolean | Promise<boolean>});
  query(options?: {query?: string; limit?: number; purpose?: 'admin' | 'rp'; context?: unknown; now?: number; cursor?: string | null}): Promise<GlobalMemoryResult>;
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
  recollect(context: Situation, options?: {signal?: AbortSignal}): Promise<RecollectionResult | SolitudeResult>;
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


export const INITIALIZATION_PROMPT: string;
export type SourceRegistration = Omit<MemorySourceConfig, 'format'> & {format: MemorySourceConfig['format'] | 'auto'};
export interface SourceSetupResult {
  sources: MemorySourceConfig[];
  results: Array<{id: string; status: 'active' | 'pending' | 'failed'; records?: number; schemaFingerprint?: string; reason?: string}>;
  modelCalls: number;
  configurationDigest: string;
}
export declare function describeSource(source: SourceRegistration): Record<string, unknown>;
export declare function initializeMemorySources(options: {sources: SourceRegistration[]; model?: ModelHook | null; configDirectory?: string; signal?: AbortSignal; timeoutMs?: number}): Promise<SourceSetupResult>;
export interface GlobalRunResult {
  status: 'skipped' | 'interrupted' | 'failed' | 'silence' | 'recalled' | 'kept' | 'expression_proposed' | 'solitude_ended';
  reason?: string;
  modelCalls: number;
  intentId?: string | null;
  memories?: MemoryMaterial[];
  sent?: false;
  sourceResults?: GlobalMemoryResult['sourceResults'];
}
export interface GlobalVisibleResult {scope: 'admin-global'; items: MemoryMaterial[]; sourceResults: GlobalMemoryResult['sourceResults']; partial?: boolean}
export interface GlobalRuntimeOptions {access?: unknown; signal?: AbortSignal}
export declare class GlobalRecollection {
  constructor(input: Omit<CompanionOptions, 'scopeId'>, hooks: CompanionHooks & {library: GlobalMemoryLibrary; contextKey: (access: unknown) => string | null});
  readonly config: ResolvedConfig;
  visible(context: Situation, options?: GlobalRuntimeOptions): Promise<GlobalVisibleResult>;
  refresh(options?: GlobalRuntimeOptions): Promise<{items: MemoryMaterial[]; sourceResults: GlobalMemoryResult['sourceResults']; partial: boolean}>;
  recollect(context: Situation, options?: GlobalRuntimeOptions): Promise<GlobalRunResult>;
  solitude(context: Situation, options?: GlobalRuntimeOptions): Promise<GlobalRunResult>;
  privateThoughts(context: Situation, options?: GlobalRuntimeOptions): Promise<Array<{text: string; usableAsEvidence: false}>>;
  takeExpression(id: string, context: Situation, options?: GlobalRuntimeOptions): Promise<{id: string; text: string; sent: false} | null>;
  settleExpression(id: string, result: {outcome: ContactOutcome; receipt?: string}, options?: GlobalRuntimeOptions): {id: string; status: ContactOutcome};
  status(): {scope: 'admin-global'; paused: boolean; closed: boolean; modelCallsToday: number; nextAt: number; lastContactAt: number | null; pending: Array<{id: string; status: string}>};
  pause(value?: boolean): {paused: boolean};
  close(): Promise<void>;
}
