/**
 * Library Table Component
 * Displays phrases with filters and actions
 */

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, MoreVertical, Play, EyeOff, Pause, Trash2, Flag, RotateCcw } from 'lucide-react';
import type { MemberPhraseCard, Phrase, LibraryFilters } from '../types';
import { formatInterval } from '../data/schedulerMock';
import { EmptyState } from './EmptyState';

interface LibraryTableProps {
  cards: Array<{ card: MemberPhraseCard; phrase: Phrase }>;
  filters: LibraryFilters;
  onFilterChange: (filters: LibraryFilters) => void;
  onBury: (cardId: string) => void;
  onSuspend: (cardId: string) => void;
  onRemove: (cardId: string) => void;
  onReactivate: (cardId: string) => void;
  onFlag: (cardId: string, reason: string) => void;
}

export function LibraryTable({
  cards,
  filters,
  onFilterChange,
  onBury,
  onSuspend,
  onRemove,
  onReactivate,
  onFlag,
}: LibraryTableProps) {
  const [searchTerm, setSearchTerm] = useState(filters.search);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    onFilterChange({ ...filters, search: value });
  };

  const getDueStatus = (dueAt: string): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
    const now = new Date();
    const due = new Date(dueAt);
    const diffDays = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: 'Overdue', variant: 'destructive' };
    if (diffDays === 0) return { label: 'Today', variant: 'default' };
    if (diffDays === 1) return { label: 'Tomorrow', variant: 'secondary' };
    return { label: `in ${diffDays}d`, variant: 'outline' };
  };

  if (cards.length === 0) {
    return (
      <div className="border border-border rounded-lg p-8">
        <EmptyState
          icon={Search}
          title="No phrases found"
          description="Try adjusting your filters or search term"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search phrases..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filters.mode} onValueChange={(value) => onFilterChange({ ...filters, mode: value as LibraryFilters['mode'] })}>
          <SelectTrigger className="w-full md:w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modes</SelectItem>
            <SelectItem value="recall">Recall only</SelectItem>
            <SelectItem value="recognition">Recognition only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.status} onValueChange={(value) => onFilterChange({ ...filters, status: value as LibraryFilters['status'] })}>
          <SelectTrigger className="w-full md:w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="buried">Buried</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="removed">Removed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.dueFilter} onValueChange={(value) => onFilterChange({ ...filters, dueFilter: value as LibraryFilters['dueFilter'] })}>
          <SelectTrigger className="w-full md:w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All due dates</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="today">Due today</SelectItem>
            <SelectItem value="future">Future</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phrase</TableHead>
                <TableHead className="w-[100px]">Mode</TableHead>
                <TableHead className="w-[150px]">Tags</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[120px]">Due</TableHead>
                <TableHead className="w-[80px]">Reviews</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map(({ card, phrase }) => {
                const dueStatus = getDueStatus(card.scheduler.due_at);
                return (
                  <TableRow key={card.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {phrase.canonical_fr || phrase.transcript_fr}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {phrase.prompt_en || phrase.translation_en}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={phrase.mode === 'recall' ? 'default' : 'secondary'} className="text-xs">
                        {phrase.mode}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {phrase.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {phrase.tags.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{phrase.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={card.status === 'active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {card.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={dueStatus.variant} className="text-xs">
                        {dueStatus.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {card.reviews}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {card.status !== 'active' && (
                            <>
                              <DropdownMenuItem onClick={() => onReactivate(card.id)}>
                                <Play className="w-4 h-4 mr-2" />
                                Reactivate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          {card.status === 'active' && (
                            <>
                              <DropdownMenuItem onClick={() => onBury(card.id)}>
                                <EyeOff className="w-4 h-4 mr-2" />
                                Bury (until tomorrow)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onSuspend(card.id)}>
                                <Pause className="w-4 h-4 mr-2" />
                                Suspend
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem onClick={() => onFlag(card.id, 'Flagged from library')}>
                            <Flag className="w-4 h-4 mr-2" />
                            Flag issue
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onRemove(card.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground text-center">
        Showing {cards.length} phrase{cards.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

