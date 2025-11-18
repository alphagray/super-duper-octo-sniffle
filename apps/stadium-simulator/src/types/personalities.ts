/**
 * Personality Type System for AI-Generated Content
 * 
 * Comprehensive TypeScript interfaces for all AI-powered game personalities:
 * - Vendors: Concession stand workers with unique dialogue and behavior
 * - Mascots: Stadium mascots with special abilities and catchphrases
 * - Announcers: Play-by-play commentators with dynamic reactions
 * 
 * Each personality type includes metadata for cost tracking, content freshness,
 * and epoch-based variation.
 */

/**
 * Base personality trait
 * 
 * Represents a single characteristic or behavioral tendency of a personality.
 * Traits combine to create unique, memorable characters.
 */
export interface PersonalityTrait {
  /** Unique identifier for the trait */
  id: string;
  /** Human-readable trait name */
  name: string;
  /** Detailed description of the trait */
  description: string;
  /** Intensity level (0-1, where 1 is maximum) */
  intensity: number;
  /** Tags for categorization and filtering */
  tags: string[];
}

/**
 * Dialogue line configuration
 * 
 * Represents a single piece of dialogue that can be spoken by a character.
 * Includes context conditions and variation metadata.
 */
export interface DialogueLine {
  /** Unique identifier for the dialogue */
  id: string;
  /** The dialogue text */
  text: string;
  /** Context when this dialogue should be used */
  context: DialogueContext;
  /** Emotional tone of the dialogue */
  emotion: EmotionType;
  /** Priority for selection (higher = more likely to be chosen) */
  priority: number;
  /** Minimum cooldown before this dialogue can be used again (milliseconds) */
  cooldown: number;
  /** Optional animation or gesture to accompany dialogue */
  animation?: string;
  /** Optional sound effect identifier */
  soundEffect?: string;
}

/**
 * Context for dialogue selection
 * 
 * Defines the game state conditions under which dialogue is appropriate.
 */
export interface DialogueContext {
  /** Event type that triggers this dialogue */
  event: GameEventType;
  /** Required minimum happiness level (0-100) */
  minHappiness?: number;
  /** Required maximum happiness level (0-100) */
  maxHappiness?: number;
  /** Required minimum thirst level (0-100) */
  minThirst?: number;
  /** Required maximum thirst level (0-100) */
  maxThirst?: number;
  /** Required minimum attention level (0-100) */
  minAttention?: number;
  /** Required maximum attention level (0-100) */
  maxAttention?: number;
  /** Required score range */
  scoreRange?: [number, number];
  /** Wave state requirements */
  waveState?: 'active' | 'inactive' | 'countdown';
}

/**
 * Game event types that trigger AI content
 */
export type GameEventType =
  | 'waveStart'
  | 'waveComplete'
  | 'sectionSuccess'
  | 'sectionFail'
  | 'vendorServe'
  | 'mascotActivate'
  | 'sessionStart'
  | 'sessionEnd'
  | 'highScore'
  | 'lowScore'
  | 'fanHappy'
  | 'fanThirsty'
  | 'fanBored';

/**
 * Emotional tone types for dialogue
 */
export type EmotionType =
  | 'excited'
  | 'disappointed'
  | 'encouraging'
  | 'frustrated'
  | 'celebratory'
  | 'sarcastic'
  | 'neutral'
  | 'urgent'
  | 'playful';

/**
 * Vendor personality configuration
 * 
 * Defines the behavior, dialogue, and characteristics of a stadium vendor.
 * Vendors serve refreshments to fans, affecting thirst and happiness levels.
 */
export interface VendorPersonality {
  /** Unique identifier for the vendor personality */
  id: string;
  /** Human-readable name */
  name: string;
  /** Brief description of the vendor's personality */
  description: string;
  /** Type of refreshments this vendor sells */
  productType: VendorProductType;
  /** Personality traits that define behavior */
  traits: PersonalityTrait[];
  /** Available dialogue lines */
  dialogue: DialogueLine[];
  /** Movement behavior configuration */
  movement: VendorMovementConfig;
  /** Visual appearance configuration */
  appearance: AppearanceConfig;
  /** Content metadata */
  metadata: ContentMetadata;
}

/**
 * Types of products vendors can sell
 */
export type VendorProductType = 'drinks' | 'snacks' | 'merchandise' | 'mixed';

