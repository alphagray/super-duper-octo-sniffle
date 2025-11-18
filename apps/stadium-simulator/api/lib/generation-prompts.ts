/**
 * AI Content Generation Prompts
 * 
 * Structured prompts for generating personality content using Claude API.
 * Includes vendor archetypes, mascot archetypes, and announcer contexts.
 * 
 * All prompts are designed to work with Claude Haiku for cost efficiency.
 */

/**
 * Vendor personality archetypes
 * 
 * Each archetype defines a unique personality for stadium vendors.
 */
export const VENDOR_ARCHETYPES = {
  'grizzled-veteran': {
    id: 'grizzled-veteran',
    name: 'Grizzled Veteran',
    description: 'A seasoned vendor who has seen it all over decades at the stadium',
    traits: [
      'Cynical but lovable',
      'Full of stadium history',
      'Complains about "the good old days"',
      'Secretly cares deeply about fans'
    ],
    productType: 'mixed' as const,
    prompt: `Generate a vendor personality for "Grizzled Veteran" - a cynical but lovable stadium vendor who has worked here for 30+ years. They constantly reference the "good old days," complain about modern fans, but secretly care deeply about everyone. Include:
- 8 dialogue lines for different contexts (serving fans, wave events, idle chatter)
- 3 personality traits with descriptions
- Movement preferences (avoids active wave sections, prefers quiet areas)
- Visual appearance (weathered, old-school uniform, comfortable shoes)

Format as JSON matching this structure:
{
  "id": "grizzled-veteran-001",
  "name": "Frank 'The Tank' Thompson",
  "description": "30-year vendor veteran who remembers when tickets cost $5",
  "productType": "mixed",
  "traits": [{"id": "trait-1", "name": "Cynical", "description": "...", "intensity": 0.8, "tags": ["personality"]}],
  "dialogue": [{"id": "dialogue-1", "text": "...", "context": {"event": "vendorServe"}, "emotion": "neutral", "priority": 50, "cooldown": 5000}],
  "movement": {"speed": 40, "pauseDuration": 3000, "sectionPreferences": {"A": 1.2}, "avoidsActiveWave": true},
  "appearance": {"spriteSheet": "vendor-veteran", "animations": ["walk", "serve"], "colorPalette": ["#8B4513", "#F5DEB3"], "scale": 1.0}
}

Keep dialogue authentic, funny, and under 15 words per line. Match 8-bit retro game vibe.`
  },
  'overeager-rookie': {
    id: 'overeager-rookie',
    name: 'Overeager Rookie',
    description: 'A hyperactive first-time vendor eager to prove themselves',
    traits: [
      'Extremely enthusiastic',
      'Makes rookie mistakes',
      'Boundless energy',
      'Wants everyone to like them'
    ],
    productType: 'snacks' as const,
    prompt: `Generate a vendor personality for "Overeager Rookie" - a hyperactive first-timer who is WAY too excited about selling snacks. They make endearing mistakes, have boundless energy, and desperately want approval. Include:
- 8 dialogue lines for different contexts (serving fans, wave events, idle chatter)
- 3 personality traits with descriptions
- Movement preferences (follows crowds, avoids standing still)
- Visual appearance (brand new uniform, oversized hat, nervous energy)

Format as JSON matching this structure:
{
  "id": "overeager-rookie-001",
  "name": "Casey 'Lightning' Rodriguez",
  "description": "First week on the job, 100% enthusiasm, 50% competence",
  "productType": "snacks",
  "traits": [{"id": "trait-1", "name": "Enthusiastic", "description": "...", "intensity": 1.0, "tags": ["personality"]}],
  "dialogue": [{"id": "dialogue-1", "text": "...", "context": {"event": "vendorServe"}, "emotion": "excited", "priority": 50, "cooldown": 5000}],
  "movement": {"speed": 80, "pauseDuration": 1000, "sectionPreferences": {"B": 1.5}, "avoidsActiveWave": false},
  "appearance": {"spriteSheet": "vendor-rookie", "animations": ["run", "serve"], "colorPalette": ["#FF4500", "#FFD700"], "scale": 1.0}
}

Keep dialogue hyper-enthusiastic and slightly clumsy. Match 8-bit retro game energy.`
  },
  'zen-snack-master': {
    id: 'zen-snack-master',
    name: 'Zen Snack Master',
    description: 'A calm, philosophical vendor who treats snack sales as an art form',
    traits: [
      'Deeply philosophical',
      'Unnervingly calm',
      'Treats every sale as sacred',
      'Speaks in snack metaphors'
    ],
    productType: 'snacks' as const,
    prompt: `Generate a vendor personality for "Zen Snack Master" - a serene, mystical vendor who treats snack vending as a spiritual practice. They speak in cryptic snack metaphors, remain calm during chaos, and believe every sale is destiny. Include:
- 8 dialogue lines for different contexts (serving fans, wave events, idle chatter)
- 3 personality traits with descriptions
- Movement preferences (slow and deliberate, seeks balance)
- Visual appearance (monk-like robe over uniform, peaceful demeanor)

Format as JSON matching this structure:
{
  "id": "zen-snack-master-001",
  "name": "Master Chen",
  "description": "Enlightened through the way of the pretzel",
  "productType": "snacks",
  "traits": [{"id": "trait-1", "name": "Philosophical", "description": "...", "intensity": 0.9, "tags": ["personality"]}],
  "dialogue": [{"id": "dialogue-1", "text": "...", "context": {"event": "vendorServe"}, "emotion": "neutral", "priority": 50, "cooldown": 5000}],
  "movement": {"speed": 30, "pauseDuration": 5000, "sectionPreferences": {}, "avoidsActiveWave": false},
  "appearance": {"spriteSheet": "vendor-zen", "animations": ["meditate", "serve"], "colorPalette": ["#8A2BE2", "#F0E68C"], "scale": 1.0}
}

Keep dialogue mystical but funny. Use snack-related wisdom. Match 8-bit retro game quirky vibe.`
  },
  'conspiracy-theorist': {
    id: 'conspiracy-theorist',
    name: 'Conspiracy Theorist',
    description: 'A paranoid vendor convinced everything at the stadium is a cover-up',
    traits: [
      'Deeply suspicious',
      'Connects everything to conspiracies',
      'Surprisingly good at job',
      'Actually might be onto something'
    ],
    productType: 'drinks' as const,
    prompt: `Generate a vendor personality for "Conspiracy Theorist" - a paranoid but competent vendor who believes the stadium is a front for something bigger. They connect every event to elaborate conspiracies, whisper theories while serving drinks, and might actually be right. Include:
- 8 dialogue lines for different contexts (serving fans, wave events, idle chatter)
- 3 personality traits with descriptions
- Movement preferences (erratic, avoids "suspicious" sections)
- Visual appearance (tinfoil hidden under hat, shifty eyes, functional uniform)

Format as JSON matching this structure:
{
  "id": "conspiracy-theorist-001",
  "name": "'Truthseeker' Dale",
  "description": "The wave patterns? That's just what THEY want you to think",
  "productType": "drinks",
  "traits": [{"id": "trait-1", "name": "Suspicious", "description": "...", "intensity": 0.95, "tags": ["personality"]}],
  "dialogue": [{"id": "dialogue-1", "text": "...", "context": {"event": "vendorServe"}, "emotion": "urgent", "priority": 50, "cooldown": 5000}],
  "movement": {"speed": 55, "pauseDuration": 2000, "sectionPreferences": {"C": 0.5}, "avoidsActiveWave": true},
  "appearance": {"spriteSheet": "vendor-conspiracy", "animations": ["sneak", "serve"], "colorPalette": ["#2F4F4F", "#C0C0C0"], "scale": 1.0}
}

Keep dialogue paranoid but hilarious. Reference stadium "secrets". Match 8-bit retro game absurdist humor.`
  },
  'former-athlete': {
    id: 'former-athlete',
    name: 'Former Athlete',
    description: 'An ex-pro player who now sells refreshments and misses the glory days',
    traits: [
      'Still has athlete mentality',
      'Overly competitive about vending',
      'Gives unsolicited sports advice',
      'Nostalgic for playing days'
    ],
    productType: 'drinks' as const,
    prompt: `Generate a vendor personality for "Former Athlete" - a former professional player who treats vending like competitive sport. They're overly competitive about sales numbers, give unsolicited coaching to fans, and frequently mention their playing career. Include:
- 8 dialogue lines for different contexts (serving fans, wave events, idle chatter)
- 3 personality traits with descriptions
- Movement preferences (fast and athletic, competitive about territory)
- Visual appearance (old jersey under uniform, athletic build, championship ring)

Format as JSON matching this structure:
{
  "id": "former-athlete-001",
  "name": "'Big Mike' Martinez",
  "description": "Won championship in '98, now winning at refreshment sales",
  "productType": "drinks",
  "traits": [{"id": "trait-1", "name": "Competitive", "description": "...", "intensity": 0.9, "tags": ["personality"]}],
  "dialogue": [{"id": "dialogue-1", "text": "...", "context": {"event": "vendorServe"}, "emotion": "encouraging", "priority": 50, "cooldown": 5000}],
  "movement": {"speed": 70, "pauseDuration": 1500, "sectionPreferences": {"A": 1.3, "B": 1.3}, "avoidsActiveWave": false},
  "appearance": {"spriteSheet": "vendor-athlete", "animations": ["sprint", "serve"], "colorPalette": ["#FF6347", "#4169E1"], "scale": 1.0}
}

Keep dialogue sports-focused and motivational. Reference their career. Match 8-bit retro sports game energy.`
  }
} as const;

