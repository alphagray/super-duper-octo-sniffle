/**
 * Content Validator
 * 
 * Validates AI-generated personality content to ensure it matches expected types
 * and contains all required fields. Prevents malformed or malicious content from
 * being stored or used in the game.
 */

import type {
  GameAIContent,
  VendorPersonality,
  MascotPersonality,
  AnnouncerContent,
  PersonalityTrait,
  DialogueLine,
  DialogueContext,
  GameEventType,
  EmotionType,
  VendorProductType,
  MascotTheme,
  MascotAbility,
  AppearanceConfig,
  ContentMetadata
} from '../../src/types/personalities';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate personality trait structure
 */
function validatePersonalityTrait(trait: any, path: string): string[] {
  const errors: string[] = [];
  
  if (!trait || typeof trait !== 'object') {
    errors.push(`${path}: Trait must be an object`);
    return errors;
  }
  
  if (!trait.id || typeof trait.id !== 'string') {
    errors.push(`${path}: Trait must have string id`);
  }
  
  if (!trait.name || typeof trait.name !== 'string') {
    errors.push(`${path}: Trait must have string name`);
  }
  
  if (!trait.description || typeof trait.description !== 'string') {
    errors.push(`${path}: Trait must have string description`);
  }
  
  if (typeof trait.intensity !== 'number' || trait.intensity < 0 || trait.intensity > 1) {
    errors.push(`${path}: Trait intensity must be number between 0 and 1`);
  }
  
  if (!Array.isArray(trait.tags)) {
    errors.push(`${path}: Trait tags must be an array`);
  }
  
  return errors;
}

/**
 * Validate dialogue context
 */
function validateDialogueContext(context: any, path: string): string[] {
  const errors: string[] = [];
  
  if (!context || typeof context !== 'object') {
    errors.push(`${path}: Context must be an object`);
    return errors;
  }
  
  const validEvents: GameEventType[] = [
    'waveStart', 'waveComplete', 'sectionSuccess', 'sectionFail',
    'vendorServe', 'mascotActivate', 'sessionStart', 'sessionEnd',
    'highScore', 'lowScore', 'fanHappy', 'fanThirsty', 'fanBored'
  ];
  
  if (!validEvents.includes(context.event)) {
    errors.push(`${path}: Invalid event type "${context.event}"`);
  }
  
  // Optional numeric ranges
  const numericFields = ['minHappiness', 'maxHappiness', 'minThirst', 'maxThirst', 'minAttention', 'maxAttention'];
  for (const field of numericFields) {
    if (context[field] !== undefined) {
      if (typeof context[field] !== 'number' || context[field] < 0 || context[field] > 100) {
        errors.push(`${path}.${field}: Must be number between 0 and 100`);
      }
    }
  }
  
  return errors;
}

/**
 * Validate dialogue line
 */
function validateDialogueLine(dialogue: any, path: string): string[] {
  const errors: string[] = [];
  
  if (!dialogue || typeof dialogue !== 'object') {
    errors.push(`${path}: Dialogue must be an object`);
    return errors;
  }
  
  if (!dialogue.id || typeof dialogue.id !== 'string') {
    errors.push(`${path}: Dialogue must have string id`);
  }
  
  if (!dialogue.text || typeof dialogue.text !== 'string') {
    errors.push(`${path}: Dialogue must have string text`);
  } else if (dialogue.text.split(' ').length > 25) {
    errors.push(`${path}: Dialogue text too long (max 25 words)`);
  }
  
  if (!dialogue.context) {
    errors.push(`${path}: Dialogue must have context`);
  } else {
    errors.push(...validateDialogueContext(dialogue.context, `${path}.context`));
  }
  
  const validEmotions: EmotionType[] = [
    'excited', 'disappointed', 'encouraging', 'frustrated',
    'celebratory', 'sarcastic', 'neutral', 'urgent', 'playful'
  ];
  
  if (!validEmotions.includes(dialogue.emotion)) {
    errors.push(`${path}: Invalid emotion type "${dialogue.emotion}"`);
  }
  
  if (typeof dialogue.priority !== 'number' || dialogue.priority < 0 || dialogue.priority > 100) {
    errors.push(`${path}.priority: Must be number between 0 and 100`);
  }
  
  if (typeof dialogue.cooldown !== 'number' || dialogue.cooldown < 0) {
    errors.push(`${path}.cooldown: Must be non-negative number`);
  }
  
  return errors;
}

