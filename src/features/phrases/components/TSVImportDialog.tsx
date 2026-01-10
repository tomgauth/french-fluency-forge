/**
 * TSV Import Dialog
 * Allows users to paste TSV data to create flashcards
 * Format: English<TAB>French<TAB>Tags (optional)
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import type { Phrase, MemberPhraseCard } from '../types';

interface TSVImportDialogProps {
  onImport: (phrases: Phrase[], cards: MemberPhraseCard[]) => Promise<void>;
  memberId: string;
  children?: React.ReactNode;
}

interface ParsedRow {
  english: string;
  french: string;
  alternates: string[];
  tags: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  valid: boolean;
  error?: string;
}

/**
 * Parse TSV content into phrase data
 * Expected format: English<TAB>French<TAB>Alternates (comma-separated, optional)<TAB>Tags (comma-separated, optional)<TAB>Difficulty (1-5, optional)
 */
function parseTSV(content: string): ParsedRow[] {
  const lines = content.trim().split('\n');
  const rows: ParsedRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines
    
    // Skip header row if detected
    const lowerLine = line.toLowerCase();
    if (lowerLine.startsWith('english') || lowerLine.startsWith('prompt') || lowerLine.startsWith('#')) {
      continue;
    }

    const parts = line.split('\t');
    const english = parts[0]?.trim() || '';
    const french = parts[1]?.trim() || '';
    const alternatesRaw = parts[2]?.trim() || '';
    const tagsRaw = parts[3]?.trim() || '';
    const difficultyRaw = parts[4]?.trim() || '3';

    // Parse alternates
    const alternates = alternatesRaw
      ? alternatesRaw.split(',').map((a) => a.trim()).filter(Boolean)
      : [];

    // Parse tags
    const tags = tagsRaw
      ? tagsRaw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
      : ['imported'];

    // Parse difficulty
    let difficulty = parseInt(difficultyRaw, 10);
    if (isNaN(difficulty) || difficulty < 1 || difficulty > 5) {
      difficulty = 3;
    }

    // Validate
    if (!english || !french) {
      rows.push({
        english,
        french,
        alternates,
        tags,
        difficulty: difficulty as 1 | 2 | 3 | 4 | 5,
        valid: false,
        error: `Row ${i + 1}: Missing ${!english ? 'English' : 'French'} text`,
      });
    } else {
      rows.push({
        english,
        french,
        alternates,
        tags,
        difficulty: difficulty as 1 | 2 | 3 | 4 | 5,
        valid: true,
      });
    }
  }

  return rows;
}

/**
 * Convert parsed rows to Phrase and MemberPhraseCard objects
 */