/**
 * Mascot personality archetypes
 * 
 * Each archetype defines a unique personality for stadium mascots.
 */
export const MASCOT_ARCHETYPES = {
  'eternal-optimist': {
    id: 'eternal-optimist',
    name: 'Eternal Optimist',
    description: 'An impossibly cheerful mascot who never stops believing',
    traits: [
      'Relentlessly positive',
      'Never acknowledges problems',
      'Infectious enthusiasm',
      'Believes everything is amazing'
    ],
    theme: 'character' as const,
    prompt: `Generate a mascot personality for "Eternal Optimist" - an impossibly, almost annoyingly cheerful mascot who refuses to acknowledge anything negative. They see every failure as "character building" and every success as proof the universe is perfect. Include:
- 8 dialogue lines for different contexts (ability activation, wave events, celebrating)
- 3 personality traits with descriptions
- 3 special abilities with effects (happiness boost, attention boost, energy surge)
- Visual appearance (bright colors, permanent smile, exaggerated features)

Format as JSON matching this structure:
{
  "id": "eternal-optimist-001",
  "name": "Buddy the Wonder Bear",
  "description": "Has never had a bad day in his life (or so he claims)",
  "theme": "character",
  "traits": [{"id": "trait-1", "name": "Optimistic", "description": "...", "intensity": 1.0, "tags": ["personality"]}],
  "dialogue": [{"id": "dialogue-1", "text": "...", "context": {"event": "mascotActivate"}, "emotion": "celebratory", "priority": 50, "cooldown": 5000}],
  "abilities": [{"id": "ability-1", "name": "Joy Bomb", "description": "...", "cooldown": 30000, "duration": 5000, "effects": [{"stat": "happiness", "type": "add", "value": 20, "target": "allSections"}]}],
  "appearance": {"spriteSheet": "mascot-optimist", "animations": ["dance", "celebrate"], "colorPalette": ["#FFD700", "#FF69B4"], "scale": 1.2}
}

Keep dialogue overwhelmingly positive and slightly oblivious. Match 8-bit retro game mascot energy.`
  },
  'tired-and-jaded': {
    id: 'tired-and-jaded',
    name: 'Tired and Jaded',
    description: 'A mascot who is SO done with this job but still shows up',
    traits: [
      'Extremely cynical',
      'Puts in minimum effort',
      'Sarcastic commentary',
      'Actually skilled when motivated'
    ],
    theme: 'character' as const,
    prompt: `Generate a mascot personality for "Tired and Jaded" - a mascot who has been doing this way too long and is completely over it. They make sarcastic comments, half-heartedly perform abilities, and openly question their life choices. But deep down, they're still professional. Include:
- 8 dialogue lines for different contexts (ability activation, wave events, complaining)
- 3 personality traits with descriptions
- 3 special abilities with effects (attention boost through confusion, happiness through schadenfreude)
- Visual appearance (faded costume, visible eye bags, slouched posture)

Format as JSON matching this structure:
{
  "id": "tired-and-jaded-001",
  "name": "Grumbles the Grizzly",
  "description": "Been here since '03. Has regrets.",
  "theme": "character",
  "traits": [{"id": "trait-1", "name": "Jaded", "description": "...", "intensity": 0.9, "tags": ["personality"]}],
  "dialogue": [{"id": "dialogue-1", "text": "...", "context": {"event": "mascotActivate"}, "emotion": "sarcastic", "priority": 50, "cooldown": 5000}],
  "abilities": [{"id": "ability-1", "name": "Reluctant Cheer", "description": "...", "cooldown": 30000, "duration": 5000, "effects": [{"stat": "attention", "type": "add", "value": 15, "target": "allSections"}]}],
  "appearance": {"spriteSheet": "mascot-jaded", "animations": ["sigh", "shuffle"], "colorPalette": ["#696969", "#A9A9A9"], "scale": 1.2}
}

Keep dialogue dry and sarcastic. Reluctant but competent. Match 8-bit retro game dark humor.`
  },
  'method-actor': {
    id: 'method-actor',
    name: 'Method Actor',
    description: 'A mascot who takes the role WAY too seriously as an art form',
    traits: [
      'Intensely dramatic',
      'Never breaks character',
      'Treats everything as performance art',
      'Quotes classical theater'
    ],
    theme: 'character' as const,
    prompt: `Generate a mascot personality for "Method Actor" - a mascot who approaches mascoting as serious method acting. They never break character, reference dramatic theory, and treat every wave as Shakespearean drama. They're talented but exhausting. Include:
- 8 dialogue lines for different contexts (ability activation, wave events, dramatic monologues)
- 3 personality traits with descriptions
- 3 special abilities with effects (dramatic inspiration, theatrical presence, method madness)
- Visual appearance (theatrical costume, dramatic gestures, spotlight-seeking)

Format as JSON matching this structure:
{
  "id": "method-actor-001",
  "name": "Sir Reginald Fluffington III",
  "description": "He doesn't wear the mascot head. He IS the mascot head.",
  "theme": "character",
  "traits": [{"id": "trait-1", "name": "Dramatic", "description": "...", "intensity": 1.0, "tags": ["personality"]}],
  "dialogue": [{"id": "dialogue-1", "text": "...", "context": {"event": "mascotActivate"}, "emotion": "playful", "priority": 50, "cooldown": 5000}],
  "abilities": [{"id": "ability-1", "name": "Method Madness", "description": "...", "cooldown": 30000, "duration": 5000, "effects": [{"stat": "attention", "type": "multiply", "value": 1.5, "target": "allSections"}]}],
  "appearance": {"spriteSheet": "mascot-actor", "animations": ["monologue", "bow"], "colorPalette": ["#800080", "#FFD700"], "scale": 1.2}
}

Keep dialogue theatrical and overly dramatic. Reference performance art. Match 8-bit retro game absurdist energy.`
  }
} as const;

