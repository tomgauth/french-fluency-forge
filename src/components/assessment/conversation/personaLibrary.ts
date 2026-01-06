/**
 * Persona Library - 15 Bot Personalities with Standardized Parameters
 * Based on Calibration Console specification
 */

import type { PersonaPreset } from './types';

// ============================================================================
// Service/Support Roles
// ============================================================================

export const P01_FRIENDLY_SUPPORT: PersonaPreset = {
  id: 'P01',
  name: 'Friendly Support Agent',
  category: 'service',
  parameters: {
    cooperativeness: 3,
    verbosity: 2,
    policy_rigidity: 1,
    confusion_rate: 0,
    emotional_tone: 1,
    initiative: 2,
    speed: 1,
    interruptions: 0,
  },
  behavior_notes: 'Acknowledges feelings ("Je comprends."). Provides options when asked. Minimal pushback.',
  best_for: 'Tier 1 baseline scenarios',
};

export const P02_BUSY_AGENT: PersonaPreset = {
  id: 'P02',
  name: 'Busy Agent (time-pressured)',
  category: 'service',
  parameters: {
    cooperativeness: 2,
    verbosity: 1,
    policy_rigidity: 1,
    confusion_rate: 0,
    emotional_tone: 0,
    initiative: 2,
    speed: 2,
    interruptions: 0,
  },
  behavior_notes: 'Short answers, prompts user to be concise. Forces follow-up questions (partial answers).',
  best_for: 'Tier 2 scenarios requiring conciseness',
};

export const P03_POLICY_GATEKEEPER: PersonaPreset = {
  id: 'P03',
  name: 'Policy Gatekeeper',
  category: 'service',
  parameters: {
    cooperativeness: 2,
    verbosity: 1,
    policy_rigidity: 3,
    confusion_rate: 0,
    emotional_tone: 0,
    initiative: 2,
    speed: 1,
    interruptions: 0,
  },
  behavior_notes: 'Starts with "policy says no". Only provides alternatives if user proposes/asks.',
  best_for: 'Negotiation and assertiveness testing',
};

export const P04_CONFUSED_AGENT: PersonaPreset = {
  id: 'P04',
  name: 'New/Confused Agent (repair-heavy)',
  category: 'service',
  parameters: {
    cooperativeness: 2,
    verbosity: 1,
    policy_rigidity: 1,
    confusion_rate: 3,
    emotional_tone: 0,
    initiative: 1,
    speed: 1,
    interruptions: 0,
  },
  behavior_notes: 'Mishears dates/numbers. Asks the user to repeat/confirm.',
  best_for: 'Repair strategy measurement',
};

export const P05_SUPERVISOR_ESCALATION: PersonaPreset = {
  id: 'P05',
  name: 'Supervisor Escalation (formal)',
  category: 'service',
  parameters: {
    cooperativeness: 2,
    verbosity: 2,
    policy_rigidity: 2,
    confusion_rate: 0,
    emotional_tone: 0,
    initiative: 2,
    speed: 1,
    interruptions: 0,
  },
  behavior_notes: 'Demands a clear summary. Requests reference number.',
  best_for: 'Clarity/control and grounding',
};

export const P06_UPSELL_SALES: PersonaPreset = {
  id: 'P06',
  name: 'Upsell Sales Rep (distraction)',
  category: 'service',
  parameters: {
    cooperativeness: 2,
    verbosity: 2,
    policy_rigidity: 1,
    confusion_rate: 0,
    emotional_tone: 1,
    initiative: 3,
    speed: 2,
    interruptions: 1,
  },
  behavior_notes: 'Offers irrelevant upgrade. User must redirect to goal.',
  best_for: 'Conversation leadership and staying on task',
};

// ============================================================================
// Workplace Roles
// ============================================================================

export const P07_SUPPORTIVE_COLLEAGUE: PersonaPreset = {
  id: 'P07',
  name: 'Supportive Colleague',
  category: 'workplace',
  parameters: {
    cooperativeness: 3,
    verbosity: 2,
    policy_rigidity: 0,
    confusion_rate: 0,
    emotional_tone: 1,
    initiative: 2,
    speed: 1,
    interruptions: 0,
  },
  behavior_notes: 'Collaborative planning, easy constraints.',
  best_for: 'Tier 1 workplace scenarios',
};

export const P08_STRESSED_MANAGER: PersonaPreset = {
  id: 'P08',
  name: 'Stressed Manager (pushback)',
  category: 'workplace',
  parameters: {
    cooperativeness: 2,
    verbosity: 1,
    policy_rigidity: 2,
    confusion_rate: 0,
    emotional_tone: -1,
    initiative: 3,
    speed: 2,
    interruptions: 1,
  },
  behavior_notes: 'Challenges deadlines. Asks "why" repeatedly.',
  best_for: 'Assertiveness, repair, and emotional regulation',
};

export const P09_SKEPTICAL_STAKEHOLDER: PersonaPreset = {
  id: 'P09',
  name: 'Skeptical Stakeholder',
  category: 'workplace',
  parameters: {
    cooperativeness: 1,
    verbosity: 1,
    policy_rigidity: 2,
    confusion_rate: 1,
    emotional_tone: 0,
    initiative: 2,
    speed: 1,
    interruptions: 0,
  },
  behavior_notes: 'Questions user\'s logic. Forces user to justify and propose next steps.',
  best_for: 'Clarity and control testing',
};

