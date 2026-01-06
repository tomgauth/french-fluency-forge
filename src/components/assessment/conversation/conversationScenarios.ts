import type { EnhancedScenarioConfig } from './types';

export interface ConversationScenario extends EnhancedScenarioConfig {
  starterAgentTurn: string;
  required_slots: string[];
}

// ============================================================================
// Tier 1 Scenarios - Friendly, Supportive
// ============================================================================

export const conversationScenarios: ConversationScenario[] = [
  // Tier 1 - Service Context
  {
    id: "C1",
    title: "Restaurant order wrong",
    goal: "User politely explains the order is wrong, asks for a solution, and confirms what will happen next.",
    context: "You are a friendly server at a casual French restaurant.",
    persona_id: "P01", // Friendly Support Agent
    tier: 1,
    slots: {
      dish_ordered: null,
      dish_received: null,
      resolution: null
    },
    required_slots: ["dish_ordered", "dish_received", "resolution"],
    starterAgentTurn: "Bonjour ! Vous avez commandé quoi ?",
    planned_repair_events: [
      {
        event_id: "E1",
        trigger_turn: 3,
        description: "Mishear the dish name slightly (e.g., poulet vs poisson)"
      },
      {
        event_id: "E5",
        trigger_turn: 5,
        description: "Reveal that you need to check with the kitchen first"
      }
    ],
    end_conditions: [
      "All slots filled",
      "Resolution confirmed",
      "Next steps clear"
    ]
  },
  
  // Tier 1 - Social Context
  {
    id: "C2",
    title: "Friend canceling plans",
    goal: "User explains they need to cancel plans, suggests alternative, and confirms new arrangement.",
    context: "You are a warm, understanding friend.",
    persona_id: "P10", // Friendly Friend
    tier: 1,
    slots: {
      cancellation_reason: null,
      alternative_proposed: null,
      new_time: null
    },
    required_slots: ["cancellation_reason", "alternative_proposed", "new_time"],
    starterAgentTurn: "Salut ! On se voit toujours samedi pour le cinéma ?",
    planned_repair_events: [
      {
        event_id: "E2",
        trigger_turn: 4,
        description: "Say 'on peut le faire après' without specifying when"
      },
      {
        event_id: "E4",
        trigger_turn: 6,
        description: "Assume they want to cancel completely, not reschedule"
      }
    ],
    end_conditions: [
      "Reason understood",
      "New plan agreed",
      "Friendship maintained"
    ]
  },
  
  // Tier 1 - Workplace Context
  {
    id: "C3",
    title: "Project deadline discussion",
    goal: "User asks about project deadline, proposes timeline, and confirms next steps.",
    context: "You are a supportive colleague working on a shared project.",
    persona_id: "P07", // Supportive Colleague
    tier: 1,
    slots: {
      current_deadline: null,
      proposed_change: null,
      agreed_action: null
    },
    required_slots: ["current_deadline", "proposed_change", "agreed_action"],
    starterAgentTurn: "Salut ! Tu as vu l'email sur le projet ?",
    planned_repair_events: [
      {
        event_id: "E1",
        trigger_turn: 3,
        description: "Confuse the deadline date (e.g., say 'vendredi 15' when it's 'jeudi 15')"
      },
      {
        event_id: "E5",
        trigger_turn: 5,
        description: "Mention we need approval from the manager"
      }
    ],
    end_conditions: [
      "Deadline clarified",
      "Plan agreed",
      "Next steps defined"
    ]
  },

  // ============================================================================
  // Tier 2 Scenarios - Moderate Friction
  // ============================================================================
  
  {
    id: "C4",
    title: "Doctor appointment change",
    goal: "User needs to change appointment, handles policy constraints, confirms new time.",
    context: "You are a busy medical receptionist with strict policies.",
    persona_id: "P02", // Busy Agent
    tier: 2,
    slots: {
      current_appointment: null,
      change_reason: null,
      new_appointment: null
    },
    required_slots: ["current_appointment", "change_reason", "new_appointment"],
    starterAgentTurn: "Oui, bonjour. C'est pour quoi ?",
    planned_repair_events: [
      {
        event_id: "E3",
        trigger_turn: 3,
        description: "First say 24h notice required, later say 48h notice"
      },
      {
        event_id: "E5",
        trigger_turn: 5,
        description: "Reveal cancellation fee policy late"
      }
    ],
    end_conditions: [
      "Policy understood",
      "New appointment scheduled",
      "Confirmation number provided"
    ]
  },
  
  {
    id: "C5",
    title: "Return item with policy",
    goal: "User wants to return item, navigates return policy, reaches solution.",
    context: "You are a policy-focused customer service agent.",
    persona_id: "P03", // Policy Gatekeeper
    tier: 2,
    slots: {
      item_name: null,
      purchase_date: null,
      resolution_type: null
    },
    required_slots: ["item_name", "purchase_date", "resolution_type"],
    starterAgentTurn: "Service client, bonjour. Vous avez acheté quoi ?",
    planned_repair_events: [
      {
        event_id: "E1",
        trigger_turn: 3,
        description: "Mishear purchase date"
      },
      {
        event_id: "E4",
        trigger_turn: 5,
        description: "Assume they want store credit, not refund"
      }
    ],
    end_conditions: [
      "Policy explained",
      "Resolution agreed",
      "Next steps clear"
    ]
  },
  
  {
    id: "C6",
    title: "Neighbor noise complaint",
    goal: "User complains about noise, negotiates solution, confirms agreement.",
    context: "You are a neighbor who is somewhat confused about timing.",
    persona_id: "P04", // Confused Agent
    tier: 2,
    slots: {
      noise_time: null,
      noise_type: null,
      compromise: null
    },
    required_slots: ["noise_time", "noise_type", "compromise"],
    starterAgentTurn: "Salut… Ça va ? Tu voulais me parler ?",
    planned_repair_events: [
      {
        event_id: "E1",
        trigger_turn: 2,
        description: "Confuse the time they mentioned (morning vs evening)"
      },
      {
        event_id: "E2",
        trigger_turn: 5,
        description: "Say vaguely 'je vais essayer de faire attention' without specifics"
      }
    ],
    end_conditions: [
      "Issue understood",
      "Specific compromise agreed",
      "Relationship maintained"
    ]
  },

  // ============================================================================
  // Tier 3 Scenarios - High Friction
  // ============================================================================
  
  {
    id: "C7",
    title: "Flight cancellation with rigid policy",
    goal: "User handles flight cancellation, negotiates alternatives, overcomes policy barriers.",
    context: "You are a strict airline agent following policy to the letter.",
    persona_id: "P03", // Policy Gatekeeper
    tier: 3,
    slots: {
      booking_reference: null,
      alternative_requested: null,
      resolution: null
    },
    required_slots: ["booking_reference", "alternative_requested", "resolution"],
    starterAgentTurn: "Service client. Numéro de réservation ?",
    planned_repair_events: [
      {
        event_id: "E3",
        trigger_turn: 3,
        description: "Contradict refund policy (first say no refund, later mention partial refund)"
      },
      {
        event_id: "E5",
        trigger_turn: 6,
        description: "Reveal fee for rebooking you didn't mention"
      }
    ],
    end_conditions: [
      "Policy barriers navigated",
      "Alternative found",
      "User remained assertive"
    ]
  },
  
  {
    id: "C8",
    title: "Stressed manager pushback",
    goal: "User proposes project change to stressed manager, handles pushback, reaches agreement.",
    context: "You are a stressed manager with tight deadlines and budget concerns.",
    persona_id: "P08", // Stressed Manager
    tier: 3,
    slots: {
      change_proposed: null,
      justification: null,
      agreed_plan: null
    },
    required_slots: ["change_proposed", "justification", "agreed_plan"],
    starterAgentTurn: "Bon, qu'est-ce qu'il y a ? Je suis pressé.",
    planned_repair_events: [
      {
        event_id: "E4",
        trigger_turn: 3,
        description: "Assume they want more time, when they want different resources"
      },
      {
        event_id: "E3",
        trigger_turn: 5,
        description: "Contradict what budget/timeline you said earlier"
      }
    ],
    end_conditions: [
      "Manager convinced",
      "Emotion handled well",
      "Clear agreement"
    ]
  },
  
  {
    id: "C9",
    title: "Disappointed friend conflict",
    goal: "User addresses friend's disappointment, repairs relationship, proposes solution.",
    context: "You are a friend who is disappointed and expressing hurt feelings.",
    persona_id: "P11", // Disappointed Friend
    tier: 3,
    slots: {
      issue_acknowledged: null,
      apology_or_explanation: null,
      solution_proposed: null
    },
    required_slots: ["issue_acknowledged", "apology_or_explanation", "solution_proposed"],
    starterAgentTurn: "Ah, tu es là. Je suis un peu déçu, tu sais...",
    planned_repair_events: [
      {
        event_id: "E2",
        trigger_turn: 3,
        description: "Express hurt feelings vaguely without being specific"
      },
      {
        event_id: "E4",
        trigger_turn: 5,
        description: "Assume they don't care, when they do"
      }
    ],
    end_conditions: [
      "Feelings acknowledged",
      "Relationship repair attempted",
      "Future plan made"
    ]
  }
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a random scenario for the assessment
 */
export const getRandomScenario = (): ConversationScenario => {
  const index = Math.floor(Math.random() * conversationScenarios.length);
  return conversationScenarios[index];
};

/**
 * Get scenario by ID
 */
export const getScenarioById = (id: string): ConversationScenario | undefined => {
  return conversationScenarios.find(s => s.id === id);
};

/**
 * Get scenarios by tier
 */
export const getScenariosByTier = (tier: 1 | 2 | 3): ConversationScenario[] => {
  return conversationScenarios.filter(s => s.tier === tier);
};

/**
 * Get random scenario for specific tier
 */
export const getRandomScenarioForTier = (tier: 1 | 2 | 3): ConversationScenario => {
  const tierScenarios = getScenariosByTier(tier);
  const index = Math.floor(Math.random() * tierScenarios.length);
  return tierScenarios[index];
};