/**
 * Vendor movement behavior configuration
 */
export interface VendorMovementConfig {
  /** Base movement speed (pixels per second) */
  speed: number;
  /** Pause duration at each section (milliseconds) */
  pauseDuration: number;
  /** Preference for certain sections (section IDs to weight multiplier) */
  sectionPreferences: Record<string, number>;
  /** Whether vendor avoids active wave sections */
  avoidsActiveWave: boolean;
}

/**
 * Mascot personality configuration
 * 
 * Defines the behavior, special abilities, and characteristics of a stadium mascot.
 * Mascots boost crowd engagement with special abilities and entertaining antics.
 */
export interface MascotPersonality {
  /** Unique identifier for the mascot personality */
  id: string;
  /** Human-readable name */
  name: string;
  /** Brief description of the mascot's personality */
  description: string;
  /** Mascot type/theme */
  theme: MascotTheme;
  /** Personality traits that define behavior */
  traits: PersonalityTrait[];
  /** Available dialogue lines */
  dialogue: DialogueLine[];
  /** Special abilities configuration */
  abilities: MascotAbility[];
  /** Appearance and animation configuration */
  appearance: AppearanceConfig;
  /** Content metadata */
  metadata: ContentMetadata;
}

/**
 * Mascot theme types
 */
export type MascotTheme = 'animal' | 'object' | 'character' | 'abstract' | 'sports';

/**
 * Mascot special ability configuration
 */
export interface MascotAbility {
  /** Unique identifier for the ability */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what the ability does */
  description: string;
  /** Cooldown duration (milliseconds) */
  cooldown: number;
  /** Duration of ability effect (milliseconds) */
  duration: number;
  /** Stat effects applied when ability is active */
  effects: AbilityEffect[];
  /** Visual effect identifier */
  visualEffect?: string;
  /** Sound effect identifier */
  soundEffect?: string;
  /** Animation identifier */
  animation?: string;
}

/**
 * Stat effect from mascot ability
 */
export interface AbilityEffect {
  /** Stat to affect */
  stat: 'happiness' | 'thirst' | 'attention' | 'waveStrength';
  /** Type of modification */
  type: 'add' | 'multiply' | 'set';
  /** Value to apply */
  value: number;
  /** Target scope */
  target: 'section' | 'allSections' | 'activeFans';
}

/**
 * Announcer content configuration
 * 
 * Defines the commentary style, dialogue, and reactions of the stadium announcer.
 * Announcers provide play-by-play commentary and energize the crowd.
 */
export interface AnnouncerContent {
  /** Unique identifier for the announcer personality */
  id: string;
  /** Human-readable name */
  name: string;
  /** Brief description of the announcer's style */
  description: string;
  /** Commentary style */
  style: AnnouncerStyle;
  /** Personality traits that define commentary */
  traits: PersonalityTrait[];
  /** Available dialogue/commentary lines */
  commentary: DialogueLine[];
  /** Catchphrases for special moments */
  catchphrases: Catchphrase[];
  /** Content metadata */
  metadata: ContentMetadata;
}

/**
 * Announcer commentary style
 */
export type AnnouncerStyle =
  | 'classic' // Traditional sports announcer
  | 'energetic' // High-energy, NBA Jam style
  | 'sarcastic' // Dry wit and sarcasm
  | 'professional' // Serious, measured tone
  | 'casual'; // Friendly, conversational

/**
 * Announcer catchphrase configuration
 */
export interface Catchphrase {
  /** Unique identifier */
  id: string;
  /** The catchphrase text */
  text: string;
  /** Trigger condition */
  trigger: CatchphraseTrigger;
  /** Rarity (0-1, where 1 is very rare) */
  rarity: number;
  /** Optional audio clip identifier */
  audioClip?: string;
}

/**
 * Catchphrase trigger conditions
 */
export interface CatchphraseTrigger {
  /** Event that triggers the catchphrase */
  event: GameEventType;
  /** Additional conditions */
  conditions?: {
    /** Minimum score required */
    minScore?: number;
    /** Minimum multiplier required */
    minMultiplier?: number;
    /** Consecutive successes required */
    consecutiveSuccesses?: number;
    /** Perfect wave (all sections succeeded) */
    perfectWave?: boolean;
  };
}

/**
 * Visual appearance configuration
 * 
 * Defines how a character looks in the game.
 */