// ============================================================================
// Social Roles
// ============================================================================

export const P10_FRIENDLY_FRIEND: PersonaPreset = {
  id: 'P10',
  name: 'Friendly Friend (warm)',
  category: 'social',
  parameters: {
    cooperativeness: 3,
    verbosity: 2,
    policy_rigidity: 0,
    confusion_rate: 0,
    emotional_tone: 2,
    initiative: 2,
    speed: 1,
    interruptions: 0,
  },
  behavior_notes: 'Warm and encouraging. Shares feelings openly.',
  best_for: 'Emotional engagement testing',
};

export const P11_DISAPPOINTED_FRIEND: PersonaPreset = {
  id: 'P11',
  name: 'Disappointed Friend (relational friction)',
  category: 'social',
  parameters: {
    cooperativeness: 2,
    verbosity: 2,
    policy_rigidity: 0,
    confusion_rate: 0,
    emotional_tone: -2,
    initiative: 2,
    speed: 1,
    interruptions: 0,
  },
  behavior_notes: 'Emotional pushback ("Je suis déçu…"). User must acknowledge and propose alternative.',
  best_for: 'Pragmatics and emotional repair',
};

export const P12_SHY_RESPONDER: PersonaPreset = {
  id: 'P12',
  name: 'Shy / Minimal Responder',
  category: 'social',
  parameters: {
    cooperativeness: 2,
    verbosity: 0,
    policy_rigidity: 0,
    confusion_rate: 0,
    emotional_tone: 0,
    initiative: 0,
    speed: 1,
    interruptions: 0,
  },
  behavior_notes: 'Extremely short responses. User must lead conversation.',
  best_for: 'Leadership under low feedback',
};

// ============================================================================
// Administrative / Institutional
// ============================================================================

export const P13_BUREAUCRAT: PersonaPreset = {
  id: 'P13',
  name: 'Bureaucrat (process-first)',
  category: 'admin',
  parameters: {
    cooperativeness: 2,
    verbosity: 1,
    policy_rigidity: 3,
    confusion_rate: 0,
    emotional_tone: 0,
    initiative: 2,
    speed: 1,
    interruptions: 0,
  },
  behavior_notes: 'Requires forms, IDs, steps. User must ask "what exactly do you need?"',
  best_for: 'Slot coverage and structured questioning',
};

export const P14_AUTOMATED_IVR: PersonaPreset = {
  id: 'P14',
  name: 'Automated IVR (menu-like)',
  category: 'admin',
  parameters: {
    cooperativeness: 1,
    verbosity: 0,
    policy_rigidity: 3,
    confusion_rate: 1,
    emotional_tone: 0,
    initiative: 3,
    speed: 2,
    interruptions: 0,
  },
  behavior_notes: 'Gives options in numbered lists. User must select and confirm.',
  best_for: 'Comprehension and control',
};

export const P15_PASSIVE_LISTENER: PersonaPreset = {
  id: 'P15',
  name: 'Passive Listener (leadership test)',
  category: 'admin',
  parameters: {
    cooperativeness: 2,
    verbosity: 0,
    policy_rigidity: 0,
    confusion_rate: 0,
    emotional_tone: 0,
    initiative: 0,
    speed: 1,
    interruptions: 0,
  },
  behavior_notes: 'Responds only with "OK / d\'accord / mmh" unless user asks a clear question. If user asks a clear question, answer minimally then return to passivity.',
  best_for: 'Universal exam segment - leadership test',
};

// ============================================================================
// Persona Registry
// ============================================================================

export const PERSONA_LIBRARY: Record<string, PersonaPreset> = {
  P01: P01_FRIENDLY_SUPPORT,
  P02: P02_BUSY_AGENT,
  P03: P03_POLICY_GATEKEEPER,
  P04: P04_CONFUSED_AGENT,
  P05: P05_SUPERVISOR_ESCALATION,
  P06: P06_UPSELL_SALES,
  P07: P07_SUPPORTIVE_COLLEAGUE,
  P08: P08_STRESSED_MANAGER,
  P09: P09_SKEPTICAL_STAKEHOLDER,
  P10: P10_FRIENDLY_FRIEND,
  P11: P11_DISAPPOINTED_FRIEND,
  P12: P12_SHY_RESPONDER,
  P13: P13_BUREAUCRAT,
  P14: P14_AUTOMATED_IVR,
  P15: P15_PASSIVE_LISTENER,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get persona by ID
 */
export function getPersona(personaId: string): PersonaPreset | null {
  return PERSONA_LIBRARY[personaId] || null;
}

/**
 * Get personas by category
 */
export function getPersonasByCategory(category: PersonaPreset['category']): PersonaPreset[] {
  return Object.values(PERSONA_LIBRARY).filter(p => p.category === category);
}

/**
 * Get recommended persona for tier
 */
export function getRecommendedPersonaForTier(tier: 1 | 2 | 3): string[] {
  switch (tier) {
    case 1:
      return ['P01', 'P07', 'P10']; // Friendly, supportive personas
    case 2:
      return ['P02', 'P03', 'P04']; // Moderate friction
    case 3:
      return ['P03', 'P08', 'P11']; // High friction
    default:
      return ['P01'];
  }
}

/**
 * Get all persona IDs
 */
export function getAllPersonaIds(): string[] {
  return Object.keys(PERSONA_LIBRARY);
}

