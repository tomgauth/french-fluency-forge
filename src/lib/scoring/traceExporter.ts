/**
 * Trace Exporter
 * Export and import scoring traces for calibration and analysis
 */

import type { ScoringTrace } from '@/components/assessment/conversation/types';
import { traceToJSON, traceFromJSON } from './traceBuilder';

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Export trace as JSON file download
 */
export function exportTraceJSON(
  trace: ScoringTrace,
  filename?: string
): void {
  const json = traceToJSON(trace, true);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const defaultFilename = `trace_${trace.meta.scenario_id}_${trace.meta.session_id.substring(0, 8)}_${Date.now()}.json`;
  const finalFilename = filename || defaultFilename;
  
  const a = document.createElement('a');
  a.href = url;
  a.download = finalFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export multiple traces as a zip (requires JSZip library)
 */
export async function exportMultipleTracesJSON(
  traces: ScoringTrace[],
  zipFilename: string = `traces_${Date.now()}.zip`
): Promise<void> {
  // For now, export individually
  // In production, could use JSZip library for actual zip creation
  traces.forEach((trace, index) => {
    setTimeout(() => {
      exportTraceJSON(
        trace,
        `trace_${index + 1}_${trace.meta.scenario_id}_${trace.meta.session_id.substring(0, 8)}.json`
      );
    }, index * 500); // Stagger downloads to avoid browser blocking
  });
}

/**
 * Export trace as CSV (summary view)
 */
export function exportTraceCSV(
  trace: ScoringTrace,
  filename?: string
): void {
  const rows: string[][] = [];
  
  // Header
  rows.push([
    'Session ID',
    'Scenario ID',
    'Persona ID',
    'Tier',
    'Fluency Score',
    'Syntax Score',
    'Conversation Score',
    'Confidence Score',
    'Total Turns',
    'User Turns',
    'Repair Events',
    'Resolved Events',
    'Debug Flags',
  ]);
  
  // Data row
  const userTurns = trace.turns.filter(t => t.speaker === 'user').length;
  const resolvedEvents = trace.repair_events.filter(e => e.resolved_turn !== null).length;
  
  rows.push([
    trace.meta.session_id,
    trace.meta.scenario_id,
    trace.meta.persona_id,
    JSON.stringify(trace.meta.tiers),
    trace.scores.fluency?.score.toString() || 'N/A',
    trace.scores.syntax?.score.toString() || 'N/A',
    trace.scores.conversation?.score.toString() || 'N/A',
    trace.scores.confidence?.final.toString() || 'N/A',
    trace.turns.length.toString(),
    userTurns.toString(),
    trace.repair_events.length.toString(),
    resolvedEvents.toString(),
    trace.debug_flags.join('; '),
  ]);
  
  const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  const defaultFilename = `trace_summary_${trace.meta.scenario_id}_${Date.now()}.csv`;
  const finalFilename = filename || defaultFilename;
  
  const a = document.createElement('a');
  a.href = url;
  a.download = finalFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy trace JSON to clipboard
 */
export async function copyTraceToClipboard(trace: ScoringTrace): Promise<void> {
  const json = traceToJSON(trace, true);
  await navigator.clipboard.writeText(json);
}

// ============================================================================
// Import Functions
// ============================================================================

/**
 * Import trace from JSON file
 */
export function importTraceFromFile(file: File): Promise<ScoringTrace> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const trace = traceFromJSON(json);
        resolve(trace);
      } catch (error) {
        reject(new Error(`Failed to parse trace: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Import trace from JSON string
 */
export function importTraceFromJSON(json: string): ScoringTrace {
  try {
    return traceFromJSON(json);
  } catch (error) {
    throw new Error(`Failed to parse trace: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Batch Export Functions
// ============================================================================

/**
 * Export multiple traces as CSV (one trace per row)
 */
export function exportMultipleTracesCSV(
  traces: ScoringTrace[],
  filename: string = `traces_summary_${Date.now()}.csv`
): void {
  const rows: string[][] = [];
  
  // Header
  rows.push([
    'Session ID',
    'Scenario ID',
    'Persona ID',
    'Tier',
    'Fluency Score',
    'Syntax Score',
    'Conversation Score',
    'Confidence Score',
    'Total Turns',
    'User Turns',
    'Repair Events',
    'Resolved Events',
    'Debug Flags Count',
  ]);
  
  // Data rows
  traces.forEach(trace => {
    const userTurns = trace.turns.filter(t => t.speaker === 'user').length;
    const resolvedEvents = trace.repair_events.filter(e => e.resolved_turn !== null).length;
    
    rows.push([
      trace.meta.session_id,
      trace.meta.scenario_id,
      trace.meta.persona_id,
      JSON.stringify(trace.meta.tiers),
      trace.scores.fluency?.score.toString() || 'N/A',
      trace.scores.syntax?.score.toString() || 'N/A',
      trace.scores.conversation?.score.toString() || 'N/A',
      trace.scores.confidence?.final.toString() || 'N/A',
      trace.turns.length.toString(),
      userTurns.toString(),
      trace.repair_events.length.toString(),
      resolvedEvents.toString(),
      trace.debug_flags.length.toString(),
    ]);
  });
  
  const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// Database Integration (for Supabase)
// ============================================================================

/**
 * Prepare trace for database storage
 * Returns the trace_data JSONB object
 */
export function prepareTraceForDB(trace: ScoringTrace): {
  session_id: string;
  module_type: string;
  trace_data: ScoringTrace;
} {
  // Determine primary module type based on which scores are present
  let module_type = 'conversation'; // default
  
  if (trace.scores.fluency) module_type = 'fluency';
  else if (trace.scores.syntax) module_type = 'syntax';
  else if (trace.scores.confidence) module_type = 'confidence';
  else if (trace.scores.conversation) module_type = 'conversation';
  
  return {
    session_id: trace.meta.session_id,
    module_type,
    trace_data: trace,
  };
}

/**
 * Extract trace from database record
 */
export function extractTraceFromDB(dbRecord: {
  trace_data: ScoringTrace;
}): ScoringTrace {
  return dbRecord.trace_data;
}