export interface AppearanceConfig {
  /** Sprite sheet identifier */
  spriteSheet: string;
  /** Animation set identifier */
  animations: string[];
  /** Color palette (hex colors) */
  colorPalette: string[];
  /** Scale factor for rendering */
  scale: number;
  /** Optional costume/outfit variations */
  costumes?: CostumeVariation[];
}

/**
 * Costume variation for special occasions
 */
export interface CostumeVariation {
  /** Unique identifier */
  id: string;
  /** Costume name */
  name: string;
  /** When this costume is worn */
  occasion: 'default' | 'special' | 'seasonal' | 'achievement';
  /** Alternative sprite sheet */
  spriteSheet: string;
  /** Alternative color palette */
  colorPalette?: string[];
}

/**
 * Crowd chatter line
 * 
 * Short crowd reactions and comments that add atmosphere to the game.
 */
export interface CrowdChatter {
  /** Unique identifier */
  id: string;
  /** The chatter text */
  text: string;
  /** Emotional tone */
  emotion: EmotionType;
  /** Tags for categorization */
  tags: string[];
  /** Priority for selection */
  priority: number;
  /** Minimum cooldown before reuse (milliseconds) */
  cooldown: number;
}

/**
 * Game AI content collection
 * 
 * Top-level container for all AI-generated personalities and content.
 * Includes metadata for tracking, versioning, and cost management.
 */
export interface GameAIContent {
  /** Content version identifier */
  version: string;
  /** Epoch number this content was generated for */
  epoch: number;
  /** Timestamp when content was generated */
  generatedAt: number;
  /** Environment where content was generated */
  environment: 'development' | 'production';
  /** All vendor personalities */
  vendors: VendorPersonality[];
  /** All mascot personalities */
  mascots: MascotPersonality[];
  /** All announcer content sets */
  announcers: AnnouncerContent[];
  /** Crowd chatter variations (optional) */
  crowdChatter?: CrowdChatter[];
  /** Aggregate metadata for the entire content set */
  metadata: ContentSetMetadata;
}

/**
 * Content metadata for individual personality/content piece
 * 
 * Tracks generation details, cost, and quality metrics for a single content item.
 */
export interface ContentMetadata {
  /** AI model used for generation */
  model: string;
  /** Temperature setting used (0-1) */
  temperature: number;
  /** Number of tokens in the prompt */
  promptTokens: number;
  /** Number of tokens in the response */
  completionTokens: number;
  /** Total cost of generation (in cents) */
  cost: number;
  /** Timestamp when content was generated */
  generatedAt: number;
  /** Epoch number when content was generated */
  epoch: number;
  /** Content quality score (0-1, from validation/review) */
  qualityScore?: number;
  /** Number of times this content has been used */
  usageCount: number;
  /** Last time this content was used */
  lastUsedAt?: number;
}

/**
 * Metadata for an entire content set
 * 
 * Aggregate statistics for a complete AI content generation session.
 */
export interface ContentSetMetadata {
  /** Total number of content items generated */
  totalItems: number;
  /** Total cost of generating all content (in cents) */
  totalCost: number;
  /** Total tokens used (prompt + completion) */
  totalTokens: number;
  /** Time taken to generate all content (milliseconds) */
  generationTime: number;
  /** Average quality score across all items */
  averageQualityScore?: number;
  /** Content set status */
  status: 'generating' | 'complete' | 'error' | 'cached';
  /** Any errors encountered during generation */
  errors?: ContentGenerationError[];
}

/**
 * Content generation error
 */
export interface ContentGenerationError {
  /** Error type */
  type: 'network' | 'validation' | 'api' | 'timeout' | 'budget';
  /** Error message */
  message: string;
  /** Timestamp when error occurred */
  timestamp: number;
  /** Which content item failed (if applicable) */
  contentId?: string;
  /** Whether error is recoverable */
  recoverable: boolean;
}

/**
 * Content cache entry
 * 
 * For storing and retrieving previously generated content to reduce API costs.
 */
export interface ContentCacheEntry {
  /** Cache key (typically epoch number + environment) */
  key: string;
  /** Cached content */
  content: GameAIContent;
  /** When this entry was cached */
  cachedAt: number;
  /** When this entry expires (timestamp) */
  expiresAt: number;
  /** Number of times this cache entry has been accessed */
  accessCount: number;
  /** Last time this cache entry was accessed */
  lastAccessedAt?: number;
}
