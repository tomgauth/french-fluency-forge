/**
 * Mock Phrases Data - 40 phrases across 3 packs
 * Anti-school vocabulary enforced
 * 
 * Note: Phrase IDs are proper UUIDs for Supabase compatibility.
 */

import type { Phrase, PhrasePack } from '../types';

// Helper to generate deterministic UUID for a phrase number
// UUID format: 00000000-0000-4000-8001-000000000001 (must be exactly 36 chars)
// Last segment must be 12 hex characters
function getPhraseUUID(num: number): string {
  const paddedNum = String(num).padStart(12, '0'); // 12 chars for last segment
  return `00000000-0000-4000-8001-${paddedNum}`;
}

// 40 Phrases: 25 recall, 15 recognition
export const MOCK_PHRASES: Phrase[] = [
  // Pack 1: Small talk starter (15 phrases)
  {
    id: getPhraseUUID(1),
    mode: 'recall',
    prompt_en: 'How are you?',
    canonical_fr: 'Comment ça va ?',
    answers_fr: ['Comment ça va ?', 'Comment vas-tu ?', 'Ça va ?', 'Comment allez-vous ?'],
    tags: ['small talk', 'greetings'],
    difficulty: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(2),
    mode: 'recall',
    prompt_en: "I'm doing well, thanks",
    canonical_fr: 'Je vais bien, merci',
    answers_fr: ['Je vais bien, merci', 'Ça va bien, merci', 'Très bien, merci'],
    tags: ['small talk', 'greetings'],
    difficulty: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(3),
    mode: 'recall',
    prompt_en: "What's your name?",
    canonical_fr: 'Comment tu t\'appelles ?',
    answers_fr: ['Comment tu t\'appelles ?', 'Comment vous appelez-vous ?', 'Tu t\'appelles comment ?'],
    tags: ['small talk', 'introductions'],
    difficulty: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(4),
    mode: 'recall',
    prompt_en: 'Nice to meet you',
    canonical_fr: 'Enchanté',
    answers_fr: ['Enchanté', 'Ravi de vous rencontrer', 'Ravi de te rencontrer'],
    tags: ['small talk', 'introductions'],
    difficulty: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(5),
    mode: 'recall',
    prompt_en: 'Where are you from?',
    canonical_fr: 'D\'où viens-tu ?',
    answers_fr: ['D\'où viens-tu ?', 'Tu viens d\'où ?', 'D\'où venez-vous ?'],
    tags: ['small talk', 'geography'],
    difficulty: 2,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(6),
    mode: 'recognition',
    audio_url: '/mock/audio/phrase-006.mp3',
    transcript_fr: 'Qu\'est-ce que tu fais dans la vie ?',
    translation_en: 'What do you do for a living?',
    tags: ['small talk', 'work'],
    difficulty: 2,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(7),
    mode: 'recall',
    prompt_en: 'I work in tech',
    canonical_fr: 'Je travaille dans la tech',
    answers_fr: ['Je travaille dans la tech', 'Je travaille dans la technologie', 'Je bosse dans la tech'],
    tags: ['small talk', 'work'],
    difficulty: 2,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(8),
    mode: 'recognition',
    audio_url: '/mock/audio/phrase-008.mp3',
    transcript_fr: 'Tu habites où ?',
    translation_en: 'Where do you live?',
    tags: ['small talk', 'geography'],
    difficulty: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(9),
    mode: 'recall',
    prompt_en: 'I live in Paris',
    canonical_fr: 'J\'habite à Paris',
    answers_fr: ['J\'habite à Paris', 'Je vis à Paris', 'J\'habite Paris'],
    tags: ['small talk', 'geography'],
    difficulty: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(10),
    mode: 'recall',
    prompt_en: 'Do you speak English?',
    canonical_fr: 'Tu parles anglais ?',
    answers_fr: ['Tu parles anglais ?', 'Vous parlez anglais ?', 'Est-ce que tu parles anglais ?'],
    tags: ['small talk', 'language'],
    difficulty: 2,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(11),
    mode: 'recognition',
    audio_url: '/mock/audio/phrase-011.mp3',
    transcript_fr: 'Je parle un peu français',
    translation_en: 'I speak a little French',
    tags: ['small talk', 'language'],
    difficulty: 2,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(12),
    mode: 'recall',
    prompt_en: 'What do you like to do?',
    canonical_fr: 'Qu\'est-ce que tu aimes faire ?',
    answers_fr: ['Qu\'est-ce que tu aimes faire ?', 'Tu aimes faire quoi ?', 'Qu\'aimez-vous faire ?'],
    tags: ['small talk', 'hobbies'],
    difficulty: 2,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(13),
    mode: 'recall',
    prompt_en: 'I like reading',
    canonical_fr: 'J\'aime lire',
    answers_fr: ['J\'aime lire', 'J\'aime la lecture', 'J\'adore lire'],
    tags: ['small talk', 'hobbies'],
    difficulty: 2,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(14),
    mode: 'recognition',
    audio_url: '/mock/audio/phrase-014.mp3',
    transcript_fr: 'Quel temps fait-il aujourd\'hui ?',
    translation_en: 'What\'s the weather like today?',
    tags: ['small talk', 'weather'],
    difficulty: 2,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(15),
    mode: 'recall',
    prompt_en: 'It\'s nice weather',
    canonical_fr: 'Il fait beau',
    answers_fr: ['Il fait beau', 'Il fait bon', 'Le temps est beau'],
    tags: ['small talk', 'weather'],
    difficulty: 1,
    created_at: '2026-01-01T00:00:00Z',
  },

  // Pack 2: Work + logistics (13 phrases)
  {
    id: getPhraseUUID(16),
    mode: 'recall',
    prompt_en: 'I have a meeting at 3pm',
    canonical_fr: 'J\'ai une réunion à 15h',
    answers_fr: ['J\'ai une réunion à 15h', 'J\'ai une réunion à trois heures', 'J\'ai un meeting à 15h'],
    tags: ['work', 'time'],
    difficulty: 3,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(17),
    mode: 'recognition',
    audio_url: '/mock/audio/phrase-017.mp3',
    transcript_fr: 'On peut reporter à demain ?',
    translation_en: 'Can we reschedule for tomorrow?',
    tags: ['work', 'scheduling'],
    difficulty: 3,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(18),
    mode: 'recall',
    prompt_en: 'I need to finish this by Friday',
    canonical_fr: 'Je dois finir ça avant vendredi',
    answers_fr: ['Je dois finir ça avant vendredi', 'Il faut que je finisse ça avant vendredi', 'Je dois terminer ça d\'ici vendredi'],
    tags: ['work', 'deadlines'],
    difficulty: 3,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(19),
    mode: 'recall',
    prompt_en: 'Can you send me the file?',
    canonical_fr: 'Tu peux m\'envoyer le fichier ?',
    answers_fr: ['Tu peux m\'envoyer le fichier ?', 'Peux-tu m\'envoyer le fichier ?', 'Vous pouvez m\'envoyer le fichier ?'],
    tags: ['work', 'communication'],
    difficulty: 2,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(20),
    mode: 'recognition',
    audio_url: '/mock/audio/phrase-020.mp3',
    transcript_fr: 'Je te l\'envoie tout de suite',
    translation_en: 'I\'ll send it to you right away',
    tags: ['work', 'communication'],
    difficulty: 3,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(21),
    mode: 'recall',
    prompt_en: 'Where is the nearest metro station?',
    canonical_fr: 'Où est la station de métro la plus proche ?',
    answers_fr: ['Où est la station de métro la plus proche ?', 'Où se trouve la station de métro la plus proche ?'],
    tags: ['logistics', 'transportation'],
    difficulty: 3,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(22),
    mode: 'recall',
    prompt_en: 'How much does it cost?',
    canonical_fr: 'Ça coûte combien ?',
    answers_fr: ['Ça coûte combien ?', 'Combien ça coûte ?', 'C\'est combien ?'],
    tags: ['logistics', 'shopping'],
    difficulty: 2,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(23),
    mode: 'recognition',
    audio_url: '/mock/audio/phrase-023.mp3',
    transcript_fr: 'C\'est vingt euros',
    translation_en: 'It\'s twenty euros',
    tags: ['logistics', 'shopping'],
    difficulty: 2,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(24),
    mode: 'recall',
    prompt_en: 'I would like to reserve a table',
    canonical_fr: 'Je voudrais réserver une table',
    answers_fr: ['Je voudrais réserver une table', 'J\'aimerais réserver une table', 'Je veux réserver une table'],
    tags: ['logistics', 'restaurant'],
    difficulty: 3,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(25),
    mode: 'recall',
    prompt_en: 'For how many people?',
    canonical_fr: 'Pour combien de personnes ?',
    answers_fr: ['Pour combien de personnes ?', 'Combien de personnes ?', 'Pour combien ?'],
    tags: ['logistics', 'restaurant'],
    difficulty: 2,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(26),
    mode: 'recognition',
    audio_url: '/mock/audio/phrase-026.mp3',
    transcript_fr: 'Vous acceptez les cartes de crédit ?',
    translation_en: 'Do you accept credit cards?',
    tags: ['logistics', 'payment'],
    difficulty: 3,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(27),
    mode: 'recall',
    prompt_en: 'Where is the bathroom?',
    canonical_fr: 'Où sont les toilettes ?',
    answers_fr: ['Où sont les toilettes ?', 'Où est la salle de bain ?', 'Les toilettes, s\'il vous plaît ?'],
    tags: ['logistics', 'basics'],
    difficulty: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(28),
    mode: 'recall',
    prompt_en: 'Can I have the bill please?',
    canonical_fr: 'L\'addition, s\'il vous plaît',
    answers_fr: ['L\'addition, s\'il vous plaît', 'Je peux avoir l\'addition ?', 'La note, s\'il vous plaît'],
    tags: ['logistics', 'restaurant'],
    difficulty: 2,
    created_at: '2026-01-01T00:00:00Z',
  },

  // Pack 3: Emotional reactions (12 phrases)
  {
    id: getPhraseUUID(29),
    mode: 'recall',
    prompt_en: 'I\'m so happy!',
    canonical_fr: 'Je suis tellement content !',
    answers_fr: ['Je suis tellement content !', 'Je suis si heureux !', 'Je suis très content !'],
    tags: ['emotions', 'positive'],
    difficulty: 2,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(30),
    mode: 'recognition',
    audio_url: '/mock/audio/phrase-030.mp3',
    transcript_fr: 'C\'est génial !',
    translation_en: 'That\'s awesome!',
    tags: ['emotions', 'positive'],
    difficulty: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(31),
    mode: 'recall',
    prompt_en: 'I\'m frustrated',
    canonical_fr: 'Je suis frustré',
    answers_fr: ['Je suis frustré', 'Ça me frustre', 'Je me sens frustré'],
    tags: ['emotions', 'negative'],
    difficulty: 3,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(32),
    mode: 'recall',
    prompt_en: 'That makes me sad',
    canonical_fr: 'Ça me rend triste',
    answers_fr: ['Ça me rend triste', 'Ça m\'attriste', 'Je suis triste'],
    tags: ['emotions', 'negative'],
    difficulty: 3,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(33),
    mode: 'recognition',
    audio_url: '/mock/audio/phrase-033.mp3',
    transcript_fr: 'Je suis désolé',
    translation_en: 'I\'m sorry',
    tags: ['emotions', 'apology'],
    difficulty: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(34),
    mode: 'recall',
    prompt_en: 'Don\'t worry',
    canonical_fr: 'T\'inquiète pas',
    answers_fr: ['T\'inquiète pas', 'Ne t\'inquiète pas', 'Inquiète-toi pas'],
    tags: ['emotions', 'reassurance'],
    difficulty: 2,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(35),
    mode: 'recall',
    prompt_en: 'I\'m really excited',
    canonical_fr: 'Je suis super excité',
    answers_fr: ['Je suis super excité', 'Je suis très excité', 'Je suis trop excité'],
    tags: ['emotions', 'positive'],
    difficulty: 2,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(36),
    mode: 'recognition',
    audio_url: '/mock/audio/phrase-036.mp3',
    transcript_fr: 'Ça m\'énerve !',
    translation_en: 'That annoys me!',
    tags: ['emotions', 'negative'],
    difficulty: 3,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(37),
    mode: 'recall',
    prompt_en: 'I\'m confused',
    canonical_fr: 'Je suis confus',
    answers_fr: ['Je suis confus', 'Je ne comprends pas', 'Ça me confond'],
    tags: ['emotions', 'confusion'],
    difficulty: 2,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(38),
    mode: 'recall',
    prompt_en: 'That\'s incredible!',
    canonical_fr: 'C\'est incroyable !',
    answers_fr: ['C\'est incroyable !', 'C\'est dingue !', 'C\'est fou !'],
    tags: ['emotions', 'positive'],
    difficulty: 2,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(39),
    mode: 'recognition',
    audio_url: '/mock/audio/phrase-039.mp3',
    transcript_fr: 'Je m\'en fiche',
    translation_en: 'I don\'t care',
    tags: ['emotions', 'indifference'],
    difficulty: 3,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: getPhraseUUID(40),
    mode: 'recall',
    prompt_en: 'I feel better now',
    canonical_fr: 'Je me sens mieux maintenant',
    answers_fr: ['Je me sens mieux maintenant', 'Ça va mieux maintenant', 'Je vais mieux maintenant'],
    tags: ['emotions', 'positive'],
    difficulty: 3,
    created_at: '2026-01-01T00:00:00Z',
  },
];

