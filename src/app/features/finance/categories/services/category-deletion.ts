import { inject, Injectable } from '@angular/core';
import { catchError, defer, forkJoin, map, Observable, of, switchMap, tap, throwError } from 'rxjs';

import { Category, Transaction } from '../../models';
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';
import { CategoriesStateService } from './categories-state';

export interface CategoryDeletionBlock {
  message: string;
  notification: 'info' | 'warning';
}

@Injectable()
export class CategoryDeletionService {
  private readonly state = inject(CategoriesStateService);
  private readonly categoryService = inject(CategoryService);
  private readonly transactionService = inject(TransactionService);

  getDeletionBlock(category: Category): CategoryDeletionBlock | null {
    const userId = this.state.currentUserId();

    if (!userId) {
      return {
        message: 'No se ha podido identificar al usuario actual.',
        notification: 'warning',
      };
    }

    if (category.userId !== userId) {
      return {
        message: 'No puedes eliminar esta categoría.',
        notification: 'warning',
      };
    }

    if (this.state.isLoadingBudgets()) {
      return {
        message: 'Espera a que termine de cargarse la información de presupuestos.',
        notification: 'info',
      };
    }

    if (this.state.budgetLoadError()) {
      return {
        message:
          'No se puede eliminar la categoría porque no se ha podido comprobar si tiene presupuestos asociados.',
        notification: 'warning',
      };
    }

    if (this.state.hasBudget(category.id)) {
      return {
        message:
          `La categoría "${category.name}" tiene un presupuesto asociado. ` +
          'Elimina o modifica primero ese presupuesto.',
        notification: 'warning',
      };
    }

    return null;
  }

  getAffectedTransactions(category: Category): Transaction[] {
    return this.state
      .transactions()
      .filter((transaction) => transaction.categoryId === category.id);
  }

  deleteCategory(category: Category): Observable<void> {
    return defer(() => {
      const block = this.getDeletionBlock(category);

      if (block) {
        return throwError(() => new Error(block.message));
      }

      const affectedTransactions = this.getAffectedTransactions(category);

      const unlinkRequest: Observable<Transaction[]> =
        affectedTransactions.length === 0
          ? of([])
          : forkJoin(
              affectedTransactions.map((transaction) =>
                this.transactionService.updateTransaction(transaction.id, {
                  categoryId: null,
                  categoryNameSnapshot: category.name,
                }),
              ),
            );

      return unlinkRequest.pipe(
        switchMap((updatedTransactions) =>
          this.categoryService.deleteCategory(category.id).pipe(map(() => updatedTransactions)),
        ),
        tap((updatedTransactions) => {
          this.state.applyDeletedCategory(category.id, updatedTransactions);
        }),
        map(() => undefined),
        catchError((error: unknown) => {
          this.state.reloadAfterDeleteFailure();

          return throwError(() => error);
        }),
      );
    });
  }
}