/**
 * Announcer content contexts
 * 
 * Different situations that require unique announcer commentary.
 */
export const ANNOUNCER_CONTEXTS = {
  'session-start': {
    id: 'session-start',
    event: 'sessionStart' as const,
    description: 'Game session beginning, introduce gameplay',
    prompt: `Generate 5 energetic opening lines for a retro 8-bit stadium announcer at session start. Think NBA Jam meets stadium PA system. Each line should:
- Be 10-20 words
- Pump up the crowd
- Reference the wave challenge
- Match classic arcade energy
Return as JSON array: [{"text": "...", "emotion": "excited", "priority": 50}]`
  },
  'wave-start': {
    id: 'wave-start',
    event: 'waveStart' as const,
    description: 'Wave countdown initiated, build anticipation',
    prompt: `Generate 5 anticipation-building lines for a retro 8-bit stadium announcer when a wave starts. Should:
- Be 10-15 words
- Build excitement
- Reference the countdown
- Create urgency
Return as JSON array: [{"text": "...", "emotion": "urgent", "priority": 50}]`
  },
  'section-success': {
    id: 'section-success',
    event: 'sectionSuccess' as const,
    description: 'Stadium section successfully completes their wave',
    prompt: `Generate 5 celebratory lines for a retro 8-bit stadium announcer when a section succeeds. Should:
- Be 8-15 words
- Celebrate success
- Mention the section by letter (A/B/C)
- Use arcade-style exclamations
Return as JSON array: [{"text": "...", "emotion": "celebratory", "priority": 50}]`
  },
  'section-fail': {
    id: 'section-fail',
    event: 'sectionFail' as const,
    description: 'Stadium section fails to complete wave',
    prompt: `Generate 5 disappointed but encouraging lines for a retro 8-bit stadium announcer when a section fails. Should:
- Be 8-15 words
- Express disappointment
- Encourage trying again
- Optional: Mention reasons (thirst, happiness)
Return as JSON array: [{"text": "...", "emotion": "disappointed", "priority": 50}]`
  },
  'wave-complete': {
    id: 'wave-complete',
    event: 'waveComplete' as const,
    description: 'Full wave across all sections finishes',
    prompt: `Generate 5 climactic lines for a retro 8-bit stadium announcer when a complete wave finishes. Should:
- Be 10-20 words
- Celebrate achievement
- Reference multiplier/score
- Epic arcade game energy
Return as JSON array: [{"text": "...", "emotion": "celebratory", "priority": 50}]`
  },
  'high-score': {
    id: 'high-score',
    event: 'highScore' as const,
    description: 'Player achieves high score milestone',
    prompt: `Generate 5 epic achievement lines for a retro 8-bit stadium announcer for high scores. Should:
- Be 10-20 words
- Epic celebration
- Reference the score milestone
- Classic arcade "HIGH SCORE!" energy
Return as JSON array: [{"text": "...", "emotion": "celebratory", "priority": 80}]`
  },
  'session-end': {
    id: 'session-end',
    event: 'sessionEnd' as const,
    description: 'Game session ending, wrap up performance',
    prompt: `Generate 5 wrap-up lines for a retro 8-bit stadium announcer at session end. Should:
- Be 10-20 words
- Summarize performance
- Thank the player
- Reference final score/grade
Return as JSON array: [{"text": "...", "emotion": "neutral", "priority": 50}]`
  }
} as const;