/**
 * Validate appearance config
 */
function validateAppearanceConfig(appearance: any, path: string): string[] {
  const errors: string[] = [];
  
  if (!appearance || typeof appearance !== 'object') {
    errors.push(`${path}: Appearance must be an object`);
    return errors;
  }
  
  if (!appearance.spriteSheet || typeof appearance.spriteSheet !== 'string') {
    errors.push(`${path}: Appearance must have string spriteSheet`);
  }
  
  if (!Array.isArray(appearance.animations)) {
    errors.push(`${path}: Appearance animations must be an array`);
  }
  
  if (!Array.isArray(appearance.colorPalette)) {
    errors.push(`${path}: Appearance colorPalette must be an array`);
  } else {
    // Validate hex colors
    for (let i = 0; i < appearance.colorPalette.length; i++) {
      const color = appearance.colorPalette[i];
      if (typeof color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        errors.push(`${path}.colorPalette[${i}]: Invalid hex color "${color}"`);
      }
    }
  }
  
  if (typeof appearance.scale !== 'number' || appearance.scale <= 0) {
    errors.push(`${path}.scale: Must be positive number`);
  }
  
  return errors;
}

/**
 * Validate content metadata
 */
function validateContentMetadata(metadata: any, path: string): string[] {
  const errors: string[] = [];
  
  if (!metadata || typeof metadata !== 'object') {
    errors.push(`${path}: Metadata must be an object`);
    return errors;
  }
  
  if (!metadata.model || typeof metadata.model !== 'string') {
    errors.push(`${path}: Metadata must have string model`);
  }
  
  if (typeof metadata.temperature !== 'number' || metadata.temperature < 0 || metadata.temperature > 2) {
    errors.push(`${path}.temperature: Must be number between 0 and 2`);
  }
  
  if (typeof metadata.promptTokens !== 'number' || metadata.promptTokens < 0) {
    errors.push(`${path}.promptTokens: Must be non-negative number`);
  }
  
  if (typeof metadata.completionTokens !== 'number' || metadata.completionTokens < 0) {
    errors.push(`${path}.completionTokens: Must be non-negative number`);
  }
  
  if (typeof metadata.cost !== 'number' || metadata.cost < 0) {
    errors.push(`${path}.cost: Must be non-negative number`);
  }
  
  if (typeof metadata.generatedAt !== 'number') {
    errors.push(`${path}.generatedAt: Must be number (timestamp)`);
  }
  
  if (typeof metadata.epoch !== 'number') {
    errors.push(`${path}.epoch: Must be number`);
  }
  
  if (typeof metadata.usageCount !== 'number' || metadata.usageCount < 0) {
    errors.push(`${path}.usageCount: Must be non-negative number`);
  }
  
  return errors;
}

/**
 * Validate vendor personality
 */
