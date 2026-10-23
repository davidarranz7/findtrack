import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, finalize } from 'rxjs';

import { AuthService } from '../../../../features/auth/services/auth.service';
import { Category, Transaction } from '../../../../features/finance/models';
import { HeaderSearchService } from './services/header-search.service';

@Component({
  selector: 'app-header-search',
  imports: [],
  templateUrl: './header-search.html',
  styleUrl: './header-search.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderSearch {
  private readonly authService = inject(AuthService);
  private readonly searchService = inject(HeaderSearchService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchWrapper = viewChild<ElementRef<HTMLElement>>('searchWrapper');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('globalSearchInput');

  readonly searchOpened = output<void>();

  protected readonly searchQuery = signal('');
  protected readonly isSearchOpen = signal(false);
  protected readonly isMobileSearchOpen = signal(false);
  protected readonly isLoadingSearch = signal(false);
  protected readonly searchError = signal<string | null>(null);
  protected readonly searchTransactions = signal<Transaction[]>([]);
  protected readonly searchCategories = signal<Category[]>([]);
  protected readonly hasLoadedSearchData = signal(false);
  protected readonly showAllSearchResults = signal(false);
  protected readonly activeSearchIndex = signal(-1);

  private readonly currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });
  private readonly dateFormatter = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  protected readonly matchingSearchTransactions = computed(() =>
    this.searchService.filterTransactions(this.searchTransactions(), this.searchQuery()),
  );
  protected readonly visibleSearchResults = computed(() =>
    this.showAllSearchResults()
      ? this.matchingSearchTransactions()
      : this.matchingSearchTransactions().slice(0, 6),
  );

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.closeSearch(true);
        this.hasLoadedSearchData.set(false);
      });

    this.searchService.transactionsChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.hasLoadedSearchData.set(false);
        if (this.isSearchOpen()) {
          this.loadSearchData();
        }
      });
  }

  @HostListener('document:click', ['$event'])
  protected handleDocumentClick(event: MouseEvent): void {
    const target = event.target;
    const wrapper = this.searchWrapper()?.nativeElement;
    if (target instanceof Node && this.isSearchOpen() && wrapper && !wrapper.contains(target)) {
      this.closeSearch();
    }
  }

  @HostListener('document:keydown.escape')
  protected handleEscapeKey(): void {
    this.closeSearch();
  }

  protected openSearch(): void {
    this.searchOpened.emit();
    this.isSearchOpen.set(true);
    if (!this.hasLoadedSearchData() && !this.isLoadingSearch()) {
      this.loadSearchData();
    }
  }

  protected toggleMobileSearch(): void {
    if (this.isMobileSearchOpen()) {
      this.closeSearch();
      return;
    }
    this.isMobileSearchOpen.set(true);
    this.openSearch();
    setTimeout(() => {
      if (this.isMobileSearchOpen()) {
        this.searchInput()?.nativeElement.focus();
      }
    });
  }

  public closeSearch(clearQuery = false): void {
    this.isSearchOpen.set(false);
    this.isMobileSearchOpen.set(false);
    this.activeSearchIndex.set(-1);
    this.showAllSearchResults.set(false);
    if (clearQuery) {
      this.searchQuery.set('');
    }
  }

  public resetOnLogout(): void {
    this.closeSearch(true);
    this.searchTransactions.set([]);
    this.searchCategories.set([]);
    this.hasLoadedSearchData.set(false);
  }

  protected updateSearchQuery(value: string): void {
    this.searchQuery.set(value);
    this.showAllSearchResults.set(false);
    this.activeSearchIndex.set(value.trim() ? 0 : -1);
    if (!this.isSearchOpen()) {
      this.openSearch();
    }
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
    this.activeSearchIndex.set(-1);
    this.showAllSearchResults.set(false);
    this.searchInput()?.nativeElement.focus();
  }

  protected expandSearchResults(): void {
    this.showAllSearchResults.set(true);
    this.activeSearchIndex.set(0);
  }

  protected handleSearchKeydown(event: KeyboardEvent): void {
    const results = this.visibleSearchResults();
    if (!this.isSearchOpen() || results.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeSearchIndex.update((index) => (index < results.length - 1 ? index + 1 : 0));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeSearchIndex.update((index) => (index > 0 ? index - 1 : results.length - 1));
      return;
    }

    if (event.key === 'Enter') {
      const index = this.activeSearchIndex();
      const transaction = results[index];
      if (transaction) {
        event.preventDefault();
        this.openSearchResult(transaction);
      }
    }
  }

  protected openSearchResult(transaction: Transaction): void {
    this.closeSearch(true);
    void this.router.navigate(['/transactions'], {
      queryParams: {
        month: transaction.date.slice(0, 7),
        search: transaction.description,
      },
    });
  }

  protected getSearchCategoryName(categoryId: string | null): string {
    return (
      this.searchCategories().find((category) => category.id === categoryId)?.name ??
      'Sin categoría'
    );
  }

  protected formatSearchDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    return this.dateFormatter.format(new Date(year, month - 1, day));
  }

  protected formatSearchAmount(transaction: Transaction): string {
    const amount = this.currencyFormatter.format(transaction.amount);
    return transaction.type === 'income' ? `+${amount}` : `-${amount}`;
  }

  protected loadSearchData(): void {
    if (this.isLoadingSearch()) {
      return;
    }
    const userId = this.authService.currentUser()?.id;
    if (!userId) {
      this.searchTransactions.set([]);
      this.searchCategories.set([]);
      this.searchError.set('No se ha podido identificar al usuario actual.');
      return;
    }

    this.isLoadingSearch.set(true);
    this.searchError.set(null);
    this.searchService
      .loadData(userId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingSearch.set(false)),
      )
      .subscribe({
        next: ({ transactions, categories }) => {
          if (this.authService.currentUser()?.id !== userId) {
            return;
          }
          this.searchTransactions.set(transactions);
          this.searchCategories.set(categories);
          this.hasLoadedSearchData.set(true);
        },
        error: () => {
          this.searchTransactions.set([]);
          this.searchCategories.set([]);
          this.hasLoadedSearchData.set(false);
          this.searchError.set('No hemos podido cargar los resultados de búsqueda.');
        },
      });
  }
}