// 3 Phrase Packs
export const MOCK_PHRASE_PACKS: PhrasePack[] = [
  {
    id: 'pack-001',
    name: 'Small talk starter',
    description: 'Essential phrases for everyday conversations and introductions',
    tags: ['small talk', 'greetings', 'introductions'],
    phrase_ids: [
      getPhraseUUID(1), getPhraseUUID(2), getPhraseUUID(3), getPhraseUUID(4), getPhraseUUID(5),
      getPhraseUUID(6), getPhraseUUID(7), getPhraseUUID(8), getPhraseUUID(9), getPhraseUUID(10),
      getPhraseUUID(11), getPhraseUUID(12), getPhraseUUID(13), getPhraseUUID(14), getPhraseUUID(15),
    ],
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'pack-002',
    name: 'Work + logistics',
    description: 'Navigate work situations and daily logistics with confidence',
    tags: ['work', 'logistics', 'practical'],
    phrase_ids: [
      getPhraseUUID(16), getPhraseUUID(17), getPhraseUUID(18), getPhraseUUID(19), getPhraseUUID(20),
      getPhraseUUID(21), getPhraseUUID(22), getPhraseUUID(23), getPhraseUUID(24), getPhraseUUID(25),
      getPhraseUUID(26), getPhraseUUID(27), getPhraseUUID(28),
    ],
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'pack-003',
    name: 'Emotional reactions',
    description: 'Express your feelings and reactions naturally in French',
    tags: ['emotions', 'relationships', 'feelings'],
    phrase_ids: [
      getPhraseUUID(29), getPhraseUUID(30), getPhraseUUID(31), getPhraseUUID(32), getPhraseUUID(33),
      getPhraseUUID(34), getPhraseUUID(35), getPhraseUUID(36), getPhraseUUID(37), getPhraseUUID(38),
      getPhraseUUID(39), getPhraseUUID(40),
    ],
    created_at: '2026-01-01T00:00:00Z',
  },
];

// Helper to get phrase by id
export function getPhraseById(id: string): Phrase | undefined {
  return MOCK_PHRASES.find((p) => p.id === id);
}

// Helper to get pack by id
export function getPackById(id: string): PhrasePack | undefined {
  return MOCK_PHRASE_PACKS.find((p) => p.id === id);
}

// Helper to get phrases by pack id
export function getPhrasesByPackId(packId: string): Phrase[] {
  const pack = getPackById(packId);
  if (!pack) return [];
  return pack.phrase_ids.map((id) => getPhraseById(id)).filter((p): p is Phrase => p !== undefined);
}

// Get all unique tags
export function getAllTags(): string[] {
  const tagSet = new Set<string>();
  MOCK_PHRASES.forEach((phrase) => {
    phrase.tags.forEach((tag) => tagSet.add(tag));
  });
  return Array.from(tagSet).sort();
}