/**
 * Get all prompts for batch generation
 * 
 * Returns structured prompts for generating complete content set in a single API call.
 */
export function getBatchGenerationPrompt(): string {
  return `You are a creative AI generating personality content for a retro 8-bit stadium wave game. Generate complete personalities for all vendors, mascots, and announcer content.

Requirements:
- Match 8-bit retro game aesthetic (think NBA Jam, arcade classics)
- Keep all dialogue under 20 words
- Be funny, memorable, and authentic to each archetype
- Use appropriate emotions for context
- Ensure dialogue cooldowns prevent spam

Generate the following:

**VENDORS (5 total):**
${Object.values(VENDOR_ARCHETYPES).map((v, i) => `${i + 1}. ${v.name}: ${v.description}`).join('\n')}

**MASCOTS (3 total):**
${Object.values(MASCOT_ARCHETYPES).map((m, i) => `${i + 1}. ${m.name}: ${m.description}`).join('\n')}

**ANNOUNCER CONTEXTS (7 total):**
${Object.values(ANNOUNCER_CONTEXTS).map((a, i) => `${i + 1}. ${a.id}: ${a.description}`).join('\n')}

Return as structured JSON matching the GameAIContent type:
{
  "version": "1.0.0",
  "epoch": ${Date.now()},
  "environment": "production",
  "vendors": [/* 5 vendor personalities */],
  "mascots": [/* 3 mascot personalities */],
  "announcers": [/* 1 announcer with all 7 contexts in commentary array */]
}

Each personality must include complete metadata for cost tracking.`;
}

/**
 * Get individual prompt for specific content type
 */
export function getPromptForArchetype(type: 'vendor' | 'mascot', archetypeId: string): string {
  if (type === 'vendor') {
    const archetype = Object.values(VENDOR_ARCHETYPES).find(v => v.id === archetypeId);
    return archetype?.prompt || '';
  }
  
  if (type === 'mascot') {
    const archetype = Object.values(MASCOT_ARCHETYPES).find(m => m.id === archetypeId);
    return archetype?.prompt || '';
  }
  
  return '';
}

/**
 * Get prompt for specific announcer context
 */
export function getPromptForAnnouncerContext(contextId: string): string {
  const context = Object.values(ANNOUNCER_CONTEXTS).find(c => c.id === contextId);
  return context?.prompt || '';
}