function createPhrasesAndCards(
  rows: ParsedRow[],
  memberId: string
): { phrases: Phrase[]; cards: MemberPhraseCard[] } {
  const now = new Date();
  const phrases: Phrase[] = [];
  const cards: MemberPhraseCard[] = [];

  for (const row of rows.filter((r) => r.valid)) {
    const phraseId = crypto.randomUUID();
    const cardId = crypto.randomUUID();

    // Create phrase
    const phrase: Phrase = {
      id: phraseId,
      mode: 'recall',
      prompt_en: row.english,
      canonical_fr: row.french,
      answers_fr: [row.french, ...row.alternates],
      tags: row.tags,
      difficulty: row.difficulty,
      created_at: now.toISOString(),
    };

    // Create card
    const card: MemberPhraseCard = {
      id: cardId,
      member_id: memberId,
      phrase_id: phraseId,
      status: 'active',
      priority: 0,
      scheduler: {
        algorithm: 'fsrs',
        state: 'new',
        due_at: now.toISOString(),
        interval_days: 0,
        ease_factor: 2.5,
        repetitions: 0,
      },
      lapses: 0,
      reviews: 0,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    phrases.push(phrase);
    cards.push(card);
  }

  return { phrases, cards };
}

export function TSVImportDialog({ onImport, memberId, children }: TSVImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [tsvContent, setTsvContent] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleParse = () => {
    const rows = parseTSV(tsvContent);
    setParsedRows(rows);
    setImportResult(null);
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter((r) => r.valid);
    if (validRows.length === 0) {
      setImportResult({ success: false, message: 'No valid rows to import' });
      return;
    }

    setIsImporting(true);
    try {
      const { phrases, cards } = createPhrasesAndCards(parsedRows, memberId);
      await onImport(phrases, cards);
      setImportResult({
        success: true,
        message: `Successfully imported ${phrases.length} phrases!`,
      });
      // Reset after success
      setTimeout(() => {
        setTsvContent('');
        setParsedRows([]);
        setImportResult(null);
        setOpen(false);
      }, 2000);
    } catch (error) {
      setImportResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to import phrases',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setTsvContent('');
    setParsedRows([]);
    setImportResult(null);
  };

  const validCount = parsedRows.filter((r) => r.valid).length;
  const invalidCount = parsedRows.filter((r) => !r.valid).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Import TSV
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Import Phrases from TSV
          </DialogTitle>
          <DialogDescription>
            Paste tab-separated values to create flashcards. Each row creates one phrase.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format instructions */}
          <Alert>
            <AlertDescription className="text-sm">
              <strong>Format:</strong> English ⇥ French ⇥ Alternates (optional) ⇥ Tags (optional) ⇥ Difficulty (1-5, optional)
              <br />
              <span className="text-muted-foreground">
                Example: How are you?{'\t'}Comment ça va ?{'\t'}Ça va ?, Comment vas-tu ?{'\t'}greetings, small talk{'\t'}1
              </span>
            </AlertDescription>
          </Alert>

          {/* TSV input */}
          <div className="space-y-2">
            <Label htmlFor="tsv-input">Paste TSV content</Label>
            <Textarea
              id="tsv-input"
              placeholder="English	French	Alternates	Tags	Difficulty
How are you?	Comment ça va ?	Ça va ?	greetings	1
I'm fine thanks	Je vais bien merci		greetings	1"
              value={tsvContent}
              onChange={(e) => setTsvContent(e.target.value)}
              className="font-mono text-sm min-h-[200px]"
            />
          </div>

          {/* Parse button */}
          {parsedRows.length === 0 && (
            <Button onClick={handleParse} disabled={!tsvContent.trim()}>
              Parse TSV
            </Button>
          )}

          {/* Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  {validCount} valid
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {invalidCount} errors
                  </Badge>
                )}
              </div>

              {/* Preview table */}
              <div className="border rounded-md overflow-hidden max-h-[200px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">English</th>
                      <th className="p-2 text-left">French</th>
                      <th className="p-2 text-left">Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, i) => (
                      <tr key={i} className={row.valid ? '' : 'bg-destructive/10'}>
                        <td className="p-2">
                          {row.valid ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-destructive" />
                          )}
                        </td>
                        <td className="p-2 truncate max-w-[150px]" title={row.english}>
                          {row.english || <span className="text-muted-foreground italic">empty</span>}
                        </td>
                        <td className="p-2 truncate max-w-[150px]" title={row.french}>
                          {row.french || <span className="text-muted-foreground italic">empty</span>}
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1 flex-wrap">
                            {row.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {row.tags.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{row.tags.length - 2}
                              </Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Errors list */}
              {invalidCount > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {parsedRows
                      .filter((r) => !r.valid)
                      .map((r) => r.error)
                      .join('. ')}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Import result */}
          {importResult && (
            <Alert variant={importResult.success ? 'default' : 'destructive'}>
              {importResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{importResult.message}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          {parsedRows.length > 0 && (
            <Button variant="ghost" onClick={handleReset}>
              Start over
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {parsedRows.length > 0 && (
              <Button
                onClick={handleImport}
                disabled={validCount === 0 || isImporting}
              >
                {isImporting ? 'Importing...' : `Import ${validCount} phrase${validCount !== 1 ? 's' : ''}`}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