export function validateVendorPersonality(vendor: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const path = 'vendor';
  
  if (!vendor || typeof vendor !== 'object') {
    return { valid: false, errors: [`${path}: Must be an object`], warnings };
  }
  
  // Required fields
  if (!vendor.id || typeof vendor.id !== 'string') {
    errors.push(`${path}: Must have string id`);
  }
  
  if (!vendor.name || typeof vendor.name !== 'string') {
    errors.push(`${path}: Must have string name`);
  }
  
  if (!vendor.description || typeof vendor.description !== 'string') {
    errors.push(`${path}: Must have string description`);
  }
  
  const validProductTypes: VendorProductType[] = ['drinks', 'snacks', 'merchandise', 'mixed'];
  if (!validProductTypes.includes(vendor.productType)) {
    errors.push(`${path}: Invalid productType "${vendor.productType}"`);
  }
  
  // Validate traits array
  if (!Array.isArray(vendor.traits)) {
    errors.push(`${path}: traits must be an array`);
  } else {
    if (vendor.traits.length < 3) {
      warnings.push(`${path}: Should have at least 3 traits`);
    }
    vendor.traits.forEach((trait: any, i: number) => {
      errors.push(...validatePersonalityTrait(trait, `${path}.traits[${i}]`));
    });
  }
  
  // Validate dialogue array
  if (!Array.isArray(vendor.dialogue)) {
    errors.push(`${path}: dialogue must be an array`);
  } else {
    if (vendor.dialogue.length < 5) {
      warnings.push(`${path}: Should have at least 5 dialogue lines`);
    }
    vendor.dialogue.forEach((dialogue: any, i: number) => {
      errors.push(...validateDialogueLine(dialogue, `${path}.dialogue[${i}]`));
    });
  }
  
  // Validate movement config
  if (!vendor.movement || typeof vendor.movement !== 'object') {
    errors.push(`${path}: movement must be an object`);
  } else {
    if (typeof vendor.movement.speed !== 'number' || vendor.movement.speed < 0) {
      errors.push(`${path}.movement.speed: Must be non-negative number`);
    }
    if (typeof vendor.movement.pauseDuration !== 'number' || vendor.movement.pauseDuration < 0) {
      errors.push(`${path}.movement.pauseDuration: Must be non-negative number`);
    }
    if (typeof vendor.movement.avoidsActiveWave !== 'boolean') {
      errors.push(`${path}.movement.avoidsActiveWave: Must be boolean`);
    }
  }
  
  // Validate appearance
  if (!vendor.appearance) {
    errors.push(`${path}: appearance is required`);
  } else {
    errors.push(...validateAppearanceConfig(vendor.appearance, `${path}.appearance`));
  }
  
  // Validate metadata
  if (!vendor.metadata) {
    errors.push(`${path}: metadata is required`);
  } else {
    errors.push(...validateContentMetadata(vendor.metadata, `${path}.metadata`));
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate mascot ability
 */
function validateMascotAbility(ability: any, path: string): string[] {
  const errors: string[] = [];
  
  if (!ability || typeof ability !== 'object') {
    errors.push(`${path}: Ability must be an object`);
    return errors;
  }
  
  if (!ability.id || typeof ability.id !== 'string') {
    errors.push(`${path}: Ability must have string id`);
  }
  
  if (!ability.name || typeof ability.name !== 'string') {
    errors.push(`${path}: Ability must have string name`);
  }
  
  if (!ability.description || typeof ability.description !== 'string') {
    errors.push(`${path}: Ability must have string description`);
  }
  
  if (typeof ability.cooldown !== 'number' || ability.cooldown < 0) {
    errors.push(`${path}.cooldown: Must be non-negative number`);
  }
  
  if (typeof ability.duration !== 'number' || ability.duration < 0) {
    errors.push(`${path}.duration: Must be non-negative number`);
  }
  
  if (!Array.isArray(ability.effects)) {
    errors.push(`${path}.effects: Must be an array`);
  } else {
    ability.effects.forEach((effect: any, i: number) => {
      const validStats = ['happiness', 'thirst', 'attention', 'waveStrength'];
      if (!validStats.includes(effect.stat)) {
        errors.push(`${path}.effects[${i}].stat: Invalid stat "${effect.stat}"`);
      }
      
      const validTypes = ['add', 'multiply', 'set'];
      if (!validTypes.includes(effect.type)) {
        errors.push(`${path}.effects[${i}].type: Invalid type "${effect.type}"`);
      }
      
      if (typeof effect.value !== 'number') {
        errors.push(`${path}.effects[${i}].value: Must be a number`);
      }
      
      const validTargets = ['section', 'allSections', 'activeFans'];
      if (!validTargets.includes(effect.target)) {
        errors.push(`${path}.effects[${i}].target: Invalid target "${effect.target}"`);
      }
    });
  }
  
  return errors;
}

/**
 * Validate mascot personality
 */
export function validateMascotPersonality(mascot: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const path = 'mascot';
  
  if (!mascot || typeof mascot !== 'object') {
    return { valid: false, errors: [`${path}: Must be an object`], warnings };
  }
  
  // Required fields
  if (!mascot.id || typeof mascot.id !== 'string') {
    errors.push(`${path}: Must have string id`);
  }
  
  if (!mascot.name || typeof mascot.name !== 'string') {
    errors.push(`${path}: Must have string name`);
  }
  
  if (!mascot.description || typeof mascot.description !== 'string') {
    errors.push(`${path}: Must have string description`);
  }
  
  const validThemes: MascotTheme[] = ['animal', 'object', 'character', 'abstract', 'sports'];
  if (!validThemes.includes(mascot.theme)) {
    errors.push(`${path}: Invalid theme "${mascot.theme}"`);
  }
  
  // Validate traits array
  if (!Array.isArray(mascot.traits)) {
    errors.push(`${path}: traits must be an array`);
  } else {
    if (mascot.traits.length < 3) {
      warnings.push(`${path}: Should have at least 3 traits`);
    }
    mascot.traits.forEach((trait: any, i: number) => {
      errors.push(...validatePersonalityTrait(trait, `${path}.traits[${i}]`));
    });
  }
  
  // Validate dialogue array
  if (!Array.isArray(mascot.dialogue)) {
    errors.push(`${path}: dialogue must be an array`);
  } else {
    if (mascot.dialogue.length < 5) {
      warnings.push(`${path}: Should have at least 5 dialogue lines`);
    }
    mascot.dialogue.forEach((dialogue: any, i: number) => {
      errors.push(...validateDialogueLine(dialogue, `${path}.dialogue[${i}]`));
    });
  }
  
  // Validate abilities array
  if (!Array.isArray(mascot.abilities)) {
    errors.push(`${path}: abilities must be an array`);
  } else {
    if (mascot.abilities.length < 3) {
      warnings.push(`${path}: Should have at least 3 abilities`);
    }
    mascot.abilities.forEach((ability: any, i: number) => {
      errors.push(...validateMascotAbility(ability, `${path}.abilities[${i}]`));
    });
  }
  
  // Validate appearance
  if (!mascot.appearance) {
    errors.push(`${path}: appearance is required`);
  } else {
    errors.push(...validateAppearanceConfig(mascot.appearance, `${path}.appearance`));
  }
  
  // Validate metadata
  if (!mascot.metadata) {
    errors.push(`${path}: metadata is required`);
  } else {
    errors.push(...validateContentMetadata(mascot.metadata, `${path}.metadata`));
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate announcer content
 */
export function validateAnnouncerContent(announcer: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const path = 'announcer';
  
  if (!announcer || typeof announcer !== 'object') {
    return { valid: false, errors: [`${path}: Must be an object`], warnings };
  }
  
  // Required fields
  if (!announcer.id || typeof announcer.id !== 'string') {
    errors.push(`${path}: Must have string id`);
  }
  
  if (!announcer.name || typeof announcer.name !== 'string') {
    errors.push(`${path}: Must have string name`);
  }
  
  if (!announcer.description || typeof announcer.description !== 'string') {
    errors.push(`${path}: Must have string description`);
  }
  
  const validStyles = ['classic', 'energetic', 'sarcastic', 'professional', 'casual'];
  if (!validStyles.includes(announcer.style)) {
    errors.push(`${path}: Invalid style "${announcer.style}"`);
  }
  
  // Validate traits array
  if (!Array.isArray(announcer.traits)) {
    errors.push(`${path}: traits must be an array`);
  } else {
    announcer.traits.forEach((trait: any, i: number) => {
      errors.push(...validatePersonalityTrait(trait, `${path}.traits[${i}]`));
    });
  }
  
  // Validate commentary array
  if (!Array.isArray(announcer.commentary)) {
    errors.push(`${path}: commentary must be an array`);
  } else {
    if (announcer.commentary.length < 10) {
      warnings.push(`${path}: Should have at least 10 commentary lines`);
    }
    announcer.commentary.forEach((line: any, i: number) => {
      errors.push(...validateDialogueLine(line, `${path}.commentary[${i}]`));
    });
  }
  
  // Validate catchphrases array (optional)
  if (announcer.catchphrases !== undefined) {
    if (!Array.isArray(announcer.catchphrases)) {
      errors.push(`${path}: catchphrases must be an array`);
    }
  }
  
  // Validate metadata
  if (!announcer.metadata) {
    errors.push(`${path}: metadata is required`);
  } else {
    errors.push(...validateContentMetadata(announcer.metadata, `${path}.metadata`));
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate complete GameAIContent object
 */
export function validateGameAIContent(content: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!content || typeof content !== 'object') {
    return { valid: false, errors: ['Content must be an object'], warnings };
  }
  
  // Validate top-level fields
  if (!content.version || typeof content.version !== 'string') {
    errors.push('Content must have string version');
  }
  
  if (typeof content.epoch !== 'number') {
    errors.push('Content must have number epoch');
  }
  
  if (typeof content.generatedAt !== 'number') {
    errors.push('Content must have number generatedAt');
  }
  
  if (!['development', 'production'].includes(content.environment)) {
    errors.push('Content environment must be "development" or "production"');
  }
  
  // Validate vendors array
  if (!Array.isArray(content.vendors)) {
    errors.push('Content must have vendors array');
  } else {
    if (content.vendors.length < 5) {
      warnings.push('Should have at least 5 vendor personalities');
    }
    content.vendors.forEach((vendor: any, i: number) => {
      const result = validateVendorPersonality(vendor);
      errors.push(...result.errors.map(e => `vendors[${i}].${e}`));
      warnings.push(...result.warnings.map(w => `vendors[${i}].${w}`));
    });
  }
  
  // Validate mascots array
  if (!Array.isArray(content.mascots)) {
    errors.push('Content must have mascots array');
  } else {
    if (content.mascots.length < 3) {
      warnings.push('Should have at least 3 mascot personalities');
    }
    content.mascots.forEach((mascot: any, i: number) => {
      const result = validateMascotPersonality(mascot);
      errors.push(...result.errors.map(e => `mascots[${i}].${e}`));
      warnings.push(...result.warnings.map(w => `mascots[${i}].${w}`));
    });
  }
  
  // Validate announcers array
  if (!Array.isArray(content.announcers)) {
    errors.push('Content must have announcers array');
  } else {
    if (content.announcers.length < 1) {
      warnings.push('Should have at least 1 announcer content set');
    }
    content.announcers.forEach((announcer: any, i: number) => {
      const result = validateAnnouncerContent(announcer);
      errors.push(...result.errors.map(e => `announcers[${i}].${e}`));
      warnings.push(...result.warnings.map(w => `announcers[${i}].${w}`));
    });
  }
  
  // Validate metadata
  if (!content.metadata || typeof content.metadata !== 'object') {
    errors.push('Content must have metadata object');
  } else {
    if (typeof content.metadata.totalItems !== 'number') {
      errors.push('metadata.totalItems must be a number');
    }
    if (typeof content.metadata.totalCost !== 'number') {
      errors.push('metadata.totalCost must be a number');
    }
    if (typeof content.metadata.totalTokens !== 'number') {
      errors.push('metadata.totalTokens must be a number');
    }
    if (typeof content.metadata.generationTime !== 'number') {
      errors.push('metadata.generationTime must be a number');
    }
    const validStatuses = ['generating', 'complete', 'error', 'cached'];
    if (!validStatuses.includes(content.metadata.status)) {
      errors.push('metadata.status must be one of: generating, complete, error, cached');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
